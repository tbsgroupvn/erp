/**
 * Danh sách điểm duyệt `biz` cho cơ chế "trả về cho người nộp sửa" (CLS_TRAVE).
 * Chép nguyên văn `includes/return_checkpoints.php` prod (đo 24/09/2026, xem
 * docs/rewrite-spec/04b-tra-ve-nguoi-nop-sua.md §3.4) — hiện chỉ có ĐÚNG 1 khoá.
 *
 * Cả 8 `field_key` là tên cột thật của `tbl_payment` — `SupplierPaymentService`
 * (chưa dựng, #09) sẽ ghép thẳng vào `SET "<key>"=…` khi nộp lại, giống
 * `process_doc_resubmit.php` prod.
 */
export const RETURN_CHECKPOINTS: Record<string, { label: string; fields: Record<string, string> }> = {
  'payment.duyet_ncc': {
    label: 'Duyệt phiếu thanh toán NCC',
    fields: {
      ncc_invoice_images: 'Invoice',
      ncc_packing_list_images: 'Packing list',
      ncc_receiver: 'Người nhận',
      ncc_bank_name: 'Ngân hàng',
      ncc_bank_account: 'Số tài khoản',
      ncc_bank_note: 'Ghi chú chuyển khoản',
      price_cyn: 'Số tiền',
      rate_buy: 'Tỷ giá',
    },
  },
};
