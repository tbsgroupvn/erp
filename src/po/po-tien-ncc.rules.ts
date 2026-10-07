// src/po/po-tien-ncc.rules.ts
//
// #09d L11, Task 3 (R8c) — "Tiền NCC của một PO", HÀM THUẦN (không CSDL). Nguồn NGUYÊN VĂN: prod
// `libs/po_tien_ncc.php` @1894f76 (`ptn_vi_currency`, `po_tien_ncc`, `po_co_phieu_thu_ncc`). Đặc tả
// docs/rewrite-spec/09d-so-quy-doc-bao-cao.md §5.2, quyết định Q-DOC-7 (mặc định).
//
//   chi[cur] = Σ price_cyn của phiếu chi NCC (pay_type='supplier') của PO — KHÔNG lọc duyệt (P-PT1).
//              Q-DOC-7 mặc định: GIỮ số prod + trả TÁCH `chiDaDuyet` (status=confirm='yes') / `chiChoDuyet`.
//   thu[cur] = phiếu duyệt 'thu_ncc_hoan_tien' ĐÃ DUYỆT trỏ đúng PO (form_data.po_lien_quan) VÀ có dòng
//              sổ quỹ status=1 (source_module='thu_chi_tbs', source_id=rid); tệ = tệ của VÍ nhận.
//   con[cur] = chi − thu (CHI − THU — đừng đảo dấu), không gộp tệ, không quy đổi.
//
// ⚠ Hành vi prod GIỮ NGUYÊN, ghim bằng test:
//   P-PT2 — phiếu hoàn không có `po_lien_quan` (16/16 phiếu thật) KHÔNG thuộc PO nào ⇒ "hoàn" = 0.
//   P-PT3 — dòng sổ đã bị ĐẢO vẫn tính là "đã hoàn" (prod `LIMIT 1` trên status=1, không loại đảo).
//           v2 KHÔNG đổi số, chỉ gắn thêm cờ `daBiDao` trên phiếu để màn hình thấy được.
import { Prisma } from '@prisma/client';
import { phpIntval } from '../treasury/report-rules';

type Dec = Prisma.Decimal;
const Decimal = Prisma.Decimal;

export interface PtnPayRow {
  currency: string | null;
  priceCyn: Dec | string | number | null;
  status: string | null;
  confirm: string | null;
}
export interface PtnRefundRequest {
  id: number;
  objectCode: string | null;
  formData: string | null;
  submittedBy: string | null;
}
export interface PtnEntry {
  tkCode: string | null;
  money: Dec | string | number | null;
  /** có dòng khác `reversal_of` trỏ về (Q-DOC-12 — chỉ để gắn cờ, KHÔNG đổi số) */
  daBiDao: boolean;
}
export interface PtnPhieu {
  rid: number;
  ma: string;
  vi: string;
  ngay: string;
  nguoi: string;
  tien: Dec;
  tienTe: string;
  lyDo?: string;
  daBiDao?: boolean;
}
export interface PtnResult {
  chi: Record<string, Dec>;
  thu: Record<string, Dec>;
  con: Record<string, Dec>;
  phieu: PtnPhieu[];
  moHo: PtnPhieu[];
  /** Q-DOC-7 — tách của `chi`: chiDaDuyet + chiChoDuyet = chi (từng tệ) */
  chiDaDuyet: Record<string, Dec>;
  chiChoDuyet: Record<string, Dec>;
  soPhieuChi: { daDuyet: number; choDuyet: number; quaDo: number };
}

export const LY_DO_CHUA_GHI = 'Phiếu đã duyệt nhưng CHƯA ghi được vào ví (thiếu bút toán sổ quỹ) — kiểm tra kỹ thuật.';
export const LY_DO_KHONG_TIEN = 'Bút toán không tra được loại tiền của ví hoặc số tiền bằng 0.';

/** PHP `intval()` trên giá trị đã `json_decode(…, true)` (mảng ⇒ 0/1 theo rỗng/không rỗng). */
function intvalJson(v: unknown): number {
  if (Array.isArray(v)) return v.length ? 1 : 0;
  if (v !== null && typeof v === 'object') return Object.keys(v).length ? 1 : 0;
  return phpIntval(v);
}
/** PHP `(string)` trên giá trị đã json_decode. */
function strvalJson(v: unknown): string {
  if (v === null || v === undefined || v === false) return '';
  if (v === true) return '1';
  if (typeof v === 'object') return 'Array';
  return String(v);
}
/** PHP `trim()` mặc định. */
function phpTrim(s: string): string {
  return s.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');
}
/** `json_decode($s ?: '{}', true)` — chuỗi falsy của PHP ('' / '0' / NULL) ⇒ '{}'; hỏng ⇒ null. */
function jsonDecode(s: string | null): unknown {
  const src = s === null || s === '' || s === '0' ? '{}' : s;
  try {
    return JSON.parse(src);
  } catch {
    return null;
  }
}
/** `is_array()` sau json_decode assoc: object JSON hoặc mảng JSON. */
function laMang(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object';
}

/** `ptn_vi_currency($ma)` — tệ của mã ví ('TK02' ⇒ 'CNY'); nhãn cũ 'TK03 · MB BANK…' bóc mã; không tra được ⇒ ''. */
export function ptnViCurrency(ma: string | null | undefined, accCur: Map<string, string>): string {
  let m = phpTrim(String(ma ?? '')).toUpperCase();
  const g = /^(TK\d+)/i.exec(m);
  if (g) m = g[1].toUpperCase();
  return accCur.get(m) ?? '';
}

/**
 * `po_tien_ncc($po_id)` thuần. `refunds` = MỌI phiếu mẫu 'thu_ncc_hoan_tien' status=2, is_deleted=0,
 * theo `id DESC` (lọc PO làm Ở ĐÂY như prod — không JSON trong SQL). `entryOf(rid)` = dòng sổ ĐẦU TIÊN
 * `thu_chi_tbs`/rid/status=1 (hoặc undefined). `accCur` = mã ví (HOA) ⇒ tệ (HOA).
 */
export function poTienNccTinh(
  poIdIn: number,
  payRows: PtnPayRow[],
  refunds: PtnRefundRequest[],
  entryOf: (rid: number) => PtnEntry | undefined,
  accCur: Map<string, string>,
): PtnResult {
  const poId = phpIntval(poIdIn);
  const out: PtnResult = {
    chi: {}, thu: {}, con: {}, phieu: [], moHo: [],
    chiDaDuyet: {}, chiChoDuyet: {}, soPhieuChi: { daDuyet: 0, choDuyet: 0, quaDo: 0 },
  };
  if (poId <= 0) return out;

  // ----- CHI: nhóm theo tệ (COALESCE(NULLIF(currency,''),'CNY')); GROUP BY của MariaDB sắp tăng dần -----
  const cong = (o: Record<string, Dec>, k: string, v: Dec) => { o[k] = (o[k] ?? new Decimal(0)).plus(v); };
  const nhom = new Map<string, Dec>();
  for (const p of payRows) {
    const cur = (p.currency === null || p.currency === '' ? 'CNY' : p.currency).toUpperCase();
    const v = p.priceCyn === null || p.priceCyn === undefined ? new Decimal(0) : new Decimal(p.priceCyn);
    nhom.set(cur, (nhom.get(cur) ?? new Decimal(0)).plus(v));
    const daDuyet = p.status === 'yes' && p.confirm === 'yes';
    if (daDuyet) { cong(out.chiDaDuyet, cur, v); out.soPhieuChi.daDuyet++; }
    else {
      cong(out.chiChoDuyet, cur, v);
      out.soPhieuChi.choDuyet++;
      if ((p.status === 'yes') !== (p.confirm === 'yes')) out.soPhieuChi.quaDo++; // trạng thái quá độ (P-PT1)
    }
  }
  for (const cur of [...nhom.keys()].sort()) out.chi[cur] = nhom.get(cur)!;

  // ----- THU -----
  for (const r of refunds) {
    const fd = jsonDecode(r.formData);
    if (!laMang(fd)) continue;
    if (intvalJson((fd as any)['po_lien_quan'] ?? 0) !== poId) continue; // P-PT2: không có po_lien_quan ⇒ 0 ⇒ bỏ

    const rid = Math.trunc(r.id);
    const row: PtnPhieu = {
      rid, ma: r.objectCode ?? '', vi: phpTrim(strvalJson((fd as any)['tk_vi_thu'] ?? '')),
      ngay: phpTrim(strvalJson((fd as any)['ngay_hoan'] ?? '')), nguoi: r.submittedBy ?? '',
      tien: new Decimal(0), tienTe: '',
    };
    const hr = entryOf(rid);
    if (!hr) {
      row.lyDo = LY_DO_CHUA_GHI;
      out.moHo.push(row);
      continue;
    }
    const cur = ptnViCurrency(hr.tkCode, accCur);
    const tien = new Decimal(hr.money ?? 0).abs();
    row.tien = tien;
    row.tienTe = cur;
    row.vi = hr.tkCode ?? '';
    row.daBiDao = hr.daBiDao; // P-PT3: chỉ gắn cờ — số VẪN tính như prod
    if (cur === '' || tien.lte(0)) {
      row.lyDo = LY_DO_KHONG_TIEN;
      out.moHo.push(row);
      continue;
    }
    out.phieu.push(row);
    cong(out.thu, cur, tien);
  }

  // ----- CÒN LẠI = CHI − THU, từng tệ (thứ tự khoá: chi trước, rồi thu — array_unique(array_merge)) -----
  const keys = [...new Set([...Object.keys(out.chi), ...Object.keys(out.thu)])];
  for (const cur of keys) out.con[cur] = (out.chi[cur] ?? new Decimal(0)).minus(out.thu[cur] ?? new Decimal(0));
  return out;
}

/** `po_co_phieu_thu_ncc` — chỉ đếm phiếu ĐÃ có bút toán (không đếm `moHo`). */
export function poCoPhieuThuNccTinh(t: PtnResult): boolean {
  return t.phieu.length > 0;
}
