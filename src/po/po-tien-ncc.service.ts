// src/po/po-tien-ncc.service.ts
//
// #09d L11, Task 3 (R8c) — tiền NCC của một PO (`libs/po_tien_ncc.php` @1894f76), CHỈ ĐỌC. Công thức ở
// hàm thuần `poTienNccTinh` (po-tien-ncc.rules.ts); đây chỉ đọc CSDL + gác phạm vi.
//
// Quyền (đặc tả 09d §9): `po.view` + phạm vi PO. Phạm vi = `buildDocScope('po.view', uid, {saler:'createdBy'})`
// — đúng luật `PoService.listForUser` (#06). Service TỰ kiểm (không dựa riêng vào ScopeGuard khi bị gọi
// nơi khác): PO không tồn tại / ngoài phạm vi / không có quyền ⇒ CÙNG MỘT 404, MỘT truy vấn (fail-closed).
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../iam/scope.service';
import { PtnEntry, PtnPhieu, PtnResult, poCoPhieuThuNccTinh, poTienNccTinh } from './po-tien-ncc.rules';

type Dec = Prisma.Decimal;
const s = (d: Dec) => d.toFixed();
const map = (o: Record<string, Dec>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, s(v)]));
const phieuDto = (p: PtnPhieu) => ({ ...p, tien: s(p.tien) });

@Injectable()
export class PoTienNccService {
  constructor(private prisma: PrismaService, private scope: ScopeService) {}

  /** PO trong phạm vi `po.view` của uid — MỘT truy vấn gộp định danh + phạm vi. */
  private async canXemPo(uid: number, poId: number): Promise<void> {
    if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(poId) || poId <= 0 || poId > 2147483647)
      throw new NotFoundException('Không tìm thấy');
    const where = await this.scope.buildDocScope('po.view', uid, { saler: 'createdBy', salerOther: null });
    const hit = await this.prisma.purchaseOrder.findFirst({ where: { AND: [{ id: poId }, where] }, select: { id: true } });
    if (!hit) throw new NotFoundException('Không tìm thấy');
  }

  /** Đọc CSDL → `poTienNccTinh` (không kiểm quyền — chỉ gọi sau `canXemPo`). */
  private async tinh(poId: number): Promise<PtnResult> {
    const payRows = await this.prisma.supplierPayment.findMany({
      where: { poId, payType: 'supplier' },
      select: { currency: true, priceCyn: true, status: true, confirm: true },
    });
    const refunds = await this.prisma.$queryRaw<{ id: number; object_code: string | null; form_data: string | null; submitted_by: string | null }[]>`
      SELECT r.id, r.object_code, r.form_data, r.submitted_by
        FROM tbl_approval_requests r
        JOIN tbl_approval_templates t ON t.id = r.template_id
       WHERE t.code = 'thu_ncc_hoan_tien' AND r.status = 2 AND COALESCE(r.is_deleted, false) = false
       ORDER BY r.id DESC`;
    // Dòng sổ ĐẦU TIÊN status=1 (prod `LIMIT 1` không ORDER BY — v2 cố định theo id). KHÔNG loại dòng đã bị
    // đảo (P-PT3) — chỉ đọc thêm cờ `da_bi_dao` để gắn nhãn.
    const ids = refunds.map((r) => Number(r.id));
    const entries = ids.length
      ? await this.prisma.$queryRaw<{ source_id: number; tk_code: string | null; money: Dec | null; da_bi_dao: boolean }[]>`
          SELECT DISTINCT ON (h.source_id) h.source_id, h.tk_code, h.money,
                 EXISTS (SELECT 1 FROM tbl_account_histories rv WHERE rv.reversal_of = h.id) AS da_bi_dao
            FROM tbl_account_histories h
           WHERE h.source_module = 'thu_chi_tbs' AND h.source_id IN (${Prisma.join(ids)}) AND h.status = 1
           ORDER BY h.source_id, h.id`
      : [];
    const byRid = new Map<number, PtnEntry>(entries.map((e) => [Number(e.source_id), { tkCode: e.tk_code, money: e.money, daBiDao: e.da_bi_dao }]));
    const accs = await this.prisma.fundAccount.findMany({ select: { code: true, currency: true } });
    const accCur = new Map(accs.map((a) => [a.code.toUpperCase(), String(a.currency).toUpperCase()]));
    return poTienNccTinh(
      poId,
      payRows.map((p) => ({ currency: p.currency, priceCyn: p.priceCyn, status: p.status, confirm: p.confirm })),
      refunds.map((r) => ({ id: Number(r.id), objectCode: r.object_code, formData: r.form_data, submittedBy: r.submitted_by })),
      (rid) => byRid.get(rid),
      accCur,
    );
  }

  async poTienNcc(uid: number, poId: number) {
    await this.canXemPo(uid, poId);
    const t = await this.tinh(poId);
    return {
      poId,
      chi: map(t.chi),
      thu: map(t.thu),
      con: map(t.con),
      chiDaDuyet: map(t.chiDaDuyet),
      chiChoDuyet: map(t.chiChoDuyet),
      soPhieuChi: t.soPhieuChi,
      phieu: t.phieu.map(phieuDto),
      moHo: t.moHo.map(phieuDto),
      coPhieuThu: poCoPhieuThuNccTinh(t),
    };
  }

  /** `po_co_phieu_thu_ncc` — cùng cổng phạm vi. */
  async poCoPhieuThuNcc(uid: number, poId: number): Promise<boolean> {
    await this.canXemPo(uid, poId);
    return poCoPhieuThuNccTinh(await this.tinh(poId));
  }
}
