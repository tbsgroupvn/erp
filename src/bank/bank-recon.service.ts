// src/bank/bank-recon.service.ts
//
// #09d L11, Task 3 (R10a/b) — đối soát bank TK01 và "rút quỹ/chuyển nội bộ chưa phiếu". CHỈ ĐỌC.
// Nguồn nguyên văn: prod @1894f76 `ajaxs/bank/recon_list.php` (đọc CSDL → `bank_recon_match`) và
// `ajaxs/account/fx_unaccounted.php`. Luật khớp ở hàm thuần `bank-recon.rules.ts`. Đặc tả 09d §7.1–7.2.
//
// Quyền (§9, chép prod): Super Admin HOẶC nhóm kế toán — `laSuperAdminHoacKeToan` (src/iam/accountant.ts,
// CÙNG định nghĩa với miễn SoD của ApprovalService). Route còn đòi `account.view` (lưới route-inventory
// bắt buộc mọi route có @RequirePerm; màn prod nằm trong `/account`). Service TỰ kiểm — fail-closed.
//
// Q-DOC-12 (mặc định): CHÉP PROD — chứng từ `status≠1` và dòng ĐÃ BỊ ĐẢO vẫn là ứng viên khớp (P-RC1,
// #95019), nhưng mỗi chứng từ mang cờ `chuaLenSo`/`laDongDao`/`daBiDao`/`canXem` để không bị giấu im lặng.
//
// DTO ALLOW-LIST: KHÔNG trả nội dung chuyển khoản (`tran_mess`), số tài khoản, `bankid` — nội dung chỉ dùng
// trong bộ nhớ để phân loại (`cat`).
//
// Khác prod CÓ CHỦ Ý (thứ tự — không đổi tập dòng): chứng từ `ORDER BY id` (prod không ORDER BY ⇒ thứ tự
// quét của MariaDB, quyết định hoà khi khớp 1-1/gộp); lệnh chi thêm `id` làm khoá phụ sau `cdate`.
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { laSuperAdminHoacKeToan } from '../iam/accountant';
import { DebitCat, ReconLink, bankReconDebitCat, bankReconMatch, vnMidnight } from './bank-recon.rules';

type Dec = Prisma.Decimal;
const Decimal = Prisma.Decimal;
const s = (d: Dec) => d.toFixed();
const TK = 'TK01';

interface DebitRaw { id: bigint; tran_amount: bigint | null; cdate: number | null; tran_mess: string | null }
interface DocRaw {
  hid: number; source_module: string; source_id: number; money: Dec | null; cdate: number | null; note: string | null;
  tran_id: bigint | null; status: number | null; reversal_of: number; da_bi_dao: boolean;
}
interface Debit { id: number; amount: Dec; date: number; content: string | null; cdate: number; cat: DebitCat }
interface Doc {
  module: string; id: number; amount: Dec; date: number;
  entryId: number; code: string; bankTranId: number; cdate: number; status: number | null; reversalOf: number;
  chuaLenSo: boolean; laDongDao: boolean; daBiDao: boolean; canXem: boolean;
}

function toDebit(r: DebitRaw): Debit {
  const cdate = Math.trunc(Number(r.cdate ?? 0));
  return { id: Number(r.id), amount: new Decimal(String(r.tran_amount ?? 0)), date: vnMidnight(cdate), content: r.tran_mess, cdate, cat: bankReconDebitCat(r.tran_mess) };
}
function toDoc(r: DocRaw): Doc {
  const chuaLenSo = r.status !== 1;
  const laDongDao = r.reversal_of > 0;
  const daBiDao = !!r.da_bi_dao;
  const cdate = Math.trunc(Number(r.cdate ?? 0));
  return {
    module: r.source_module, id: Math.trunc(Number(r.source_id)), amount: new Decimal(r.money ?? 0).abs(), date: vnMidnight(cdate),
    entryId: Number(r.hid), code: r.note ?? '', bankTranId: Number(r.tran_id ?? 0), cdate, status: r.status, reversalOf: r.reversal_of,
    chuaLenSo, laDongDao, daBiDao, canXem: chuaLenSo || laDongDao || daBiDao,
  };
}
const debitDto = (b: Debit) => ({ id: b.id, amount: s(b.amount), date: b.date, cdate: b.cdate, cat: b.cat });
const docDto = (d: Doc) => ({
  module: d.module, id: d.id, entryId: d.entryId, code: d.code, amount: s(d.amount), date: d.date, cdate: d.cdate,
  bankTranId: d.bankTranId, status: d.status, reversalOf: d.reversalOf,
  chuaLenSo: d.chuaLenSo, laDongDao: d.laDongDao, daBiDao: d.daBiDao, canXem: d.canXem,
});

@Injectable()
export class BankReconService {
  constructor(private prisma: PrismaService) {}

  private async canKeToan(uid: number): Promise<void> {
    if (!Number.isInteger(uid) || uid <= 0) throw new ForbiddenException('Không có quyền');
    const u = await this.prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
    if (!u || !u.isActive || !(await laSuperAdminHoacKeToan(this.prisma as any, { id: uid })))
      throw new ForbiddenException('Không có quyền');
  }

  private docSql(where: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`
      SELECT h.id AS hid, h.source_module, h.source_id, h.money, h.cdate, h.note, h.tran_id, h.status, h.reversal_of,
             EXISTS (SELECT 1 FROM tbl_account_histories rv WHERE rv.reversal_of = h.id) AS da_bi_dao
        FROM tbl_account_histories h
       WHERE h.tk_code = ${TK} AND h.type IN ('out', 'tranfer') AND ${where}`;
  }

  /** R10a — `recon_list.php`. `fd`/`td` epoch (đã tính mặc định ở controller), `win` số ngày ≥ 0. */
  async reconList(uid: number, fd: number, td: number, win = 3) {
    await this.canKeToan(uid);
    fd = Math.trunc(fd);
    td = Math.trunc(td);
    win = Math.max(0, Math.trunc(win));
    const deb = (await this.prisma.$queryRaw<DebitRaw[]>`
      SELECT id, tran_amount, cdate, tran_mess FROM tbl_bank_transaction
       WHERE tk_code = ${TK} AND tran_type = '-' AND status <> 'huy' AND cdate BETWEEN ${fd} AND ${td}
       ORDER BY cdate, id`).map(toDebit);
    const debIds = new Set(deb.map((b) => b.id));
    const dlo = fd - win * 86400;
    const dhi = td + win * 86400;
    const docs = (await this.prisma.$queryRaw<DocRaw[]>(this.docSql(Prisma.sql`h.cdate BETWEEN ${dlo} AND ${dhi} ORDER BY h.id`))).map(toDoc);
    const seen = new Set(docs.map((d) => d.module + '#' + d.id));

    const links = new Map<number, ReconLink>();
    const need = new Map<string, [string, number]>();
    const lk = deb.length
      ? await this.prisma.bankReconcileLink.findMany({
          where: { bankTranId: { in: [...debIds].map((x) => BigInt(x)) } },
          select: { bankTranId: true, docModule: true, docId: true, matchType: true, note: true },
          orderBy: { id: 'asc' },
        })
      : [];
    for (const r of lk) {
      const bid = Number(r.bankTranId);
      if (!debIds.has(bid)) continue; // chỉ quan tâm link của lệnh trong khoảng ngày đang xem
      links.set(bid, { matchType: r.matchType, docModule: r.docModule, docId: r.docId, note: r.note });
      if (r.matchType === 'manual' && r.docModule !== '' && r.docId > 0) {
        const k = r.docModule + '#' + r.docId;
        if (!seen.has(k)) need.set(k, [r.docModule, r.docId]);
      }
    }
    for (const [m, sid] of need.values()) {
      const [rr] = await this.prisma.$queryRaw<DocRaw[]>(
        this.docSql(Prisma.sql`h.source_module = ${m} AND h.source_id = ${sid} ORDER BY h.cdate DESC, h.id DESC LIMIT 1`),
      );
      if (rr) docs.push(toDoc(rr));
    }

    const kq = bankReconMatch(deb, docs, links, win);
    return {
      rows: kq.rows.map((r) => ({ bank: debitDto(r.bank), status: r.status, doc: r.doc ? docDto(r.doc) : null, matchType: r.matchType, note: r.note })),
      orphanDocs: kq.orphanDocs.map(docDto),
      totals: { bank: s(kq.totals.bank), matched: s(kq.totals.matched), unmatched: s(kq.totals.unmatched) },
      /** Q-DOC-12 — số chứng từ ứng viên (đã nạp) mang cờ cần xem */
      ungVienCanXem: docs.filter((d) => d.canXem).length,
    };
  }

  /** R10b — `fx_unaccounted.php`: lệnh chi TK01 60 ngày gần nhất; chứng từ ±3 ngày của khoảng đó. */
  async fxUnaccounted(uid: number, now: Date = new Date()) {
    await this.canKeToan(uid);
    const td = Math.floor(now.getTime() / 1000);
    const fd = td - 60 * 86400; // strtotime('-60 days') — VN không có DST
    const deb = (await this.prisma.$queryRaw<DebitRaw[]>`
      SELECT id, tran_amount, cdate, tran_mess FROM tbl_bank_transaction
       WHERE tk_code = ${TK} AND tran_type = '-' AND status <> 'huy' AND cdate BETWEEN ${fd} AND ${td}
       ORDER BY cdate DESC, id DESC`).map(toDebit);
    const docs = (await this.prisma.$queryRaw<DocRaw[]>(
      this.docSql(Prisma.sql`h.cdate BETWEEN ${fd - 3 * 86400} AND ${td + 3 * 86400} ORDER BY h.id`),
    )).map(toDoc);
    // đã link (SePay → phiếu) và đã neo (tbl_fx_transfers.bank_tran_id) — nạp 1 lần
    const linked = new Set((await this.prisma.bankReconcileLink.findMany({ select: { bankTranId: true } })).map((r) => Number(r.bankTranId)));
    const anchored = new Set(
      (await this.prisma.fxTransfer.findMany({ where: { bankTranId: { gt: 0 } }, select: { bankTranId: true } })).map((r) => Number(r.bankTranId)),
    );
    const cashRows: { id: number; cdate: number; amount: string; cat: 'cash' }[] = [];
    const reviewRows: { id: number; cdate: number; amount: string }[] = [];
    let cashTong = new Decimal(0);
    let transBank = new Decimal(0);
    let reviewTong = new Decimal(0);
    for (const b of deb) {
      if (b.cat === 'cash') {
        cashRows.push({ id: b.id, cdate: b.cdate, amount: s(b.amount), cat: 'cash' });
        cashTong = cashTong.plus(b.amount);
      } else if (b.cat === 'transfer') transBank = transBank.plus(b.amount);
      else if (!linked.has(b.id) && !anchored.has(b.id)) {
        reviewRows.push({ id: b.id, cdate: b.cdate, amount: s(b.amount) });
        reviewTong = reviewTong.plus(b.amount);
      }
    }
    // CHUYỂN NỘI BỘ: chỉ so NET (tổng lệnh bank vs tổng chứng từ fx_transfer). Không quy từng dòng.
    let transDoc = new Decimal(0);
    let canXemN = 0;
    let canXemTien = new Decimal(0);
    for (const d of docs) {
      if (d.module !== 'fx_transfer') continue;
      transDoc = transDoc.plus(d.amount);
      if (d.canXem) { canXemN++; canXemTien = canXemTien.plus(d.amount); }
    }
    const short = Decimal.max(0, transBank.minus(transDoc));
    return {
      ok: 1 as const,
      cashCount: cashRows.length,
      cashTotal: s(cashTong),
      cashRows,
      transferShort: s(short),
      reviewCount: reviewRows.length,
      reviewTotal: s(reviewTong),
      reviewRows,
      /** Q-DOC-12 — phần của Σ chứng từ fx_transfer đến từ chứng từ status≠1 / dòng đảo / đã bị đảo (vẫn trừ như prod) */
      transferDocCanXem: { n: canXemN, amount: s(canXemTien) },
    };
  }
}
