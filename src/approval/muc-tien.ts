/**
 * `muc_tien` — MÃ ĐỊNH TUYẾN DUYỆT theo mức tiền: 'lon' (≥ 5.000.000đ) / 'nho'.
 *
 * Nhánh rẽ prod so NGUYÊN VĂN, PHÂN BIỆT hoa thường: adjustment_cost 27/28/29, adjustment_podata 33/34,
 * adjustment_cogsfix 37 (`{"field_key":"muc_tien","operator":"=","value":"lon"|"nho"}`). Sai/thiếu giá
 * trị ⇒ rơi về nhánh MẶC ĐỊNH (vd 30 "TBS chịu — nhỏ": mất bước "Giám đốc duyệt").
 *
 * Prod tính PHÍA MÁY CHỦ, ajaxs/adjustment/process_save.php (HEAD):
 *   $amount_vnd = floatval($a['amount_vnd']);   // dòng tbl_adjustments vừa lưu — có dấu, không abs()
 *   $form['muc_tien'] = ($amount_vnd >= 5000000 ? 'lon' : 'nho');
 * cho kind cost / po_data / cogs_fix / order_cancel.
 *
 * ⛔ PHÂN HỆ ĐIỀU CHỈNH (chưa port) PHẢI gọi `applyMucTien(form, amountVnd)` NGAY TRƯỚC
 * `RequestService.submit()` cho các mẫu trong `MUC_TIEN_TEMPLATES`, với `amountVnd` là số tiền ĐÃ LƯU
 * phía máy chủ — KHÔNG lấy muc_tien (hay so_tien) từ client. Hiện chưa có nơi gọi nào trong v2.
 */
export const MUC_TIEN_NGUONG_VND = 5_000_000;

/** Mẫu mà prod điền muc_tien (process_save.php: kind → template). */
export const MUC_TIEN_TEMPLATES: readonly string[] = [
  'adjustment_cost', 'adjustment_podata', 'adjustment_cogsfix', 'adjustment_ordercancel',
];

export function mucTien(amountVnd: number | bigint): 'lon' | 'nho' {
  if (typeof amountVnd === 'bigint') return amountVnd >= BigInt(MUC_TIEN_NGUONG_VND) ? 'lon' : 'nho';
  if (!Number.isFinite(amountVnd)) throw new Error('muc_tien: số tiền không hợp lệ');
  return amountVnd >= MUC_TIEN_NGUONG_VND ? 'lon' : 'nho';
}

/** Bản sao `form` với `muc_tien` tính lại từ số tiền phía máy chủ — GHI ĐÈ mọi giá trị client gửi. */
export function applyMucTien<T extends Record<string, any>>(form: T, amountVnd: number | bigint): T & { muc_tien: 'lon' | 'nho' } {
  return { ...form, muc_tien: mucTien(amountVnd) };
}
