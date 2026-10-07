// src/treasury/treasury-report.service.ts
//
// #09d L11 — đường ĐỌC báo cáo sổ quỹ (KHÔNG ghi gì). Đặc tả docs/rewrite-spec/09d-so-quy-doc-bao-cao.md.
// Task 1: sao kê tài khoản (R5, `libs/account_statement.php::tbs_sk_doc` :86-161) — §2.1–2.2, DTO §2.5.
// Task 2: dòng tiền `monthlyFlow` (R6, §3), quỹ trong kỳ BGĐ bản SỬA `quyTrongKy` (R9, §6.3, Q-DOC-1),
//         `costSummary`/`costByRef` (R8a/b, §5.1, Q-DOC-8), rà trùng `suspectDuplicates` (R10c, §7.3,
//         Q-DOC-12). Nguồn: `cls.treasury.php` :301-343 (getRate/toVnd), :444-486, :1159-1194, :1344-1408.
// Task 3: lợi nhuận quỹ ngoại tệ `quyTe` (R8d, §5.3) — đọc qua `FxQuyTeReader`, tính bằng hàm thuần
//         `fxqTinh` (src/money/fx-quyte.ts). R8c ở src/po/po-tien-ncc.service.ts; R10a/b ở src/bank/.
//
// Quyền (§9): `account.view` + `account.stats`, cả hai phạm vi `all` (sổ quỹ không có chủ sở hữu —
// cùng luật `allOnly` của ScopeGuard entity `fundAccount`). Service TỰ kiểm lại để không phụ thuộc riêng
// vào guard khi bị gọi từ nơi khác (fail-closed ⇒ 404 giống mã không tồn tại).
//
// DTO là ALLOW-LIST: KHÔNG trả `stk`/`bankCode` (Q-DOC-9, P-SK3) — không bao giờ đọc hai cột đó ra.
// Tiền: Prisma.Decimal suốt, trả chuỗi Decimal (định dạng hiển thị là việc của UI — L12).
//
// Khác prod CÓ CHỦ Ý (ghi rõ để review):
//  - Mã quỹ lạ / rỗng ⇒ 404 (P-SK1: prod ra trang trống "0 đ" — Q-DOC-11 mặc định SỬA).
//  - Ngày khớp mẫu `YYYY-MM-DD` nhưng PHP `strtotime` trả false (tháng > 12, ngày > 31) ⇒ 400; prod
//    ghép `cdate < ` rỗng vào SQL ⇒ câu hỏng, KPI rác.
//  - `q` và `loai` dùng ILIKE: prod là LIKE trên collation `_ci` của MariaDB (không phân biệt hoa/thường);
//    Postgres LIKE phân biệt ⇒ ILIKE mới giữ đúng hành vi. (Không bắt chước phần "không phân biệt dấu"
//    của `utf8mb4_unicode_ci` — cần extension `unaccent`, ngoài phạm vi.) Ký tự `\` trong `q` được thoát
//    thành ký tự thường (prod: `addslashes` + LIKE làm `\` thành ký tự thoát của ký tự kế tiếp).
//  - Thứ tự `nguonList` hoà số dòng ⇒ sắp thêm theo mã (prod: thứ tự không xác định); `bankList` sắp theo
//    giá trị (prod: `DISTINCT … LIMIT 50` không ORDER BY).
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PermService } from '../iam/perm.service';
import { TreasuryService } from '../money/treasury.service';
import { FxQuyTeReader } from '../money/fx-quyte.reader';
import { fxqTinh } from '../money/fx-quyte';
import {
  StatementFilter,
  TBS_SK_TRAN,
  chieuDong,
  clusterSuspectDuplicates,
  dieuKienHoFxSql,
  nhanNguon,
  noiDungDong,
  phpIntval,
  soDuChay,
  tbsSkLocPhu,
  trangThai,
  vnEpoch,
  vnYmd,
} from './report-rules';

type Dec = Prisma.Decimal;
const Decimal = Prisma.Decimal;
const PERMS_SAO_KE = ['account.view', 'account.stats'];
const VN_OFFSET_SEC = 7 * 3600;
type Cur = 'VND' | 'CNY' | 'USD';
type Rates = { CNY: Dec; USD: Dec };
const PHP_INT_MAX = 9223372036854775807n;

/** Decimal ⇒ chuỗi ký pháp thường (giống `TreasuryReadService.s()`). */
const s = (d: Dec | null | undefined) => (d === null || d === undefined ? null : new Decimal(d).toFixed());

interface RawRow {
  id: number;
  cdate: number | null;
  type: string | null;
  money: Dec | null;
  rate: Dec | null;
  status: number | null;
  note: string | null;
  source_module: string;
  source_id: number;
  reversal_of: number;
  tran_id: bigint | null;
  order_code: string;
  po_id: number;
  bank_info: string | null;
  cuser: string | null;
  approve_user: string | null;
  approve_date: number | null;
  approval_form_data: string | null;
}

export interface StatementRowDto {
  id: number;
  cdate: number | null;
  type: string | null;
  chieu: string;
  nguon: { ma: string; nhan: string; mau: string };
  noiDung: string;
  money: string | null;
  soDu: string | null;
  rate: string | null;
  status: number | null;
  trangThai: string;
  reversalOf: number;
  tranId: string | null;
  orderCode: string;
  poId: number;
  bankInfo: string | null;
  cuser: string | null;
  approveUser: string | null;
  approveDate: number | null;
}

export interface StatementDto {
  account: { code: string; name: string; currency: string; accGroup: string; isActive: number };
  ky: { fdate: string; tdate: string };
  dauKy: string;
  kyVao: string;
  kyRa: string;
  kyNVao: number;
  kyNRa: number;
  cuoiKy: string;
  soDuVi: string | null;
  locVao: string;
  locRa: string;
  locN: number;
  coSoDuChay: boolean;
  catBot: boolean;
  nguonList: { ma: string; nhan: string; mau: string; n: number }[];
  coLoai: boolean;
  bankList: string[];
  trang: number;
  soTrang: number;
  tuDong: number;
  rows: StatementRowDto[];
}

/** Thoát `\`, `%`, `_` cho LIKE (ký tự thoát mặc định `\` của Postgres). */
function likeEscape(q: string): string {
  return q.replace(/[\\%_]/g, (c) => '\\' + c);
}

@Injectable()
export class TreasuryReportService {
  constructor(
    private prisma: PrismaService,
    private perm: PermService,
    private treasury: TreasuryService,
    private fxq: FxQuyTeReader,
  ) {}

  /** Sổ quỹ chỉ có phạm vi toàn công ty — MỌI quyền của route phải là `all` (fail-closed). */
  private async toanCongTy(uid: number, perms: string[]): Promise<boolean> {
    if (!uid || uid <= 0) return false;
    for (const p of perms) if ((await this.perm.scopeOf(p, uid)) !== 'all') return false;
    return true;
  }

  /**
   * R5 — `tbs_sk_doc($L, $gioiHan, $phanTrang)` (:86-161). `filter` = kết quả `tbsSkLoc()`; `code` là mã
   * ví (thay `$L['tk']`). `gioiHan` 0 ⇒ không giới hạn (file tải về). `phanTrang` ⇒ chỉ trả dòng của trang,
   * nhưng tổng + số dư chạy vẫn tính trên TOÀN BỘ dòng lọc được rồi mới cắt (:152-158).
   */
  async statement(
    uid: number,
    code: string,
    filter: StatementFilter,
    opts: { gioiHan?: number; phanTrang?: boolean } = {},
  ): Promise<StatementDto> {
    if (!(await this.toanCongTy(uid, PERMS_SAO_KE))) throw new NotFoundException('Không tìm thấy');
    if (typeof code !== 'string' || code === '') throw new NotFoundException('Không tìm thấy');
    // getAccount() prod KHÔNG lọc is_active (ví ẩn TK07 vẫn sao kê được — §2.3). Chỉ đọc cột allow-list.
    const acc = await this.prisma.fundAccount.findUnique({
      where: { code },
      select: { code: true, name: true, currency: true, accGroup: true, isActive: true, openingBalance: true },
    });
    if (!acc) throw new NotFoundException('Không tìm thấy');

    const L = filter;
    const tu = vnEpoch(L.fdate, '00:00:00');
    const den = vnEpoch(L.tdate, '23:59:59');
    if (tu === null || den === null) throw new BadRequestException('Ngày không hợp lệ');
    const gioiHan = Math.trunc(opts.gioiHan ?? TBS_SK_TRAN);
    const tk = acc.code;

    // ── KPI — KHÔNG phụ thuộc bộ lọc phụ (:98-108) ──
    const [truoc] = await this.prisma.$queryRaw<{ s: Dec }[]>`
      SELECT COALESCE(SUM(money), 0) AS s FROM tbl_account_histories
       WHERE tk_code = ${tk} AND status = 1 AND cdate < ${tu}`;
    const dauKy = new Decimal(acc.openingBalance).plus(truoc.s);
    const [ky] = await this.prisma.$queryRaw<{ vao: Dec; ra: Dec; nv: number; nr: number }[]>`
      SELECT COALESCE(SUM(CASE WHEN money > 0 THEN money ELSE 0 END), 0) AS vao,
             COALESCE(SUM(CASE WHEN money < 0 THEN -money ELSE 0 END), 0) AS ra,
             COUNT(*) FILTER (WHERE money > 0)::int AS nv,
             COUNT(*) FILTER (WHERE money < 0)::int AS nr
        FROM tbl_account_histories
       WHERE tk_code = ${tk} AND status = 1 AND cdate BETWEEN ${tu} AND ${den}`;
    const kyVao = new Decimal(ky.vao);
    const kyRa = new Decimal(ky.ra);
    const cuoiKy = dauKy.plus(kyVao).minus(kyRa);
    // Kỳ chạm "bây giờ" (−60s) mới so với số dư ví (:108).
    const soDuVi = den >= Math.floor(Date.now() / 1000) - 60 ? await this.treasury.getBalance(tk) : null;

    // ── Danh sách cho bộ lọc (:111-116) — mọi dòng của ví, mọi trạng thái, mọi kỳ ──
    const nguonRaw = await this.prisma.$queryRaw<{ m: string; n: number }[]>`
      SELECT source_module AS m, COUNT(*)::int AS n FROM tbl_account_histories
       WHERE tk_code = ${tk} GROUP BY source_module ORDER BY n DESC, source_module COLLATE "C" ASC`;
    const nguonList = nguonRaw.map((r) => {
      const [nhan, mau] = nhanNguon(r.m);
      return { ma: String(r.m), nhan, mau, n: Number(r.n) };
    });
    const [loai] = await this.prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM tbl_account_histories
       WHERE tk_code = ${tk} AND wallet_detail_id > 0 AND type IN ('in', 'out')`;
    const bankRaw = await this.prisma.$queryRaw<{ b: string }[]>`
      SELECT DISTINCT bank_info COLLATE "C" AS b FROM tbl_account_histories
       WHERE tk_code = ${tk} AND bank_info IS NOT NULL AND bank_info <> '' ORDER BY b LIMIT 50`;

    // ── Dòng giao dịch (:119-134) ──
    const w: Prisma.Sql[] = [Prisma.sql`h.tk_code = ${tk}`, Prisma.sql`h.cdate BETWEEN ${tu} AND ${den}`];
    if (L.tt !== 'all') w.push(Prisma.sql`h.status = ${Number(L.tt)}`);
    if (L.chieu === 'vao') w.push(Prisma.sql`h.money > 0 AND h.type <> 'tranfer'`);
    // ⚠ P-SK2 (đặc tả §11) — `ra` loại tranfer còn `chuyen` gồm cả họ FX ⇒ chân FX `in` nằm ở CẢ "vao"
    // lẫn "chuyen". Chép nguyên prod, ghim ở test/treasury/statement.spec.ts — ĐỪNG "sửa" ở đây.
    if (L.chieu === 'ra') w.push(Prisma.sql`h.money < 0 AND h.type <> 'tranfer'`);
    if (L.chieu === 'chuyen') w.push(Prisma.sql`(h.type = 'tranfer' OR ${dieuKienHoFxSql('h')})`);
    if (L.nguon !== '__all') w.push(Prisma.sql`h.source_module = ${L.nguon}`);
    if (L.q !== '') {
      const p = '%' + likeEscape(L.q) + '%';
      const parts = [
        Prisma.sql`h.note ILIKE ${p}`, Prisma.sql`h.order_code ILIKE ${p}`, Prisma.sql`h.cuser ILIKE ${p}`,
        Prisma.sql`h.approve_user ILIKE ${p}`, Prisma.sql`h.cus_id ILIKE ${p}`,
      ];
      if (/^\d+$/.test(L.q)) {
        // ctype_digit + intval (kẹp PHP_INT_MAX như PHP 64-bit).
        const n = BigInt(L.q) > PHP_INT_MAX ? PHP_INT_MAX : BigInt(L.q);
        parts.push(Prisma.sql`h.id = ${n}`, Prisma.sql`h.tran_id = ${n}`, Prisma.sql`h.source_id = ${n}`);
      }
      w.push(Prisma.sql`(${Prisma.join(parts, ' OR ')})`);
    }
    if (L.min !== null) w.push(Prisma.sql`ABS(h.money) >= ${L.min}`);
    if (L.max !== null) w.push(Prisma.sql`ABS(h.money) <= ${L.max}`);
    if (L.loai === 'TM') w.push(Prisma.sql`(h.type IN ('in', 'out') AND h.wallet_detail_id > 0 AND h.note ILIKE '%(TM)%')`);
    if (L.loai === 'CK') w.push(Prisma.sql`(h.type IN ('in', 'out') AND h.wallet_detail_id > 0 AND h.note ILIKE '%(CK%')`);
    if (L.bank !== '') w.push(Prisma.sql`h.bank_info = ${L.bank}`);
    const lim = gioiHan > 0 ? Prisma.sql`LIMIT ${gioiHan + 1}` : Prisma.empty;

    let raw = await this.prisma.$queryRaw<RawRow[]>`
      SELECT h.id, h.cdate, h.type, h.money, h.rate, h.status, h.note, h.source_module, h.source_id,
             h.reversal_of, h.tran_id, h.order_code, h.po_id, h.bank_info, h.cuser, h.approve_user,
             h.approve_date, r.form_data AS approval_form_data
        FROM tbl_account_histories h
        LEFT JOIN tbl_approval_requests r ON h.source_module = 'thu_chi_tbs' AND r.id = h.source_id
       WHERE ${Prisma.join(w, ' AND ')}
       ORDER BY h.cdate ASC, h.id ASC ${lim}`;

    let catBot = false;
    if (gioiHan > 0 && raw.length > gioiHan) {
      catBot = true;
      raw = raw.slice(0, gioiHan);
    }
    let locVao = new Decimal(0);
    let locRa = new Decimal(0);
    for (const r of raw) {
      const m = new Decimal(r.money ?? 0);
      if (m.gt(0)) locVao = locVao.plus(m);
      else locRa = locRa.minus(m);
    }
    const locN = raw.length;
    let coSoDuChay = !tbsSkLocPhu(L);
    let rows: (RawRow & { soDu: Dec | null })[];
    if (coSoDuChay && !catBot) rows = soDuChay(dauKy, raw);
    else {
      coSoDuChay = false;
      rows = raw.map((r) => ({ ...r, soDu: null }));
    }
    if (L.sort === 'desc') rows.reverse();

    let trang = 1;
    let soTrang = 1;
    let tuDong = 0;
    if (opts.phanTrang) {
      const mt = Math.max(1, Math.trunc(L.moiTrang));
      soTrang = Math.max(1, Math.ceil(rows.length / mt));
      trang = Math.min(Math.max(1, Math.trunc(L.trang)), soTrang);
      tuDong = (trang - 1) * mt;
      rows = rows.slice(tuDong, tuDong + mt);
    }

    return {
      account: { code: acc.code, name: acc.name, currency: acc.currency, accGroup: acc.accGroup, isActive: acc.isActive },
      ky: { fdate: L.fdate, tdate: L.tdate },
      dauKy: s(dauKy)!,
      kyVao: s(kyVao)!,
      kyRa: s(kyRa)!,
      kyNVao: Number(ky.nv),
      kyNRa: Number(ky.nr),
      cuoiKy: s(cuoiKy)!,
      soDuVi: s(soDuVi),
      locVao: s(locVao)!,
      locRa: s(locRa)!,
      locN,
      coSoDuChay,
      catBot,
      nguonList,
      coLoai: Number(loai.n) > 0,
      bankList: bankRaw.map((r) => String(r.b)),
      trang,
      soTrang,
      tuDong,
      rows: rows.map(toRowDto),
    };
  }

  /** Phạm vi `all` cho MỌI mã, không thì 403 (route không có tham số bản ghi ⇒ không cần giấu như 404). */
  private async canToanCongTy(uid: number, perms: string[]): Promise<void> {
    if (!(await this.toanCongTy(uid, perms))) throw new ForbiddenException('Không có quyền');
  }

  /**
   * `getRate($cur)` (:301-308): tỷ giá gần nhất có `rate_date <= ngày`; chưa từng nhập ⇒ 0. `ngayVn` là
   * ngày VN của `now` (prod: `date('Y-m-d')` = hôm nay — `now` mặc định = bây giờ nên trùng prod; tham
   * số hoá để test tất định). Tiebreak `id DESC` như `TreasuryService.getRate`.
   */
  private async rates(ngayVn: string): Promise<Rates> {
    const one = async (currency: 'CNY' | 'USD') => {
      const r = await this.prisma.exchangeRate.findFirst({
        where: { currency, rateDate: { lte: new Date(ngayVn + 'T00:00:00Z') } },
        orderBy: [{ rateDate: 'desc' }, { id: 'desc' }],
        select: { rateVnd: true },
      });
      return r ? new Decimal(r.rateVnd) : new Decimal(0);
    };
    return { CNY: await one('CNY'), USD: await one('USD') };
  }

  /** `toVnd($amount,$cur)` (:338-343): VND ⇒ nguyên; tỷ giá <= 0 ⇒ null (người gọi quyết bỏ hay gắn cờ). */
  private static toVnd(amount: Dec, cur: Cur, rates: Rates): Dec | null {
    if (cur === 'VND') return amount;
    const r = rates[cur];
    return r.lte(0) ? null : amount.times(r);
  }

  /** `$r['currency'] ? $r['currency'] : 'VND'` — mã ngoài danh mục (CHI-TBS…) ⇒ NULL ⇒ VND. */
  private static cur(c: string | null): Cur {
    return c === 'CNY' || c === 'USD' ? c : 'VND';
  }

  /** Dòng thuộc CẶP ĐẢO: là dòng đảo (reversal_of>0) hoặc là gốc đã có dòng đảo trỏ về. */
  private static capDaoSql(a: string): Prisma.Sql {
    const h = a.replace(/[^a-z0-9_]/gi, '');
    return Prisma.raw(
      `(${h}.reversal_of > 0 OR EXISTS (SELECT 1 FROM tbl_account_histories rv WHERE rv.reversal_of = ${h}.id))`,
    );
  }

  /**
   * R6 — `monthlyFlow($months)` (:1167-1194). SỐ in/out CHÉP PROD (status=1, loại `tranfer` + họ FX,
   * quy VND qua `toVnd`, thiếu tỷ giá ⇒ bỏ) + hai trường BỔ SUNG không đổi số cũ (Q-DOC-2):
   *  - `boQuaThieuTyGia` — phần ngoại tệ prod vứt im lặng (P-FL1), theo tháng × tệ, đơn vị GỐC;
   *  - `capDao` — phần cặp đảo đóng góp VÀO in/out (P-FL3), cùng quy đổi.
   * SỬA P-FL2 (Q-DOC-3): mốc = ngày 1 của tháng hiện tại (giờ VN) rồi mới lùi tháng ⇒ luôn đủ N tháng.
   * Dòng có tháng ngoài danh sách (tương lai) bị bỏ như prod (`continue` :1187).
   */
  async monthlyFlow(uid: number, months = 6, now: Date = new Date()) {
    await this.canToanCongTy(uid, ['account.view']);
    return this.monthlyFlowNoiBo(months, now);
  }

  private async monthlyFlowNoiBo(months: number, now: Date) {
    const n = Math.max(1, Math.trunc(months));
    const vn = new Date(now.getTime() + VN_OFFSET_SEC * 1000);
    const goc = vn.getUTCFullYear() * 12 + vn.getUTCMonth();
    const yms: string[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const t = goc - i;
      yms.push(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`);
    }
    const t0 = goc - (n - 1);
    const from = Date.UTC(Math.floor(t0 / 12), t0 % 12, 1) / 1000 - VN_OFFSET_SEC;

    const raw = await this.prisma.$queryRaw<{ ym: string; currency: string | null; cap: boolean; vao: Dec; ra: Dec }[]>`
      SELECT to_char(to_timestamp(h.cdate) AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') AS ym,
             a.currency::text AS currency,
             ${TreasuryReportService.capDaoSql('h')} AS cap,
             COALESCE(SUM(CASE WHEN h.money > 0 THEN h.money ELSE 0 END), 0) AS vao,
             COALESCE(SUM(CASE WHEN h.money < 0 THEN -h.money ELSE 0 END), 0) AS ra
        FROM tbl_account_histories h
        LEFT JOIN tbl_accounts a ON a.code = h.tk_code
       WHERE h.status = 1 AND h.cdate >= ${from}
         AND h.type <> 'tranfer'
         AND NOT ${dieuKienHoFxSql('h')}
       GROUP BY 1, 2, 3`;

    const rates = await this.rates(vn.toISOString().slice(0, 10));
    const z = () => new Decimal(0);
    const out = new Map(yms.map((ym) => [ym, { vao: z(), ra: z(), capVao: z(), capRa: z() }]));
    const boQua = new Map<string, { ym: string; currency: Cur; vao: Dec; ra: Dec }>();
    for (const r of raw) {
      const o = out.get(r.ym);
      if (!o) continue;
      const cur = TreasuryReportService.cur(r.currency);
      const vi = TreasuryReportService.toVnd(new Decimal(r.vao), cur, rates);
      const vo = TreasuryReportService.toVnd(new Decimal(r.ra), cur, rates);
      o.vao = o.vao.plus(vi ?? 0);
      o.ra = o.ra.plus(vo ?? 0);
      if (r.cap) {
        o.capVao = o.capVao.plus(vi ?? 0);
        o.capRa = o.capRa.plus(vo ?? 0);
      }
      if (vi === null || vo === null) {
        const k = r.ym + '|' + cur;
        const b = boQua.get(k) ?? { ym: r.ym, currency: cur, vao: z(), ra: z() };
        if (vi === null) b.vao = b.vao.plus(r.vao);
        if (vo === null) b.ra = b.ra.plus(r.ra);
        boQua.set(k, b);
      }
    }
    const thang = yms.map((ym) => {
      const o = out.get(ym)!;
      return { ym, in: s(o.vao)!, out: s(o.ra)!, net: s(o.vao.minus(o.ra))! };
    });
    let capVao = z();
    let capRa = z();
    for (const o of out.values()) {
      capVao = capVao.plus(o.capVao);
      capRa = capRa.plus(o.capRa);
    }
    return {
      thang,
      boQuaThieuTyGia: [...boQua.values()]
        .sort((a, b) => (a.ym === b.ym ? (a.currency < b.currency ? -1 : 1) : a.ym < b.ym ? -1 : 1))
        .map((b) => ({ ym: b.ym, currency: b.currency, in: s(b.vao)!, out: s(b.ra)! })),
      capDao: {
        in: s(capVao)!,
        out: s(capRa)!,
        thang: yms.map((ym) => ({ ym, in: s(out.get(ym)!.capVao)!, out: s(out.get(ym)!.capRa)! })),
      },
    };
  }

  /**
   * R9 phần quỹ — `bld_data.php` BẢN SỬA (§6.3, Q-DOC-1 mặc định (a)). Kỳ `[from, toExclusive)` (epoch).
   * Prod (§6.1) lấy `SUM(money) GROUP BY type` KHÔNG lọc status, KHÔNG loại FX, cộng CNY/USD như đồng
   * (P-BLD1). Bản sửa = ĐÚNG mệnh đề `monthlyFlow` (status=1, loại `tranfer` + `dieuKienHoFx`) và:
   *  - `thu`/`chi` CHỈ ví VND (không quy đổi; tách theo DẤU tiền như monthlyFlow, không theo `type`);
   *  - `theoTe` CNY/USD riêng, đơn vị gốc; `luanChuyenNoiBo` = phần `tranfer` + họ FX, status=1, theo tệ;
   *  - `capDao` = phần cặp đảo nằm TRONG thu/chi VND (để BGĐ thấy — Q-DOC-1 (a) không loại).
   * `kem12Thang` ⇒ thêm `bang12Thang = monthlyFlow(12)` (§6.3 "bảng 12 tháng dùng lại monthlyFlow(12)").
   */
  async quyTrongKy(uid: number, from: number, toExclusive: number, opts: { kem12Thang?: boolean; now?: Date } = {}) {
    await this.canToanCongTy(uid, ['report.report_bld']);
    const fx = dieuKienHoFxSql('h');
    const raw = await this.prisma.$queryRaw<{ currency: string | null; nhom: string; cap: boolean; vao: Dec; ra: Dec }[]>`
      SELECT a.currency::text AS currency,
             CASE WHEN (h.type <> 'tranfer' AND NOT ${fx}) THEN 'dong'
                  WHEN (h.type = 'tranfer' OR ${fx}) THEN 'lc'
                  ELSE 'khac' END AS nhom,
             ${TreasuryReportService.capDaoSql('h')} AS cap,
             COALESCE(SUM(CASE WHEN h.money > 0 THEN h.money ELSE 0 END), 0) AS vao,
             COALESCE(SUM(CASE WHEN h.money < 0 THEN -h.money ELSE 0 END), 0) AS ra
        FROM tbl_account_histories h
        LEFT JOIN tbl_accounts a ON a.code = h.tk_code
       WHERE h.status = 1 AND h.cdate >= ${Math.trunc(from)} AND h.cdate < ${Math.trunc(toExclusive)}
       GROUP BY 1, 2, 3`;
    const z = () => new Decimal(0);
    const dong = { VND: { thu: z(), chi: z() }, CNY: { thu: z(), chi: z() }, USD: { thu: z(), chi: z() } };
    const lc = { VND: { vao: z(), ra: z() }, CNY: { vao: z(), ra: z() }, USD: { vao: z(), ra: z() } };
    const cap = { thu: z(), chi: z() };
    for (const r of raw) {
      const cur = TreasuryReportService.cur(r.currency);
      if (r.nhom === 'dong') {
        dong[cur].thu = dong[cur].thu.plus(r.vao);
        dong[cur].chi = dong[cur].chi.plus(r.ra);
        if (r.cap && cur === 'VND') {
          cap.thu = cap.thu.plus(r.vao);
          cap.chi = cap.chi.plus(r.ra);
        }
      } else if (r.nhom === 'lc') {
        lc[cur].vao = lc[cur].vao.plus(r.vao);
        lc[cur].ra = lc[cur].ra.plus(r.ra);
      }
    }
    const tc = (x: { thu: Dec; chi: Dec }) => ({ thu: s(x.thu)!, chi: s(x.chi)! });
    const vr = (x: { vao: Dec; ra: Dec }) => ({ vao: s(x.vao)!, ra: s(x.ra)! });
    return {
      ky: { from: Math.trunc(from), toExclusive: Math.trunc(toExclusive) },
      thu: s(dong.VND.thu)!,
      chi: s(dong.VND.chi)!,
      theoTe: { CNY: tc(dong.CNY), USD: tc(dong.USD) },
      luanChuyenNoiBo: { VND: vr(lc.VND), CNY: vr(lc.CNY), USD: vr(lc.USD) },
      capDao: tc(cap),
      ...(opts.kem12Thang ? { bang12Thang: await this.monthlyFlowNoiBo(12, opts.now ?? new Date()) } : {}),
    };
  }

  /**
   * R8a — `costSummary($by,$from,$to)` (:1386-1408), chép prod: `h.<by> > 0 AND status=1`, `from`/`to`
   * > 0 mới lọc (`to` TÍNH — `<=`), gộp (ref, tệ), quy VND qua `toVnd` (thiếu ⇒ 0). BỔ SUNG (Q-DOC-8,
   * P-CR1): `missingRate` + `boQuaThieuTyGia` (đơn vị gốc) cho ref có tệ không quy được. Thứ tự = màn
   * `chiphi_ref.php` (chi_vnd giảm dần); hoà ⇒ ref tăng dần (prod: thứ tự không xác định).
   */
  async costSummary(uid: number, by: 'po_id' | 'container_id', from = 0, to = 0) {
    await this.canToanCongTy(uid, ['account.stats']);
    if (by !== 'po_id' && by !== 'container_id') return [];
    const col = Prisma.raw('h.' + by);
    const w: Prisma.Sql[] = [Prisma.sql`${col} > 0`, Prisma.sql`h.status = 1`];
    if (from > 0) w.push(Prisma.sql`h.cdate >= ${Math.trunc(from)}`);
    if (to > 0) w.push(Prisma.sql`h.cdate <= ${Math.trunc(to)}`);
    const raw = await this.prisma.$queryRaw<{ ref: number; currency: string | null; chi: Dec; thu: Dec; n: number }[]>`
      SELECT ${col} AS ref, a.currency::text AS currency,
             COALESCE(SUM(CASE WHEN h.money < 0 THEN -h.money ELSE 0 END), 0) AS chi,
             COALESCE(SUM(CASE WHEN h.money > 0 THEN h.money ELSE 0 END), 0) AS thu,
             COUNT(*)::int AS n
        FROM tbl_account_histories h
        LEFT JOIN tbl_accounts a ON a.code = h.tk_code
       WHERE ${Prisma.join(w, ' AND ')}
       GROUP BY 1, 2
       ORDER BY 1, 2`;
    const rates = await this.rates(vnYmd());
    type Acc = { chiVnd: Dec; thuVnd: Dec; n: number; missingRate: boolean; boQua: { currency: Cur; chi: string; thu: string }[] };
    const rs = new Map<number, Acc>();
    for (const r of raw) {
      const ref = Number(r.ref);
      const cur = TreasuryReportService.cur(r.currency);
      const o: Acc = rs.get(ref) ?? { chiVnd: new Decimal(0), thuVnd: new Decimal(0), n: 0, missingRate: false, boQua: [] };
      const c = TreasuryReportService.toVnd(new Decimal(r.chi), cur, rates);
      const t = TreasuryReportService.toVnd(new Decimal(r.thu), cur, rates);
      o.chiVnd = o.chiVnd.plus(c ?? 0);
      o.thuVnd = o.thuVnd.plus(t ?? 0);
      o.n += Number(r.n);
      if (c === null || t === null) {
        o.missingRate = true;
        o.boQua.push({ currency: cur, chi: s(new Decimal(r.chi))!, thu: s(new Decimal(r.thu))! });
      }
      rs.set(ref, o);
    }
    return [...rs.entries()]
      .sort((a, b) => b[1].chiVnd.comparedTo(a[1].chiVnd) || a[0] - b[0])
      .map(([ref, o]) => ({ ref, chiVnd: s(o.chiVnd)!, thuVnd: s(o.thuVnd)!, n: o.n, missingRate: o.missingRate, boQuaThieuTyGia: o.boQua }));
  }

  /**
   * R8b — `costByRef($col,$val)` (:1356-1380): mã CHẾT ở prod (0 nơi gọi ngoài test — P-CR2). Port như
   * hàm NỘI BỘ, KHÔNG route (Q-DOC-8 mặc định). Chép prod: `chi`/`thu` gốc CỘNG LẪN tệ (như prod),
   * `*_vnd` qua `toVnd(abs)`, `missingRate` khi có dòng không quy được. Dòng trả allow-list (không `stk`).
   */
  async costByRef(uid: number, col: 'container_id' | 'po_id' | 'order_code', val: number | string) {
    await this.canToanCongTy(uid, ['account.stats']);
    const z = () => new Decimal(0);
    const out = { chi: z(), thu: z(), chiVnd: z(), thuVnd: z(), missingRate: false };
    let w: Prisma.Sql;
    if (col === 'order_code') {
      if (String(val) === '') return fmtCost(out, []);
      w = Prisma.sql`h.order_code = ${String(val)}`;
    } else if (col === 'po_id' || col === 'container_id') {
      const v = phpIntval(val);
      if (v <= 0) return fmtCost(out, []);
      w = Prisma.sql`${Prisma.raw('h.' + col)} = ${v}`;
    } else return fmtCost(out, []);
    const raw = await this.prisma.$queryRaw<CostRefRaw[]>`
      SELECT h.id, h.tk_code, a.name AS acc_name, a.currency::text AS currency, h.type, h.money, h.cdate, h.note,
             h.source_module, h.source_id, h.reversal_of, h.po_id, h.container_id, h.order_code
        FROM tbl_account_histories h
        LEFT JOIN tbl_accounts a ON a.code = h.tk_code
       WHERE ${w} AND h.status = 1
       ORDER BY h.cdate ASC, h.id ASC`;
    const rates = await this.rates(vnYmd());
    const rows = raw.map((r) => {
      const cur = TreasuryReportService.cur(r.currency);
      const m = new Decimal(r.money ?? 0);
      let vnd = TreasuryReportService.toVnd(m.abs(), cur, rates);
      if (vnd === null) {
        out.missingRate = true;
        vnd = new Decimal(0);
      }
      if (m.lt(0)) {
        out.chi = out.chi.minus(m);
        out.chiVnd = out.chiVnd.plus(vnd);
      } else {
        out.thu = out.thu.plus(m);
        out.thuVnd = out.thuVnd.plus(vnd);
      }
      return {
        id: Number(r.id), tkCode: r.tk_code, accName: r.acc_name, currency: cur, type: r.type, money: s(r.money),
        moneyVnd: s(m.lt(0) ? vnd.neg() : vnd)!, cdate: r.cdate, note: r.note, sourceModule: r.source_module,
        sourceId: r.source_id, reversalOf: r.reversal_of, poId: r.po_id, containerId: r.container_id, orderCode: r.order_code,
      };
    });
    return fmtCost(out, rows);
  }

  /**
   * R10c — `findSuspectDuplicates($tk,$f,$t,$win)` (:475-486) → `clusterSuspectDuplicates` (:444-469).
   * Chép prod: `money<>0` [+ tk] [+ cdate>=f] [+ cdate<=t], KHÔNG lọc status (P-DUP1), `ORDER BY tk_code,
   * cdate` (NULL trước như MariaDB; hoà ⇒ id). BỔ SUNG cờ (Q-DOC-12) — không đổi thành phần cụm:
   * mỗi dòng `chuaLenSo` (status≠1), `laDongDao` (reversal_of>0), `daBiDao` (có dòng đảo trỏ về);
   * mỗi cụm `canXem` = có ít nhất một dòng mang cờ.
   */
  async suspectDuplicates(uid: number, tk: string, from: number, to: number, windowMinutes = 30) {
    await this.canToanCongTy(uid, ['account.stats']);
    const w: Prisma.Sql[] = [Prisma.sql`h.money <> 0`];
    if (tk !== '') w.push(Prisma.sql`h.tk_code = ${tk}`);
    if (Math.trunc(from) > 0) w.push(Prisma.sql`h.cdate >= ${Math.trunc(from)}`);
    if (Math.trunc(to) > 0) w.push(Prisma.sql`h.cdate <= ${Math.trunc(to)}`);
    const raw = await this.prisma.$queryRaw<DupRaw[]>`
      SELECT h.id, h.tk_code, a.currency::text AS currency, h.money, h.type, h.cdate, h.note, h.cuser,
             h.source_module, h.source_id, h.status, h.reversal_of,
             EXISTS (SELECT 1 FROM tbl_account_histories rv WHERE rv.reversal_of = h.id) AS da_bi_dao
        FROM tbl_account_histories h
        LEFT JOIN tbl_accounts a ON a.code = h.tk_code
       WHERE ${Prisma.join(w, ' AND ')}
       ORDER BY h.tk_code COLLATE "C" ASC NULLS FIRST, h.cdate ASC NULLS FIRST, h.id ASC`;
    const rows = raw.map((r) => ({
      id: Number(r.id),
      tkCode: r.tk_code,
      currency: r.currency === null ? null : TreasuryReportService.cur(r.currency),
      money: s(r.money)!,
      type: r.type,
      cdate: r.cdate,
      note: r.note,
      cuser: r.cuser,
      sourceModule: r.source_module,
      sourceId: r.source_id,
      status: r.status,
      reversalOf: r.reversal_of,
      chuaLenSo: r.status !== 1,
      laDongDao: r.reversal_of > 0,
      daBiDao: r.da_bi_dao,
    }));
    return clusterSuspectDuplicates(rows, windowMinutes).map((c) => ({
      tkCode: c[0].tkCode,
      money: new Decimal(c[0].money).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
      n: c.length,
      canXem: c.some((x) => x.chuaLenSo || x.laDongDao || x.daBiDao),
      rows: c,
    }));
  }

  /**
   * R8d — lợi nhuận quỹ ngoại tệ `/report/quy-te` (`libs/fx_quyte.php`, Task 3). `from`/`to` epoch, `to` KHÔNG
   * tính (như `fxq_tinh`). FIFO chạy trên TOÀN BỘ lịch sử; kỳ chỉ lọc phần hiển thị. Quyền chép prod (§9):
   * `report.report_fxquyte`, phạm vi `all` (quỹ toàn công ty).
   */
  async quyTe(uid: number, from: number, to: number) {
    await this.canToanCongTy(uid, ['report.report_fxquyte']);
    return decToString(fxqTinh(await this.fxq.docDuLieu(from, to)));
  }
}

/** Mọi Prisma.Decimal trong cây kết quả ⇒ chuỗi ký pháp thường (DTO trả Decimal dạng chuỗi). */
function decToString(v: any): any {
  if (v === null || v === undefined) return v;
  if (Decimal.isDecimal(v)) return (v as Dec).toFixed();
  if (Array.isArray(v)) return v.map(decToString);
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decToString(x)]));
  return v;
}

interface CostRefRaw {
  id: number;
  tk_code: string | null;
  acc_name: string | null;
  currency: string | null;
  type: string | null;
  money: Dec | null;
  cdate: number | null;
  note: string | null;
  source_module: string;
  source_id: number;
  reversal_of: number;
  po_id: number;
  container_id: number;
  order_code: string;
}

interface DupRaw {
  id: number;
  tk_code: string | null;
  currency: string | null;
  money: Dec;
  type: string | null;
  cdate: number | null;
  note: string | null;
  cuser: string | null;
  source_module: string;
  source_id: number;
  status: number | null;
  reversal_of: number;
  da_bi_dao: boolean;
}

function fmtCost<R>(o: { chi: Dec; thu: Dec; chiVnd: Dec; thuVnd: Dec; missingRate: boolean }, rows: R[]) {
  return { chi: s(o.chi)!, thu: s(o.thu)!, chiVnd: s(o.chiVnd)!, thuVnd: s(o.thuVnd)!, missingRate: o.missingRate, rows };
}

function toRowDto(r: RawRow & { soDu: Dec | null }): StatementRowDto {
  const [nhan, mau] = nhanNguon(r.source_module);
  return {
    id: Number(r.id),
    cdate: r.cdate,
    type: r.type,
    chieu: chieuDong(r.type, r.money),
    nguon: { ma: r.source_module, nhan, mau },
    noiDung: noiDungDong({
      note: r.note,
      sourceModule: r.source_module,
      sourceId: r.source_id,
      approvalFormData: r.approval_form_data,
    }),
    money: s(r.money),
    soDu: s(r.soDu),
    rate: s(r.rate),
    status: r.status,
    trangThai: trangThai(r.status),
    reversalOf: r.reversal_of,
    tranId: r.tran_id === null ? null : String(r.tran_id),
    orderCode: r.order_code,
    poId: r.po_id,
    bankInfo: r.bank_info,
    cuser: r.cuser,
    approveUser: r.approve_user,
    approveDate: r.approve_date,
  };
}
