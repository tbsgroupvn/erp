/**
 * Bất thường §3 của tài liệu migration ("mỗi dòng cần người ký"): ETL nạp theo
 * MẶC ĐỊNH tài liệu ghi rồi LIỆT KÊ số đếm ở báo cáo. Mọi câu chỉ trả COUNT(*)
 * trên NGUỒN (MariaDB diễn tập) — không trả dòng, không trả STK/nội dung CK.
 */
export interface AnomalyQuery {
  id: string;
  doc: string;
  description: string;
  /** mặc định đã áp khi nạp. */
  applied: string;
  /** true ⇒ tài liệu ghi "≥1 ⇒ DỪNG, hỏi" — ETL không tự dừng, báo cáo gắn cờ. */
  stopIfNonZero?: boolean;
  /** true ⇒ ≠0 là mục CẦN KÝ (không dừng) — vd G-DOC-3 đã chuẩn hoá giá trị. */
  signOffIfNonZero?: boolean;
  sql: string;
}

export const ANOMALY_QUERIES: readonly AnomalyQuery[] = [
  // ---------------------------------------------------------------- 09b §3
  {
    id: '09b-B1',
    doc: '09b §3',
    description: 'dòng sổ quỹ tk_code không có trong tbl_accounts (CHI-TBS…)',
    applied: 'nạp nguyên, không FK',
    sql: 'SELECT COUNT(*) FROM tbl_account_histories h WHERE NOT EXISTS (SELECT 1 FROM tbl_accounts a WHERE BINARY a.code=BINARY h.tk_code)',
  },
  {
    id: '09b-B2',
    doc: '09b §3',
    description: 'dòng sổ TK09 của phiếu chi TBS #9337 bị từ chối còn status 1 (id 1788418674)',
    applied: 'nạp nguyên, gắn cờ đối chiếu (Q6)',
    sql: 'SELECT COUNT(*) FROM tbl_account_histories WHERE id=1788418674 AND status=1',
  },
  {
    id: '09b-B3',
    doc: '09b §3',
    description: 'dòng sổ vào TK07 (ẩn, store, gl_account rỗng)',
    applied: 'nạp nguyên (Q7)',
    sql: "SELECT COUNT(*) FROM tbl_account_histories WHERE BINARY tk_code='TK07'",
  },
  {
    id: '09b-B4/09a-A6',
    doc: '09b §3 / 09a §3',
    description: "dòng sổ source_module='payment' trỏ phiếu không còn",
    applied: 'nạp nguyên (cờ đối chiếu Q6)',
    sql: "SELECT COUNT(*) FROM tbl_account_histories h WHERE h.source_module='payment' AND NOT EXISTS (SELECT 1 FROM tbl_payment p WHERE p.id=h.source_id)",
  },
  {
    id: '09b-B5/09c-C4',
    doc: '09b §3 / 09c §3.2',
    description: 'dòng sổ họ FX của FX #19 (cancelled, đã bù bằng fx_huy*)',
    applied: "nạp nguyên; KHÔNG chạy daoTheoNguon('fx_transfer',19)",
    sql: "SELECT COUNT(*) FROM tbl_account_histories WHERE source_id=19 AND (source_module LIKE 'fx%' OR source_module LIKE 'daoxoa\\_fx%')",
  },
  {
    id: '09b-B8',
    doc: '09b §3',
    description: 'dòng fx_transfer có rate bị cắt 2 lẻ so với tbl_fx_transfers.rate',
    applied: 'nạp nguyên (không "sửa")',
    sql: "SELECT COUNT(*) FROM tbl_account_histories h JOIN tbl_fx_transfers f ON f.id=h.source_id WHERE h.source_module='fx_transfer' AND h.rate IS NOT NULL AND h.rate<>f.rate",
  },
  // ---------------------------------------------------------------- 09c §2.2 / §3.2
  {
    id: '09c-2.2',
    doc: '09c §2.2',
    description: 'tbl_fx_adjustments có dòng (bảng bật cho_am khi duyệt lại)',
    applied: 'tài liệu: ≠0 ⇒ DỪNG, đo lại',
    stopIfNonZero: true,
    sql: 'SELECT COUNT(*) FROM tbl_fx_adjustments',
  },
  {
    id: '09c-C2/09b-B9',
    doc: '09c §3.2',
    description: 'phiếu FX trỏ approval_request_id không còn',
    applied: 'nạp nguyên, không FK; danh sách cho kế toán',
    sql: 'SELECT COUNT(*) FROM tbl_fx_transfers f WHERE NOT EXISTS (SELECT 1 FROM tbl_approval_requests r WHERE r.id=f.approval_request_id)',
  },
  {
    id: '09c-C3',
    doc: '09c §3.2 / §4',
    description: 'phiếu FX đang pending/failed',
    applied: 'nạp nguyên; kế toán quyết trước khi rút',
    sql: "SELECT COUNT(*) FROM tbl_fx_transfers WHERE status IN ('pending','failed')",
  },
  {
    id: '09c-C5',
    doc: '09c §3.2',
    description: 'lệnh chi có chi_match và reconcile_link trỏ 2 chứng từ khác nhau',
    applied: 'nạp nguyên cả hai bảng (Q-BANK-4)',
    sql: "SELECT COUNT(*) FROM tbl_bank_chi_match m JOIN tbl_bank_reconcile_link l ON l.bank_tran_id=m.bank_tx_id WHERE NOT (l.doc_module='thu_chi_tbs' AND l.doc_id=m.request_id)",
  },
  {
    id: '09c-C7',
    doc: '09c §3.2',
    description: 'tbl_account_changelog.changes có khoá stk',
    applied: 'nạp nguyên, KHÔNG log (M9c-4)',
    sql: "SELECT COUNT(*) FROM tbl_account_changelog WHERE changes LIKE '%\"stk\"%'",
  },
  {
    id: '09c-C9',
    doc: '09c §3.2',
    description: 'FX rejected có rate=67 (ngoài biên)',
    applied: 'nạp nguyên (lịch sử)',
    sql: "SELECT COUNT(*) FROM tbl_fx_transfers WHERE status='rejected' AND rate=67",
  },
  // ---------------------------------------------------------------- 09a §3
  {
    id: '09a-A1',
    doc: '09a §3',
    description: 'tbl_payment.order_id>0 trỏ đơn không còn',
    applied: 'nạp nguyên (không FK)',
    sql: 'SELECT COUNT(*) FROM tbl_payment p WHERE p.order_id>0 AND NOT EXISTS (SELECT 1 FROM tbl_order o WHERE o.id=p.order_id)',
  },
  {
    id: '09a-A2',
    doc: '09a §3',
    description: 'tbl_payment_orders trỏ phiếu không còn',
    applied: 'KHÔNG nạp (M1), đếm ở bảng SupplierPaymentOrder',
    sql: 'SELECT COUNT(*) FROM tbl_payment_orders x WHERE NOT EXISTS (SELECT 1 FROM tbl_payment p WHERE p.id=x.payment_id)',
  },
  {
    id: '09a-A3',
    doc: '09a §3',
    description: 'Σ tbl_payment_orders.rmb ≠ price_cyn',
    applied: 'nạp nguyên; kế toán quyết (Q1)',
    sql: 'SELECT COUNT(*) FROM (SELECT p.id FROM tbl_payment p JOIN tbl_payment_orders x ON x.payment_id=p.id GROUP BY p.id, p.price_cyn HAVING SUM(x.rmb)<>p.price_cyn) t',
  },
  {
    id: '09a-A4',
    doc: '09a §3',
    description: 'price_payment ≠ ROUND(price_cyn*rate_buy) (lỗi L1)',
    applied: 'nạp nguyên; KHÔNG sửa trong ETL',
    sql: 'SELECT COUNT(*) FROM tbl_payment WHERE price_payment IS NOT NULL AND price_payment<>ROUND(price_cyn*rate_buy)',
  },
  {
    id: '09a-A5',
    doc: '09a §3',
    description: 'tbl_payment_log trỏ phiếu không còn',
    applied: 'NẠP (vết xoá phải sống)',
    sql: 'SELECT COUNT(*) FROM tbl_payment_log l WHERE NOT EXISTS (SELECT 1 FROM tbl_payment p WHERE p.id=l.payment_id)',
  },
  {
    id: '09a-A7',
    doc: '09a §3',
    description: 'phiếu cdate ở tương lai (so với giờ máy chạy ETL)',
    applied: 'nạp nguyên',
    sql: 'SELECT COUNT(*) FROM tbl_payment WHERE cdate>UNIX_TIMESTAMP()',
  },
  {
    id: '09a-A8',
    doc: '09a §3',
    description: 'status ≠ confirm',
    applied: 'nạp nguyên — tài liệu: ≥1 ⇒ DỪNG, hỏi',
    stopIfNonZero: true,
    sql: 'SELECT COUNT(*) FROM tbl_payment WHERE NOT (status <=> confirm)',
  },
  {
    id: '09a-A9',
    doc: '09a §3',
    description: "phiếu confirm='no' đang có GL/sổ quỹ",
    applied: 'nạp nguyên — tài liệu: ≥1 ⇒ DỪNG',
    stopIfNonZero: true,
    sql: "SELECT COUNT(*) FROM tbl_payment p WHERE p.confirm='no' AND (EXISTS(SELECT 1 FROM tbl_gl_entry e WHERE e.source_type='payment' AND e.source_id=p.id) OR EXISTS(SELECT 1 FROM tbl_account_histories h WHERE h.source_module='payment' AND h.source_id=p.id))",
  },
  {
    id: '09a-ZZ',
    doc: '09a §3 (rác bộ test)',
    description: "phiếu saler LIKE 'zz%' OR code_order LIKE 'ZZ%'",
    applied: 'loại, đếm ở bảng SupplierPayment',
    sql: "SELECT COUNT(*) FROM tbl_payment WHERE saler LIKE 'zz%' OR code_order LIKE 'ZZ%'",
  },
  // ---------------------------------------------------------------- 04b §7.4 / §9.3
  {
    id: '04b-A1',
    doc: '04b §9.3',
    description: 'tbl_return_state trỏ phiếu duyệt không tồn tại',
    applied: 'KHÔNG nạp, đếm ở bảng ReturnState',
    sql: "SELECT COUNT(*) FROM tbl_return_state s WHERE s.object_type='approval_request' AND NOT EXISTS (SELECT 1 FROM tbl_approval_requests r WHERE r.id=s.object_id)",
  },
  {
    id: '04b-A2',
    doc: '04b §9.3',
    description: "returned trên phiếu đã thu hồi (status=-2)",
    applied: 'nạp nguyên trạng (không tự chọn — Q5)',
    sql: "SELECT COUNT(*) FROM tbl_return_state s JOIN tbl_approval_requests r ON r.id=s.object_id WHERE s.object_type='approval_request' AND s.state='returned' AND r.status=-2",
  },
  {
    id: '04b-A3',
    doc: '04b §9.2',
    description: 'returned mang data_after của vòng trước',
    applied: 'đặt NULL (mặc định §9.2; Q7 "không đụng" chưa chọn)',
    sql: "SELECT COUNT(*) FROM tbl_return_state WHERE state='returned' AND data_after IS NOT NULL AND data_after<>''",
  },
  {
    id: '04b-A4',
    doc: '04b §9.3',
    description: 'tbl_return_config approval trỏ bước không tồn tại',
    applied: 'KHÔNG nạp, đếm ở bảng ReturnConfig',
    sql: "SELECT COUNT(*) FROM tbl_return_config c WHERE c.checkpoint_type='approval' AND NOT EXISTS (SELECT 1 FROM tbl_approval_steps s WHERE CAST(s.id AS CHAR)=c.checkpoint_ref)",
  },
  {
    id: '04b-A5',
    doc: '04b §9.3',
    description: 'tbl_return_fields mồ côi (config không còn)',
    applied: 'KHÔNG nạp, đếm ở bảng ReturnConfigField',
    sql: 'SELECT COUNT(*) FROM tbl_return_fields f WHERE NOT EXISTS (SELECT 1 FROM tbl_return_config c WHERE c.id=f.config_id)',
  },
  {
    id: '04b-A6',
    doc: '04b §9.3',
    description: "approval_request resubmitted không có hành động 'resubmit'",
    applied: 'nạp nguyên trạng',
    sql: "SELECT COUNT(*) FROM tbl_return_state s WHERE s.object_type='approval_request' AND s.state='resubmitted' AND NOT EXISTS (SELECT 1 FROM tbl_approval_actions a WHERE a.request_id=s.object_id AND a.action='resubmit')",
  },
  // ---------------------------------------------------------------- G-DOC-3
  {
    id: 'G-DOC-3',
    doc: 'cutover-so-quy-ke-hoach G-DOC-3',
    description: 'mã quỹ (tk_code/account_code/from_tk/to_tk/agent_tk/code; payment_source.tk_code; changelog.account_code) khác TRIM+UPPER của chính nó; source_module khác TRIM',
    applied: 'chuẩn hoá khi ETL (TRIM+UPPER mã; TRIM source_module) — ≠0 là mục cần ký (09b §2.1 "giữ nguyên byte")',
    signOffIfNonZero: true,
    sql: [
      'SELECT',
      '(SELECT COUNT(*) FROM tbl_account_histories WHERE BINARY tk_code<>BINARY UPPER(TRIM(tk_code)) OR LENGTH(tk_code)<>LENGTH(TRIM(tk_code)) OR LENGTH(source_module)<>LENGTH(TRIM(source_module)))',
      '+(SELECT COUNT(*) FROM tbl_accounts WHERE BINARY code<>BINARY UPPER(TRIM(code)) OR LENGTH(code)<>LENGTH(TRIM(code)))',
      '+(SELECT COUNT(*) FROM tbl_payment WHERE BINARY account_code<>BINARY UPPER(TRIM(account_code)) OR LENGTH(account_code)<>LENGTH(TRIM(account_code)))',
      '+(SELECT COUNT(*) FROM tbl_fx_transfers WHERE BINARY CONCAT(from_tk,0x7c,to_tk,0x7c,agent_tk)<>BINARY UPPER(CONCAT(TRIM(from_tk),0x7c,TRIM(to_tk),0x7c,TRIM(agent_tk))))',
      '+(SELECT COUNT(*) FROM tbl_bank_transaction WHERE BINARY tk_code<>BINARY UPPER(TRIM(tk_code)) OR LENGTH(tk_code)<>LENGTH(TRIM(tk_code)))',
      '+(SELECT COUNT(*) FROM tbl_payment_source WHERE BINARY tk_code<>BINARY UPPER(TRIM(tk_code)) OR LENGTH(tk_code)<>LENGTH(TRIM(tk_code)))',
      '+(SELECT COUNT(*) FROM tbl_account_changelog WHERE BINARY account_code<>BINARY UPPER(TRIM(account_code)) OR LENGTH(account_code)<>LENGTH(TRIM(account_code)))',
    ].join(' '),
  },
];
