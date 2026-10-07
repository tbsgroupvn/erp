import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GlService } from './gl.service';
import { WALLET_BIZ_TYPE, isTestCustomer, nowSec } from '../common/money';

export interface PostBizOpts {
  /** Mã ví quỹ (`tbl_accounts.code`) tiền thực ra/vào — thay VẾ TIỀN (`money_side`) bằng `gl_account` của ví. */
  tkVi?: string;
  /** Cửa thoát chốt dữ liệu thử (prod `cho_phep_du_lieu_thu`, `patch_cua_test.py`). */
  choPhepDuLieuThu?: boolean;
  cusId?: string;
  createdBy?: string;
  entryDate?: number;
  description?: string;
  orderId?: number;
  currency?: string;
  amountCcy?: number | string;
  fxRate?: number | string;
  // dims saler/po_id/container_id/store: GlLine v2 chưa có cột (việc #03) — nhận nhưng chưa ghi.
  [k: string]: unknown;
}

/**
 * `laDuLieuThu($source_type, $opts)` (`cls.glmap.php:55-66`) — HÀM THUẦN. Ba dấu hiệu:
 *  - khách tiền tố ZZ (ZZREG_*, ZZQA_*…);
 *  - người tạo tiền tố zz, hoặc đúng 'reg' / 'regression';
 *  - nguồn chứng từ tiền tố zz (vd `zzreg_glmap`).
 * Cửa `choPhepDuLieuThu` do postBiz xét (prod đặt ở nơi gọi hàm này), không ở đây.
 */
export function laDuLieuThu(sourceType: string, opts: { cusId?: unknown; createdBy?: unknown } = {}): boolean {
  if (isTestCustomer(String(opts.cusId ?? ''))) return true;
  const by = String(opts.createdBy ?? '').trim().toLowerCase();
  if (by !== '' && (by.startsWith('zz') || by === 'reg' || by === 'regression')) return true;
  const src = String(sourceType ?? '').trim().toLowerCase();
  return src !== '' && src.startsWith('zz');
}

/**
 * `apDungViVaoCapTK($dr, $cr, $money_side, $gl_acc)` (`cls.glmap.php:88-95`) — HÀM THUẦN.
 * Ví chưa khai TK (`gl=''`) ⇒ GIỮ cặp cũ (ghi vào TK rỗng là bút toán hỏng). `money_side` so
 * ĐÚNG 'debit'/'credit' (không trim, không hạ chữ — 'CREDIT' coi như rỗng, GLVI-15).
 * ⚠ KHÔNG suy vế tiền theo tiền tố mã TK: 138 vừa là ví cá nhân vừa là phải thu khác.
 */
export function apDungViVaoCapTK(dr: string, cr: string, moneySide: string, gl: string): [string, string] {
  const d = String(dr ?? '').trim();
  const c = String(cr ?? '').trim();
  const g = String(gl ?? '').trim();
  const side = String(moneySide ?? '');
  if (g === '') return [d, c];
  if (side === 'debit') return [g, c];
  if (side === 'credit') return [d, g];
  return [d, c];
}

/**
 * PHP `round(floatval($x), 2)` bằng Decimal: nửa-xa-số-0 (ROUND_HALF_UP của decimal.js), không
 * qua float (0.285 ⇒ 0.29 như PHP, float/Math.round cho 0.28). Không đọc được ⇒ 0 (floatval rác = 0).
 */
function round2(x: Prisma.Decimal | string | number): Prisma.Decimal {
  let d: Prisma.Decimal;
  try {
    d = new Prisma.Decimal(typeof x === 'string' ? x.trim() : x);
  } catch {
    return new Prisma.Decimal(0);
  }
  if (!d.isFinite()) return new Prisma.Decimal(0);
  return d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

@Injectable()
export class GlMapService {
  constructor(private prisma: PrismaService, private gl: GlService) {}

  walletBizType(type: number): string | null {
    return WALLET_BIZ_TYPE[type] ?? null;
  }

  balanceFx(outVnd: number, inVnd: number) {
    const lech = Math.round((inVnd - outVnd) * 100) / 100;
    if (Math.abs(lech) < 0.01) return null;
    if (lech > 0) return { accountCode: '515', debit: 0, credit: lech };
    return { accountCode: '635', debit: -lech, credit: 0 };
  }

  /**
   * `taiKhoanCuaVi($tk_code)` (`cls.glmap.php:69-76`) — TK kế toán của một ví quỹ.
   * '' nếu mã rỗng, ví không tồn tại, hoặc kế toán chưa khai (`gl_account=''`, vd TK07).
   * Không lọc `is_active` (prod không lọc).
   */
  async taiKhoanCuaVi(tkCode: string): Promise<string> {
    const code = String(tkCode ?? '').trim();
    if (code === '') return '';
    const a = await this.prisma.fundAccount.findUnique({ where: { code }, select: { glAccount: true } });
    return a ? String(a.glAccount ?? '').trim() : '';
  }

  /**
   * `CLS_GLMAP::postBiz` (`cls.glmap.php:121-190`, đặc tả 09b §7.1/§10.3).
   *
   * Thứ tự y prod: làm tròn tiền ⇒ chốt dữ liệu thử ⇒ ánh xạ (có/bật/duyệt) ⇒ vế tiền theo ví
   * (`opts.tkVi` + `money_side`) ⇒ Nợ/Có rỗng thì bỏ ⇒ ghi GL. Người gọi KHÔNG truyền `tkVi` được
   * đúng cặp TK của ánh xạ như trước. Mọi lỗi ⇒ `{status:'error'}`, không ném (prod `:185-189`) —
   * GL là sổ quản trị, chạy SAU commit nghiệp vụ, không được làm hỏng luồng tiền.
   */
  async postBiz(
    bizType: string,
    sourceType: string,
    sourceId: number | bigint,
    amount: Prisma.Decimal | string | number,
    opts: PostBizOpts = {},
  ): Promise<{ status: 'posted' | 'exists' | 'skipped' | 'error'; entryId?: number; reason?: string }> {
    try {
      const amt = round2(amount);
      if (amt.lte(0)) return { status: 'skipped' as const, reason: 'số tiền ≤ 0' };
      if (!opts.choPhepDuLieuThu && laDuLieuThu(sourceType, opts)) {
        return { status: 'skipped' as const, reason: 'dữ liệu thử (ZZ / reg / zz*)' };
      }
      const m = await this.prisma.glMapping.findUnique({ where: { bizType } });
      if (!m) return { status: 'skipped' as const, reason: `chưa khai ánh xạ "${bizType}"` };
      if (!m.active) return { status: 'skipped' as const, reason: 'ánh xạ tắt' };
      if (!m.isApproved) return { status: 'skipped' as const, reason: 'ánh xạ chưa kế toán duyệt' };

      let dr = String(m.debitAccount ?? '').trim();
      let cr = String(m.creditAccount ?? '').trim();
      // `:88-95` — vế tiền lấy theo ví thực tế; ví chưa khai TK ⇒ giữ cặp ánh xạ.
      const tkVi = String(opts.tkVi ?? '').trim();
      if (tkVi !== '' && String(m.moneySide ?? '').trim() !== '') {
        [dr, cr] = apDungViVaoCapTK(dr, cr, String(m.moneySide), await this.taiKhoanCuaVi(tkVi));
      }
      if (dr === '' || cr === '') return { status: 'skipped' as const, reason: 'ánh xạ thiếu tài khoản Nợ/Có' };

      const tien = amt.toFixed(2);
      return await this.gl.post({
        entryDate: opts.entryDate ?? nowSec(), sourceType, sourceId,
        description: opts.description ?? m.bizLabel, createdBy: opts.createdBy ?? '',
        lines: [
          { accountCode: dr, debit: tien, credit: 0, cusId: opts.cusId, orderId: opts.orderId, currency: opts.currency, amountCcy: opts.amountCcy, fxRate: opts.fxRate, note: m.bizLabel },
          { accountCode: cr, debit: 0, credit: tien, cusId: opts.cusId, orderId: opts.orderId, currency: opts.currency, amountCcy: opts.amountCcy, fxRate: opts.fxRate, note: m.bizLabel },
        ],
      });
    } catch {
      // Không trả chuỗi lỗi thô ra ngoài (lưới no-raw-exception-leak) — giống prod chỉ báo 'error'.
      return { status: 'error' as const, reason: 'lỗi ghi GL' };
    }
  }

  async postWallet(detailId: number | bigint, type: number, money: bigint, opts: any = {}) {
    const bizType = this.walletBizType(type);
    if (!bizType) return { status: 'skipped' as const, reason: `type ${type} không có ánh xạ` };
    return this.postBiz(bizType, 'wallet_detail', detailId, Math.abs(Number(money)), opts);
  }
}
