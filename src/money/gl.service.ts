import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { codeOrNull, idOrNull } from '../common/money';

type D = number | string;
export type GlLineInput = { accountCode: string; debit: D; credit: D; currency?: string; amountCcy?: D; fxRate?: D; cusId?: string; orderId?: number; note?: string };
export type GlEntryInput = { entryDate: number; sourceType: string; sourceId: number | bigint; description?: string; createdBy?: string; lines: GlLineInput[]; reversalOf?: number; reversalReason?: string };

@Injectable()
export class GlService {
  static readonly EPS = 0.01;
  constructor(private prisma: PrismaService) {}

  findBySource(sourceType: string, sourceId: number | bigint) {
    const sid = BigInt(sourceId);
    return this.prisma.glEntry.findUnique({ where: { sourceType_sourceId: { sourceType, sourceId: sid } } });
  }

  async post(e: GlEntryInput): Promise<{ status: 'posted' | 'exists' | 'error'; entryId?: number; reason?: string }> {
    const sid = BigInt(e.sourceId);
    const existing = await this.findBySource(e.sourceType, sid);
    if (existing) return { status: 'exists', entryId: existing.id };

    if (e.lines.length < 2) return { status: 'error', reason: 'cần ≥2 dòng' };

    const dr = e.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const cr = e.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (Math.abs(dr - cr) > GlService.EPS) return { status: 'error', reason: `lệch Nợ-Có ${dr} vs ${cr}` };

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const entry = await tx.glEntry.create({ data: {
          // Placeholder must itself be collision-proof: two concurrent posts (even with
          // different sourceId) sharing entryDate would otherwise race on a fixed
          // placeholder and trip the new entryNo unique constraint for the wrong reason.
          entryNo: `PENDING-${randomUUID()}`, entryDate: e.entryDate,
          sourceType: e.sourceType, sourceId: sid, description: e.description ?? '',
          totalDebit: dr.toFixed(2), totalCredit: cr.toFixed(2), createdBy: e.createdBy ?? '', cdate: e.entryDate,
          reversalOf: idOrNull(e.reversalOf), reversalReason: e.reversalReason ?? null,
        }});
        // entry.id is guaranteed unique (autoincrement) -> entryNo derived from it is unique too.
        const entryNo = `GL-${e.entryDate}-${String(entry.id).padStart(6, '0')}`;
        await tx.glEntry.update({ where: { id: entry.id }, data: { entryNo } });
        await tx.glLine.createMany({ data: e.lines.map((l, i) => ({
          entryId: entry.id, lineNo: i + 1, accountCode: l.accountCode,
          debit: Number(l.debit || 0).toFixed(2), credit: Number(l.credit || 0).toFixed(2),
          currency: l.currency ?? 'VND', amountCcy: (l.amountCcy ?? 0).toString(), fxRate: (l.fxRate ?? 0).toString(),
          cusId: codeOrNull(l.cusId), orderId: idOrNull(l.orderId), note: l.note ?? null,
        }))});
        return { ...entry, entryNo };
      });
      return { status: 'posted', entryId: created.id };
    } catch (err) {
      // Va race: source uniqueness vi pham -> coi nhu exists
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const again = await this.findBySource(e.sourceType, sid);
        if (again) return { status: 'exists', entryId: again.id };
      }
      return { status: 'error', reason: String((err as Error).message) };
    }
  }

  async reverse(entryId: number, by: string, reason: string): Promise<{ status: 'posted' | 'exists' | 'error'; entryId?: number; reason?: string }> {
    const orig = await this.prisma.glEntry.findUnique({ where: { id: entryId }, include: { lines: true } });
    if (!orig) return { status: 'error' };
    // Q5 — nhận ra bút toán ĐÃ ĐẢO theo CẢ HAI quy ước, không chỉ 'daoxoa_*' của hệ mới.
    // Prod (libs/cls.gl.php::reverse) ghi ('reversal', X) + reversal_of=X (UPDATE riêng, có thể
    // hỏng ⇒ reversal_of rỗng) và đặt status=-1 cho X. Thiếu hai vế này, dữ liệu đã migrate
    // (25 bút toán) sẽ bị đảo LẦN HAI. KHÔNG chặn đảo bút toán 'reversal' chưa bị đảo: prod cho
    // phép (21 ca thật, chuỗi đảo nhiều tầng).
    const prior = await this.prisma.glEntry.findFirst({
      where: { OR: [{ reversalOf: orig.id }, { sourceType: 'reversal', sourceId: BigInt(orig.id) }] },
      orderBy: { id: 'asc' },
    });
    if (prior) return { status: 'exists', entryId: prior.id };
    if (orig.status === -1) return { status: 'error', reason: `Bút toán ${orig.entryNo} đã bị đảo rồi (status=-1).` };
    return this.post({
      entryDate: orig.entryDate, sourceType: `daoxoa_${orig.sourceType}`, sourceId: orig.id,
      description: `Đảo ${orig.entryNo}: ${reason}`, createdBy: by,
      reversalOf: orig.id, reversalReason: reason,
      lines: orig.lines.map((l) => ({
        accountCode: l.accountCode, debit: l.credit.toString(), credit: l.debit.toString(),
        currency: l.currency, amountCcy: l.amountCcy.toString(), fxRate: l.fxRate.toString(),
        cusId: l.cusId ?? undefined, orderId: l.orderId ?? undefined, note: l.note ?? undefined,
      })),
    });
  }
}
