// src/treasury/report-rules.ts
//
// #09d L11, Task 1 — HÀM THUẦN của đường ĐỌC sổ quỹ (không CSDL, không I/O).
// Đặc tả: docs/rewrite-spec/09d-so-quy-doc-bao-cao.md §2.1 (tbs_sk_loc :30-56, tbs_sk_so :21-27),
//         §2.2 (tbs_sk_loc_phu :59-62, tbs_sk_so_du_chay :65-72, tbs_sk_chieu_dong :75-78,
//         tbs_sk_trang_thai, nhanNguon :59-89), §3.1 (dieuKienHoFx :1159-1164 NGUYÊN VĂN),
//         §7.3 (clusterSuspectDuplicates :444-469), §9 (danh sách hàm).
// Nguồn đối chiếu nguyên văn: `libs/account_statement.php` + `libs/cls.treasury.php` của prod (bản
// chép tại chỗ trong `F:\01_TBS_GROUP\.prodwork\fxqd\libs\` — số dòng trùng khít số dòng đặc tả trích).
//
// Tiền: Prisma.Decimal suốt — số dư chạy chính xác tuyệt đối (prod dùng float, lệch ≤ 1,9e-6, §0.1).
// Giờ: mọi ngày/giờ theo Asia/Ho_Chi_Minh = UTC+7 cố định (VN không có DST — §1 cuối).
import { Prisma } from '@prisma/client';

type Dec = Prisma.Decimal;
const Decimal = Prisma.Decimal;
type DecLike = Dec | string | number | null | undefined;

const VN_OFFSET_SEC = 7 * 3600;

/** PHP `floatval()` cho giá trị tiền → Decimal (null/rỗng/không phải số ⇒ 0). */
function dec(v: DecLike): Dec {
  if (v === null || v === undefined || v === '') return new Decimal(0);
  try {
    return new Decimal(v as any);
  } catch {
    return new Decimal(0);
  }
}

/**
 * PHP 8 `intval()` trên chuỗi/số: lấy phần số ĐẦU chuỗi (kể cả số mũ — `intval("1e3") = 1000`),
 * không có ⇒ 0; cắt phần lẻ về 0; kẹp trong int64.
 */
export function phpIntval(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === null || v === undefined) return 0;
  const m = /^[ \t\n\r\v\f]*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(String(v));
  if (!m) return 0;
  const n = Number(m[0].trim());
  if (!Number.isFinite(n)) return n > 0 ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
  return Math.trunc(n);
}

/** PHP 8 `is_numeric()` trên chuỗi ĐÃ trim (không hex, không khoảng trắng giữa). */
const PHP_NUMERIC = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/** PHP `trim()` — chỉ " \t\n\r\0\x0B", KHÔNG phải mọi khoảng trắng Unicode như String.trim(). */
function phpTrim(s: string): string {
  return s.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');
}

/** `(string)($g[k] ?? '')` */
function str(v: unknown, dflt = ''): string {
  return v === null || v === undefined ? dflt : String(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// Họ FX — `CLS_TREASURY::dieuKienHoFx` (:1159-1164), chép NGUYÊN VĂN:
//   $c = preg_replace('/[^a-z0-9_]/i','',(string)$a).'.source_module';
//   "($c IN ('transfer','fx_transfer','fx_quydoi','fx_transfer_dao','fx_transfer_lai','fx_dieuchinh')"
//   ." OR $c LIKE 'fx\\_huy%'"
//   ." OR ($c LIKE 'daoxoa\\_fx\\_%' AND $c NOT LIKE 'daoxoa\\_fx\\_fee%'))"
// Postgres: `\` là ký tự thoát MẶC ĐỊNH của LIKE và `standard_conforming_strings=on` giữ nguyên `\`
// trong literal ⇒ `'fx\_huy%'` có đúng nghĩa như MariaDB. ⚠ Khác biệt còn lại: MariaDB so theo
// collation `_ci` (không phân biệt hoa/thường), Postgres LIKE phân biệt — mã nguồn prod đều viết
// thường nên không đổi kết quả; ghi lại để không ai "sửa" thành ILIKE mà không đo.
// ─────────────────────────────────────────────────────────────────────────────
const HO_FX_IN = ['transfer', 'fx_transfer', 'fx_quydoi', 'fx_transfer_dao', 'fx_transfer_lai', 'fx_dieuchinh'];

export function dieuKienHoFxSql(alias = 'h'): Prisma.Sql {
  const c = String(alias).replace(/[^a-z0-9_]/gi, '') + '.source_module';
  return Prisma.raw(
    `(${c} IN ('transfer','fx_transfer','fx_quydoi','fx_transfer_dao','fx_transfer_lai','fx_dieuchinh')`
      + ` OR ${c} LIKE 'fx\\_huy%'`
      + ` OR (${c} LIKE 'daoxoa\\_fx\\_%' AND ${c} NOT LIKE 'daoxoa\\_fx\\_fee%'))`,
  );
}

/** Cùng luật `dieuKienHoFx` trong bộ nhớ (phân biệt hoa/thường như Postgres). */
export function laHoFx(sourceModule: string | null | undefined): boolean {
  if (sourceModule === null || sourceModule === undefined) return false; // NULL IN/LIKE ⇒ không khớp
  const m = String(sourceModule);
  if (HO_FX_IN.includes(m)) return true;
  if (m.startsWith('fx_huy')) return true;
  return m.startsWith('daoxoa_fx_') && !m.startsWith('daoxoa_fx_fee');
}

// ─────────────────────────────────────────────────────────────────────────────
// Nhãn nguồn — `CLS_TREASURY::nhanNguon` (:59-89): 24 mã; mã lạ ⇒ mb_strtoupper(mã) + '#64748b'.
// ─────────────────────────────────────────────────────────────────────────────
const NHAN_NGUON: Record<string, [string, string]> = {
  '': ['SỔ QUỸ', '#64748b'],
  manual: ['SỔ QUỸ', '#64748b'],
  payment: ['PHIẾU CHI', '#b3441f'],
  chiphi: ['CHI PHÍ', '#8a6414'],
  bank_tx: ['BANK', '#177a4e'],
  bank: ['BANK', '#177a4e'],
  thu_chi_tbs: ['THU/CHI TBS', '#0f766e'],
  transfer: ['LUÂN CHUYỂN', '#1e40af'],
  fx_transfer: ['LC NGOẠI TỆ', '#1e40af'],
  fx_transfer_dao: ['ĐẢO LC NGOẠI TỆ', '#7c3aed'],
  fx_transfer_lai: ['LÃI LC NGOẠI TỆ', '#1e40af'],
  fx_dieuchinh: ['ĐIỀU CHỈNH LC', '#b45309'],
  daoxoa_fx_dieuchinh: ['ĐẢO ĐIỀU CHỈNH LC', '#7c3aed'],
  fx_fee: ['PHÍ LUÂN CHUYỂN', '#8a6414'],
  fx_quydoi: ['QUY ĐỔI AGENT', '#b45309'],
  daoxoa_fx_quydoi: ['ĐẢO QUY ĐỔI AGENT', '#7c3aed'],
  phi_nh: ['PHÍ NGÂN HÀNG', '#8a6414'],
  daoxoa_phi_nh: ['ĐẢO PHÍ NH', '#7c3aed'],
  fx_huy: ['HUỶ LUÂN CHUYỂN', '#7c3aed'],
  fx_huy_phi: ['HUỶ PHÍ LC', '#7c3aed'],
  fx_huy_nhan: ['HUỶ NHẬN LC', '#7c3aed'],
  daoxoa_fx_transfer: ['ĐẢO/XOÁ LC', '#7c3aed'],
  daoxoa_thu_chi_tbs: ['ĐẢO/XOÁ THU CHI', '#7c3aed'],
  daoxoa_fx_fee: ['ĐẢO/XOÁ PHÍ LC', '#7c3aed'],
};
export const MAU_NGUON_LA = '#64748b';

export function nhanNguon(ma: string | null | undefined): [string, string] {
  const k = phpTrim(str(ma));
  if (Object.prototype.hasOwnProperty.call(NHAN_NGUON, k)) return [...NHAN_NGUON[k]] as [string, string];
  return [k.toUpperCase(), MAU_NGUON_LA];
}

// ─────────────────────────────────────────────────────────────────────────────
// Nhãn dòng — tbs_sk_chieu_dong (:75-78), tbs_sk_trang_thai (:79-82)
// ─────────────────────────────────────────────────────────────────────────────
export function chieuDong(type: string | null | undefined, money: DecLike): string {
  if (str(type) === 'tranfer') return 'Chuyển đi';
  return dec(money).gte(0) ? 'Tiền vào' : 'Tiền ra';
}

export function trangThai(status: number | string | null | undefined): string {
  const st = phpIntval(status);
  return st === 1 ? 'Đã ghi sổ' : st === 0 ? 'Chờ ghi sổ' : st === 9 ? 'Đã huỷ' : 'Trạng thái ' + st;
}

// ─────────────────────────────────────────────────────────────────────────────
// Số dư chạy — tbs_sk_so_du_chay (:65-72). Dòng status≠1 có soDu=null và KHÔNG đổi số dư.
// Không đụng mảng/đối tượng đầu vào (trả bản sao có thêm `soDu`).
// ─────────────────────────────────────────────────────────────────────────────
export function soDuChay<T extends { status: number | string | null | undefined; money: DecLike }>(
  dauKy: DecLike,
  rowsAsc: readonly T[],
): (T & { soDu: Dec | null })[] {
  let sd = dec(dauKy);
  return rowsAsc.map((r) => {
    if (phpIntval(r.status) === 1) {
      sd = sd.plus(dec(r.money));
      return { ...r, soDu: sd };
    }
    return { ...r, soDu: null };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// tbs_sk_so (:21-27) — số kiểu VN "1.234,5" hoặc thuần "1234.5" → Decimal; rỗng/không phải số ⇒ null.
// ─────────────────────────────────────────────────────────────────────────────
export function tbsSkSo(v: unknown): Dec | null {
  let s = phpTrim(str(v));
  if (s === '') return null;
  if (s.includes(',')) s = s.split('.').join('').split(',').join('.');
  else if (s.split('.').length - 1 > 1) s = s.split('.').join('');
  return PHP_NUMERIC.test(s) ? new Decimal(s) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// tbs_sk_loc (:30-56) — chuẩn hoá bộ lọc. Khoá đầu vào đúng tên prod (`moi_trang`, `type` cũ).
// ─────────────────────────────────────────────────────────────────────────────
export type Chieu = '' | 'vao' | 'ra' | 'chuyen';
export interface StatementFilter {
  tk: string;
  fdate: string;
  tdate: string;
  chieu: Chieu;
  nguon: string;
  tt: '1' | '0' | '9' | 'all';
  q: string;
  min: Dec | null;
  max: Dec | null;
  loai: '' | 'TM' | 'CK';
  bank: string;
  sort: 'asc' | 'desc';
  trang: number;
  moiTrang: number;
}

export const TBS_SK_TRAN = 50000; // trần dòng đọc cho trang (:16)
export const TBS_SK_MOI_TRANG = 200; // (:17)
const MOI_TRANG_HOP_LE = [100, 200, 500, 1000];
const CHIEU_CU: Record<string, Chieu> = { in: 'vao', out: 'ra', tranfer: 'chuyen' };

/** `date('Y-m-d')` theo giờ VN. */
export function vnYmd(now: Date = new Date()): string {
  return new Date(now.getTime() + VN_OFFSET_SEC * 1000).toISOString().slice(0, 10);
}

/**
 * `strtotime("<ymd> <hms>")` theo giờ VN. Tràn ngày/tháng như PHP 8 (`2026-02-31` ⇒ 03/03, ngày 00 ⇒
 * cuối tháng trước, tháng 00 ⇒ tháng 12 năm trước); tháng > 12 hoặc ngày > 31 ⇒ null (PHP trả false).
 */
export function vnEpoch(ymd: string, hms: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  const t = /^(\d{2}):(\d{2}):(\d{2})$/.exec(hms);
  if (!m || !t) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo > 12 || d > 31) return null;
  const ms = Date.UTC(y, mo - 1, d, Number(t[1]), Number(t[2]), Number(t[3]));
  return ms / 1000 - VN_OFFSET_SEC;
}

export function tbsSkLoc(g: Record<string, unknown>, now: Date = new Date()): StatementFilter {
  const ngay = (v: unknown) => {
    const s = phpTrim(str(v));
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  };
  const loai = g.loai === 'TM' || g.loai === 'CK' ? g.loai : '';
  const mt = phpIntval(g.moi_trang ?? 0);
  const L: StatementFilter = {
    tk: str(g.tk).replace(/[^A-Za-z0-9_-]/g, ''),
    fdate: ngay(g.fdate),
    tdate: ngay(g.tdate),
    chieu: str(g.chieu) as Chieu,
    nguon: str(g.nguon, '__all'),
    tt: str(g.tt, '1') as StatementFilter['tt'],
    q: phpTrim(str(g.q)),
    min: tbsSkSo(g.min),
    max: tbsSkSo(g.max),
    loai,
    bank: phpTrim(str(g.bank)),
    sort: g.sort === 'asc' ? 'asc' : 'desc',
    trang: Math.max(1, phpIntval(g.trang ?? 1)),
    moiTrang: MOI_TRANG_HOP_LE.includes(mt) ? mt : TBS_SK_MOI_TRANG,
  };
  const type = str(g.type);
  if (L.chieu === '' && Object.prototype.hasOwnProperty.call(CHIEU_CU, type)) L.chieu = CHIEU_CU[type];
  if (!['', 'vao', 'ra', 'chuyen'].includes(L.chieu)) L.chieu = '';
  if (!['1', '0', '9', 'all'].includes(L.tt)) L.tt = '1';
  const today = vnYmd(now);
  if (L.fdate === '') L.fdate = today.slice(0, 8) + '01';
  if (L.tdate === '') L.tdate = today;
  if (L.tdate < L.fdate) L.tdate = L.fdate;
  return L;
}

/** tbs_sk_loc_phu (:59-62) — bộ lọc làm bảng thiếu giao dịch đã ghi sổ ⇒ cột số dư chạy vô nghĩa. */
export function tbsSkLocPhu(L: StatementFilter): boolean {
  return L.chieu !== '' || L.nguon !== '__all' || L.tt !== '1' || L.q !== ''
    || L.min !== null || L.max !== null || L.loai !== '' || L.bank !== '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Nội dung dòng — `tbs_account_history_content` (includes/account_history_content.php), đặc tả §2.2(5):
// dòng `thu_chi_tbs` có form_data.ly_do (ưu tiên) hoặc nd_thanh_toan ⇒
// 'Phiếu chi TBS — <nội dung> — phiếu duyệt #<id>' (id>0); còn lại = trim(note).
// ─────────────────────────────────────────────────────────────────────────────
export function noiDungDong(r: {
  note?: string | null;
  sourceModule?: string | null;
  sourceId?: number | null;
  approvalFormData?: string | null;
}): string {
  const fallback = phpTrim(str(r.note));
  if (str(r.sourceModule) !== 'thu_chi_tbs') return fallback;
  let fd: unknown;
  try {
    fd = JSON.parse(str(r.approvalFormData));
  } catch {
    return fallback;
  }
  // json_decode(..., true) + is_array: object hoặc mảng JSON.
  if (fd === null || typeof fd !== 'object') return fallback;
  const o = fd as Record<string, unknown>;
  let nd = '';
  for (const key of ['ly_do', 'nd_thanh_toan']) {
    const raw = o[key];
    const val = raw === null || raw === undefined || raw === false ? '' : raw === true ? '1' : typeof raw === 'object' ? '' : phpTrim(String(raw));
    if (val !== '') {
      nd = val;
      break;
    }
  }
  if (nd === '') return fallback;
  const rid = phpIntval(r.sourceId ?? 0);
  return 'Phiếu chi TBS — ' + nd + (rid > 0 ? ' — phiếu duyệt #' + rid : '');
}

// ─────────────────────────────────────────────────────────────────────────────
// clusterSuspectDuplicates (:444-469) — khoá (tk_code, number_format(round(money,2),2,'.','')) CÓ DẤU,
// money=0 bỏ; trong từng khoá sắp cdate tăng (ổn định), gom BẮC CẦU khi cách dòng TRƯỚC ≤ cửa sổ;
// chỉ giữ cụm ≥ 2. Thứ tự cụm = thứ tự lần đầu gặp khoá (mảng PHP giữ thứ tự chèn).
// round() PHP = nửa xa 0 ⇒ Decimal.ROUND_HALF_UP (phpRound của v2 chỉ nhận number — §7.3).
// ─────────────────────────────────────────────────────────────────────────────
export function clusterSuspectDuplicates<T extends { tkCode?: string | null; money: DecLike; cdate: number | null | undefined }>(
  rows: readonly T[],
  windowMinutes: number = 30,
): T[][] {
  const windowSec = Math.max(1, phpIntval(windowMinutes)) * 60;
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const money = dec(r.money).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (money.isZero()) continue;
    const key = str(r.tkCode) + '|' + money.toFixed(2);
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }
  const clusters: T[][] = [];
  for (const list0 of groups.values()) {
    const list = [...list0].sort((a, b) => phpIntval(a.cdate) - phpIntval(b.cdate)); // Array.sort ổn định (ES2019)
    let cluster: T[] = [list[0]];
    for (let i = 1; i < list.length; i++) {
      const prev = cluster[cluster.length - 1];
      if (phpIntval(list[i].cdate) - phpIntval(prev.cdate) <= windowSec) cluster.push(list[i]);
      else {
        if (cluster.length >= 2) clusters.push(cluster);
        cluster = [list[i]];
      }
    }
    if (cluster.length >= 2) clusters.push(cluster);
  }
  return clusters;
}
