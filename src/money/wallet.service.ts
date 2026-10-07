import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HoldService } from './hold.service';
import { GlMapService } from './gl-map.service';
import { DUNG_SAI_AM, nowSec, toVnd } from '../common/money';

export type ApplyOpts = {
  accountType?: 'cty' | 'ca_nhan'; allowNegative?: boolean; ignoreHold?: boolean;
  holdExcludeRequest?: number; payInfo?: string; payFrom?: string;
  /**
   * Khoá nghiệp vụ DUY NHẤT của bút toán (vd `'approval:123'`). Có truyền thì
   * `applyEntry` AN TOÀN KHI CHẠY LẠI: lần gọi thứ hai với cùng `refKey` KHÔNG
   * ghi thêm bút toán nào, mà trả về `{ ok: true, alreadyApplied: true }` kèm
   * bút toán đã ghi trước đó. Không truyền = hành vi cũ, ghi mỗi lần gọi.
   */
  refKey?: string;
};
export type ApplyResult = { ok: boolean; msg: string; balance: bigint | null; prev?: bigint; detailId?: bigint; hold?: bigint;
  /** true = bút toán này ĐÃ ghi từ trước (khớp refKey), lần gọi này KHÔNG ghi thêm. */
  alreadyApplied?: boolean };

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService, private hold: HoldService, private glmap: GlMapService) {}

  async getBalanceTrue(cusId: string, accountType?: 'cty' | 'ca_nhan'): Promise<bigint> {
    const r = await this.prisma.walletEntry.aggregate({
      _sum: { money: true },
      where: { cusId: cusId.trim(), ...(accountType ? { accountType } : {}) },
    });
    return r._sum.money ?? 0n;
  }

  async applyEntry(cusId: string, moneySigned: number | bigint, type: number, note = '', author = '', oid = 0, opts: ApplyOpts = {}): Promise<ApplyResult> {
    cusId = (cusId ?? '').trim();
    const money = toVnd(moneySigned);
    const acctType = opts.accountType === 'ca_nhan' ? 'ca_nhan' : 'cty';
    if (!cusId) return { ok: false, msg: 'Thiếu mã khách', balance: null };
    if (money === 0n) return { ok: false, msg: 'Số tiền bằng 0', balance: null };

    // Neo chống ghi trùng: đã có bút toán mang đúng refKey thì KHÔNG ghi nữa.
    // Kiểm sớm ở đây để đường chạy-lại thông thường khỏi phải mở transaction;
    // cuộc đua thật sự vẫn được UNIQUE index chặn (xem catch bên dưới).
    const refKey = opts.refKey?.trim() || null;
    if (refKey) {
      const da = await this.prisma.walletEntry.findUnique({ where: { refKey } });
      if (da) {
        return { ok: true, msg: 'Đã ghi trước đó (refKey)', balance: await this.getBalanceTrue(cusId),
                 detailId: da.id, alreadyApplied: true };
      }
    }

    let result: ApplyResult;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        // Khoá dòng ví (tạo nếu chưa có) — FOR UPDATE
        await tx.$executeRaw`INSERT INTO tbl_wallet (cus_id, total, status) VALUES (${cusId}, 0, 1) ON CONFLICT (cus_id) DO NOTHING`;
        await tx.$queryRaw`SELECT id FROM tbl_wallet WHERE cus_id = ${cusId} FOR UPDATE`;

        const agg = await tx.walletEntry.aggregate({ _sum: { money: true }, where: { cusId } });
        const cur = agg._sum.money ?? 0n;
        const next = cur + money;

        if (money < 0n && !opts.allowNegative && next < -DUNG_SAI_AM)
          return { ok: false, msg: `Số dư ví không đủ (còn ${cur}, cần trừ ${-money})`, balance: cur };

        if (money < 0n && !opts.allowNegative && !opts.ignoreHold) {
          const held = await this.hold.holdAmount(cusId, opts.holdExcludeRequest);
          if (held > 0n && cur - held + money < -DUNG_SAI_AM)
            return { ok: false, msg: `Số dư khả dụng không đủ (giữ ${held})`, balance: cur, hold: held };
        }

        const now = nowSec();
        const detail = await tx.walletEntry.create({ data: {
          type, accountType: acctType, cusId, oid: oid > 0 ? oid : null, money,
          payInfo: opts.payInfo ?? null, payFrom: opts.payFrom ?? null, note, cdate: now, author, status: 1,
          refKey,
        }});
        await tx.wallet.update({ where: { cusId }, data: { total: next } });
        return { ok: true, msg: 'OK', balance: next, prev: cur, detailId: detail.id };
      });
    } catch (err) {
      // Cuộc đua: hai lời gọi cùng refKey chạy song song, một bên thắng UNIQUE.
      // Bên thua KHÔNG được coi là lỗi — bút toán đã nằm trong sổ đúng một lần.
      if (refKey && (err as { code?: string })?.code === 'P2002') {
        const da = await this.prisma.walletEntry.findUnique({ where: { refKey } });
        if (da) {
          return { ok: true, msg: 'Đã ghi trước đó (refKey, đua)', balance: await this.getBalanceTrue(cusId),
                   detailId: da.id, alreadyApplied: true };
        }
      }
      return { ok: false, msg: `Lỗi giao dịch ví: ${(err as Error).message}`, balance: null };
    }

    if (!result.ok || result.detailId === undefined) return result;

    // GL SAU commit, NGOÀI transaction — lỗi GL KHÔNG rollback tiền
    try {
      await this.glmap.postWallet(result.detailId, type, money, {
        createdBy: author, description: `Ví ${cusId} — ${note}`.slice(0, 120), cusId, orderId: oid,
      });
    } catch { /* nuốt: sổ quản trị lỗi không được ảnh hưởng tiền */ }

    return result;
  }

  async getBalanceAvailable(cusId: string, excludeRequestId?: number): Promise<bigint> {
    cusId = (cusId ?? '').trim();
    if (!cusId) return 0n;
    return (await this.getBalanceTrue(cusId)) - (await this.hold.holdAmount(cusId, excludeRequestId));
  }

  async repairCache(cusId: string): Promise<bigint> {
    cusId = (cusId ?? '').trim();
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tbl_wallet WHERE cus_id = ${cusId} FOR UPDATE`;
      const agg = await tx.walletEntry.aggregate({ _sum: { money: true }, where: { cusId } });
      const bal = agg._sum.money ?? 0n;
      await tx.wallet.updateMany({ where: { cusId }, data: { total: bal } });
      return bal;
    });
  }
}
