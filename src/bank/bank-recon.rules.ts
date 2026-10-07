// src/bank/bank-recon.rules.ts
//
// #09d L11, Task 3 (R10a/b) — hàm khớp đối soát bank, THUẦN (không CSDL — như chú thích prod "để test cô
// lập"). Nguồn NGUYÊN VĂN: prod `libs/bank_recon.php` @1894f76 (`bank_recon_debit_cat`, `bank_recon_compat`,
// `bank_recon_match`, `bank_recon_subset_sum`). Đặc tả docs/rewrite-spec/09d-so-quy-doc-bao-cao.md §7.1.
//
// Tiền: Prisma.Decimal (prod float). Mọi ngưỡng giữ nguyên giá trị + chiều so: khớp 1-1 loại khi
// `|chênh| > 0,001`; subset-sum nhận khi `|chênh| < 0,001` (NGHIÊM — hai chiều khác nhau là của prod).
import { Prisma } from '@prisma/client';

type Dec = Prisma.Decimal;
const Decimal = Prisma.Decimal;
const TOL = new Decimal('0.001');

// ─────────────────────────────────────────────────────────────────────────────
// `bank_recon_debit_cat` — "bỏ dấu tối giản". ⚠ HAI MẢNG CỦA PROD LỆCH NHAU: mảng tìm 67 ký tự, mảng
// thay 66 ký tự (thiếu một 'a'). PHP `str_replace(array, array)` thay LẦN LƯỢT từng cặp, phần tử tìm
// không có cặp thay bằng ''. Hệ quả chép nguyên (ghim trong test): 'ẵ'→'o', 'õ'→'e', 'ẽ'→'u', 'ũ'→'i',
// 'ĩ'→'y', 'ỹ'→'d', 'đ'→'' — nên "quỹ tiền mặt" CÓ DẤU thành "qud tien mat" và KHÔNG được xếp `cash`
// (chỉ bản không dấu "quy tien mat" — dạng SePay thường gửi — mới khớp). Không sửa: là hành vi prod.
// ─────────────────────────────────────────────────────────────────────────────
const TIM = ['ầ','ấ','ậ','ẩ','ẫ','â','à','á','ạ','ả','ã','ă','ằ','ắ','ặ','ẳ','ẵ','ô','ồ','ố','ộ','ổ','ỗ','ơ','ờ','ớ','ợ','ở','ỡ','ò','ó','ọ','ỏ','õ','ê','ề','ế','ệ','ể','ễ','è','é','ẹ','ẻ','ẽ','ư','ừ','ứ','ự','ử','ữ','ù','ú','ụ','ủ','ũ','ì','í','ị','ỉ','ĩ','ỳ','ý','ỵ','ỷ','ỹ','đ'];
const THAY = ['a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','o','o','o','o','o','o','o','o','o','o','o','o','o','o','o','o','o','e','e','e','e','e','e','e','e','e','e','e','u','u','u','u','u','u','u','u','u','u','u','i','i','i','i','i','y','y','y','y','y','d'];

export type DebitCat = 'cash' | 'transfer' | 'other';

/** Chuỗi sau bước "bỏ dấu" của prod (xuất ra để ghim hành vi lệch mảng). */
export function bankReconBoDau(content: string | null | undefined): string {
  let s = String(content ?? '').toLowerCase(); // mb_strtolower(…, 'UTF-8')
  for (let i = 0; i < TIM.length; i++) s = s.split(TIM[i]).join(THAY[i] ?? '');
  return s;
}

/** Phân loại lệnh chi theo nội dung — chống gán chéo cash-fund/nội bộ với chứng từ sai loại. */
export function bankReconDebitCat(content: string | null | undefined): DebitCat {
  const s = bankReconBoDau(content);
  if (s.includes('quy tien mat')) return 'cash';
  if (s.includes('noi b') || s.includes('luan chuyen')) return 'transfer';
  return 'other';
}

/** Lệnh loại nào khớp chứng từ module nào (chỉ áp dụng cho khớp TỰ ĐỘNG). */
export function bankReconCompat(debitCat: DebitCat, docModule: string): boolean {
  if (debitCat === 'cash') return false; // rút quỹ tiền mặt: không auto khớp gì
  if (docModule === 'fx_transfer') return debitCat === 'transfer';
  if (docModule === 'thu_chi_tbs') return debitCat === 'other';
  return debitCat !== 'transfer'; // module lạ: cho khớp nếu KHÔNG phải lệnh nội bộ
}

export interface ReconDebit {
  id: number;
  amount: Dec;
  /** nửa đêm VN của cdate (`strtotime(date('Y-m-d', cdate))`) */
  date: number;
  /** nội dung chuyển khoản — CHỈ dùng để phân loại; tầng service KHÔNG trả ra ngoài */
  content: string | null;
}
export interface ReconDoc {
  module: string;
  id: number;
  amount: Dec;
  date: number;
}
export interface ReconLink {
  matchType: string;
  docModule: string;
  docId: number;
  note: string;
}
export type ReconStatus = 'ignore' | 'manual' | 'matched' | 'unmatched';
export interface ReconRow<B extends ReconDebit, D extends ReconDoc> {
  bank: B;
  status: ReconStatus;
  doc: D | null;
  matchType: '' | 'ignore' | 'manual' | 'auto';
  note: string;
}

/**
 * `bank_recon_subset_sum` — duyệt bitmask 1 … 2ⁿ−1 theo THỨ TỰ SỐ, trả tổ hợp ĐẦU TIÊN có
 * `|tổng − đích| < 0,001` (phần tử giữ thứ tự chỉ số). Tie-break = mask nhỏ nhất: {0} < {1} < {0,1} < {2}…
 * Không có ⇒ null. (Người gọi giới hạn n ∈ [2, 12] ⇒ tối đa 4.095 mask.)
 */
export function bankReconSubsetSum<T extends { amount: Dec }>(items: T[], target: Dec): T[] | null {
  const n = items.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    let s = new Decimal(0);
    const pick: T[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        s = s.plus(items[i].amount);
        pick.push(items[i]);
      }
    }
    if (s.minus(target).abs().lt(TOL)) return pick;
  }
  return null;
}

/**
 * `bank_recon_match($debits, $docs, $links, $windowDays)` — nguyên văn:
 *  1. link: `ignore` ⇒ ignore; MỌI loại khác (manual/auto/fee…) ⇒ `manual` (doc tra theo `module#id`,
 *     khoá trùng thì chứng từ nạp SAU thắng — như mảng kết hợp PHP).
 *  2. 1-1: cùng tiền (±0,001), |ngày| ≤ cửa sổ, compat; chọn chứng từ gần ngày nhất (hoà ⇒ chứng từ ĐẦU).
 *  3. gộp N-1: chỉ các lệnh CÙNG MỘT NGÀY; duyệt chứng từ theo thứ tự, ngày theo thứ tự xuất hiện;
 *     2–12 lệnh ứng viên; subset-sum ⇒ nhận tổ hợp đầu tiên rồi sang chứng từ kế.
 *  4. còn lại ⇒ unmatched. `orphanDocs` = chứng từ chưa dùng. `totals.matched` gồm cả manual.
 */
export function bankReconMatch<B extends ReconDebit, D extends ReconDoc>(
  debits: B[],
  docs: D[],
  links: Map<number, ReconLink> = new Map(),
  windowDays = 3,
): { rows: ReconRow<B, D>[]; orphanDocs: D[]; totals: { bank: Dec; matched: Dec; unmatched: Dec } } {
  const win = windowDays * 86400;
  const docUsed = docs.map(() => false);
  const docByKey = new Map<string, number>();
  docs.forEach((d, di) => docByKey.set(d.module + '#' + d.id, di));

  const rows = new Map<number, ReconRow<B, D>>();
  for (const b of debits) {
    const bid = Math.trunc(b.id);
    const lk = links.get(bid);
    if (!lk) continue;
    if (lk.matchType === 'ignore') {
      rows.set(bid, { bank: b, status: 'ignore', doc: null, matchType: 'ignore', note: lk.note ?? '' });
    } else {
      const di = docByKey.get((lk.docModule ?? '') + '#' + (lk.docId ?? 0));
      const doc = di !== undefined ? docs[di] : null;
      if (di !== undefined) docUsed[di] = true;
      rows.set(bid, { bank: b, status: 'manual', doc, matchType: 'manual', note: lk.note ?? '' });
    }
  }
  for (const b of debits) {
    const bid = Math.trunc(b.id);
    if (rows.has(bid)) continue;
    let best = -1;
    const cat = bankReconDebitCat(b.content);
    docs.forEach((d, di) => {
      if (docUsed[di]) return;
      if (d.amount.minus(b.amount).abs().gt(TOL)) return;
      if (Math.abs(d.date - b.date) > win) return;
      if (!bankReconCompat(cat, d.module)) return;
      if (best < 0 || Math.abs(docs[di].date - b.date) < Math.abs(docs[best].date - b.date)) best = di;
    });
    if (best >= 0) {
      docUsed[best] = true;
      rows.set(bid, { bank: b, status: 'matched', doc: docs[best], matchType: 'auto', note: '' });
    }
  }
  const remaining = debits.filter((b) => !rows.has(Math.trunc(b.id)));
  // gộp N-1: CHỈ gộp các lệnh CÙNG MỘT NGÀY; ngày đó phải trong cửa sổ của phiếu
  const usedInGroup = new Set<number>();
  const byDay = new Map<number, B[]>(); // Map giữ thứ tự chèn = mảng kết hợp PHP
  for (const b of remaining) {
    const day = Math.trunc(b.date);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(b);
  }
  docs.forEach((d, di) => {
    if (docUsed[di]) return;
    for (const [day, lines] of byDay) {
      if (Math.abs(d.date - day) > win) continue;
      const cand = lines.filter((b) => !usedInGroup.has(b.id) && bankReconCompat(bankReconDebitCat(b.content), d.module));
      if (cand.length < 2 || cand.length > 12) continue;
      const grp = bankReconSubsetSum(cand, d.amount);
      if (grp === null) continue;
      for (const b of grp) {
        rows.set(Math.trunc(b.id), { bank: b, status: 'matched', doc: docs[di], matchType: 'auto', note: '' });
        usedInGroup.add(b.id);
      }
      docUsed[di] = true;
      break;
    }
  });
  for (const b of debits) {
    const bid = Math.trunc(b.id);
    if (!rows.has(bid)) rows.set(bid, { bank: b, status: 'unmatched', doc: null, matchType: '', note: '' });
  }
  const orphanDocs = docs.filter((_, di) => !docUsed[di]);
  let tb = new Decimal(0);
  let tm = new Decimal(0);
  let tu = new Decimal(0);
  for (const b of debits) tb = tb.plus(b.amount);
  for (const r of rows.values()) {
    if (r.status === 'matched' || r.status === 'manual') tm = tm.plus(r.bank.amount);
    else if (r.status === 'unmatched') tu = tu.plus(r.bank.amount);
  }
  const ordered = debits.map((b) => rows.get(Math.trunc(b.id))!);
  return { rows: ordered, orphanDocs, totals: { bank: tb, matched: tm, unmatched: tu } };
}

/** `strtotime(date('Y-m-d', $cdate))` với múi giờ máy chủ prod Asia/Ho_Chi_Minh (UTC+7, không DST). */
export function vnMidnight(cdate: number | null | undefined): number {
  const t = Math.trunc(Number(cdate ?? 0)) || 0;
  const off = 7 * 3600;
  return t - ((((t + off) % 86400) + 86400) % 86400);
}
