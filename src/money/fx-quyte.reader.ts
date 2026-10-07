// src/money/fx-quyte.reader.ts
//
// #09d L11, Task 3 (R8d) — ĐỌC CSDL → đầu vào `fxqTinh()`. CHỈ ĐỌC. Nguồn nguyên văn: prod
// `libs/fx_quyte.php::fxq_doc_du_lieu` (:148-212) @1894f76. Đặc tả 09d §5.3 "Đọc dữ liệu".
// KHÔNG kiểm quyền ở đây — tầng service (`TreasuryReportService.quyTe`) gác `report.report_fxquyte`.
//
// Khác prod CÓ CHỦ Ý (thứ tự, không đổi tập dòng):
//  - Câu `quydoi` (UNION ALL không ORDER BY ở prod ⇒ thứ tự do MariaDB) sắp tường minh theo (nhánh, id);
//    thứ tự này chỉ phân xử các lần quy đổi CÙNG `created_at` (fxqTinh sắp lại theo ts, rồi thứ tự nạp).
//  - Mọi `ORDER BY cdate/created_at` thêm `id` làm khoá phụ (prod đã có `, id` ở đa số câu).
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TreasuryService } from './treasury.service';
import { dieuKienHoFxSql } from '../treasury/report-rules';
import { FxqInput } from './fx-quyte';

type Dec = Prisma.Decimal;
const Decimal = Prisma.Decimal;

@Injectable()
export class FxQuyTeReader {
  constructor(private prisma: PrismaService, private treasury: TreasuryService) {}

  async docDuLieu(from: number, to: number): Promise<FxqInput> {
    const inp: FxqInput = {
      from: Math.trunc(from), to: Math.trunc(to), usdLots: [], quydoi: [], cnyLots: [], cnyMoDau: new Decimal(0),
      cnyVaoKhac: [], cnyRa: [], usdThang: [], usdKhac: new Decimal(0), soDuCny: new Decimal(0), soDuUsd: new Decimal(0),
    };
    // Ví CNY/USD — KHÔNG lọc is_active (như prod).
    const accs = await this.prisma.fundAccount.findMany({
      where: { currency: { in: ['CNY', 'USD'] } },
      select: { code: true, currency: true, openingBalance: true },
      orderBy: { id: 'asc' },
    });
    const cny: string[] = [];
    const usd: string[] = [];
    let moDau = new Decimal(0);
    let usdKhac = new Decimal(0);
    for (const a of accs) {
      if (a.currency === 'CNY') { cny.push(a.code); moDau = moDau.plus(a.openingBalance); }
      else { usd.push(a.code); usdKhac = usdKhac.plus(a.openingBalance); }
    }
    const bal = await this.treasury.getBalances();
    let soDuCny = new Decimal(0);
    let soDuUsd = new Decimal(0);
    for (const c of cny) soDuCny = soDuCny.plus(bal.get(c) ?? 0);
    for (const c of usd) soDuUsd = soDuUsd.plus(bal.get(c) ?? 0);
    inp.cnyMoDau = moDau;
    inp.soDuCny = soDuCny;
    inp.soDuUsd = soDuUsd;

    const lots = await this.prisma.$queryRaw<{ amount_in: Dec; rate: Dec; created_at: number }[]>`
      SELECT amount_in, rate, created_at FROM tbl_fx_transfers
       WHERE status = 'approved' AND from_currency = 'VND' AND to_currency = 'USD' ORDER BY created_at, id`;
    inp.usdLots = lots.map((r) => ({ ts: Number(r.created_at), qty: new Decimal(r.amount_in), rate: new Decimal(r.rate) }));
    // Quy đổi = chặng 2 của phiếu 2 chặng + phiếu USD→CNY độc lập (UNION ALL — một phiếu thoả CẢ HAI nhánh
    // xuất hiện HAI lần, như prod).
    const qd = await this.prisma.$queryRaw<{ id: number; code: string; note: string | null; created_at: number; usd: Dec; cny: Dec; ar: Dec }[]>`
      SELECT id, code, note, created_at, usd, cny, ar FROM (
        SELECT 1 AS nhanh, id, code, note, created_at, amount_in AS usd, agent_amount AS cny, agent_rate AS ar
          FROM tbl_fx_transfers WHERE status = 'approved' AND agent_tk <> '' AND agent_rate > 0
        UNION ALL
        SELECT 2 AS nhanh, id, code, note, created_at, amount_out AS usd, amount_in AS cny, rate AS ar
          FROM tbl_fx_transfers WHERE status = 'approved' AND from_currency = 'USD' AND to_currency = 'CNY'
      ) q ORDER BY nhanh, id`;
    inp.quydoi = qd.map((r) => ({
      ts: Number(r.created_at), fxId: Number(r.id), code: String(r.code), note: r.note === null ? '' : String(r.note),
      usd: new Decimal(r.usd), cny: new Decimal(r.cny), agentRate: new Decimal(r.ar),
    }));
    const cl = await this.prisma.$queryRaw<{ amount_in: Dec; rate: Dec; created_at: number }[]>`
      SELECT amount_in, rate, created_at FROM tbl_fx_transfers
       WHERE status = 'approved' AND from_currency = 'VND' AND to_currency = 'CNY' ORDER BY created_at, id`;
    inp.cnyLots = cl.map((r) => ({ ts: Number(r.created_at), qty: new Decimal(r.amount_in), rate: new Decimal(r.rate) }));

    // Dòng sổ quỹ họ FX đã được thay bằng dữ liệu phiếu ở trên ⇒ loại khỏi dòng "khác". Thêm '' (chân chưa
    // gắn nhãn của đường self_fxTransferExecute cũ) — riêng ở báo cáo này. 'fx_fee' KHÔNG thuộc họ này.
    const FXFAM = Prisma.sql`(${dieuKienHoFxSql('h')} OR h.source_module = '')`;
    if (usd.length) {
      const [r] = await this.prisma.$queryRaw<{ s: Dec }[]>`
        SELECT COALESCE(SUM(h.money), 0) AS s FROM tbl_account_histories h
         WHERE h.status = 1 AND h.tk_code IN (${Prisma.join(usd)}) AND NOT ${FXFAM}`;
      usdKhac = usdKhac.plus(r.s);
    }
    inp.usdKhac = usdKhac;
    if (!cny.length) return inp; // prod `if(!$cny) return $in;` — KHÔNG đọc cả usd_thang (chép nguyên)

    const vao = await this.prisma.$queryRaw<{ money: Dec; cdate: number | null }[]>`
      SELECT h.money, h.cdate FROM tbl_account_histories h
       WHERE h.status = 1 AND h.tk_code IN (${Prisma.join(cny)}) AND h.money > 0 AND NOT ${FXFAM}
       ORDER BY h.cdate, h.id`;
    inp.cnyVaoKhac = vao.map((r) => ({ ts: Math.trunc(Number(r.cdate ?? 0)), qty: new Decimal(r.money) }));

    const ra = await this.prisma.$queryRaw<{
      cdate: number | null; money: Dec; pid: number | null; pst: string | null; ppay: string | null; pcf: string | null;
      code_order: string | null; oid: string | null; rate_sell: number | null; cus_id: string | null; saler: string | null;
    }[]>`
      SELECT h.cdate, h.money, p.id AS pid, p.status AS pst, p.payment AS ppay, p.confirm AS pcf, p.code_order,
             o.oid, o.rate_sell, o.cus_id, o.saler
        FROM tbl_account_histories h
        LEFT JOIN tbl_payment p ON h.source_module = 'payment' AND p.id = h.source_id
        LEFT JOIN tbl_order o ON o.id = p.order_id
       WHERE h.status = 1 AND h.tk_code IN (${Prisma.join(cny)}) AND h.money < 0 AND NOT ${FXFAM}
       ORDER BY h.cdate, h.id`;
    inp.cnyRa = ra.map((r) => ({
      ts: Math.trunc(Number(r.cdate ?? 0)), qty: new Decimal(r.money).neg(),
      ok: r.pst === 'yes' && r.ppay === 'yes' && r.pcf === 'yes',
      rateSell: r.rate_sell === null ? null : new Decimal(r.rate_sell),
      codeOrder: r.code_order ?? '', oid: r.oid ?? '', cusId: r.cus_id ?? '', saler: r.saler ?? '', pid: Number(r.pid ?? 0),
    }));

    const ut = await this.prisma.$queryRaw<{
      pid: number; cdate: number | null; price_cyn: Dec | null; rate_buy: number | null; code_order: string | null;
      oid: string | null; rate_sell: number | null; cus_id: string | null; saler: string | null;
    }[]>`
      SELECT p.id AS pid, p.cdate, p.price_cyn, p.rate_buy, p.code_order, o.oid, o.rate_sell, o.cus_id, o.saler
        FROM tbl_payment p LEFT JOIN tbl_order o ON o.id = p.order_id
       WHERE p.status = 'yes' AND p.payment = 'yes' AND p.confirm = 'yes'
         AND p.cdate >= ${Math.trunc(from)} AND p.cdate < ${Math.trunc(to)}
         AND COALESCE(p.account_code, '') NOT IN (${Prisma.join(cny)})
         AND (p.rate_buy <= 1 OR p.rate_buy BETWEEN 20000 AND 30000)
       ORDER BY p.cdate, p.id`;
    inp.usdThang = ut.map((r) => ({
      ts: Math.trunc(Number(r.cdate ?? 0)), qty: new Decimal(r.price_cyn ?? 0), rateBuy: new Decimal(r.rate_buy ?? 0),
      rateSell: r.rate_sell === null ? null : new Decimal(r.rate_sell), codeOrder: r.code_order ?? '',
      oid: r.oid ?? '', cusId: r.cus_id ?? '', saler: r.saler ?? '', pid: Number(r.pid),
    }));
    return inp;
  }
}
