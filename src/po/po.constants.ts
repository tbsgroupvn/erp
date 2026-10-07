// Vòng đời PO — TUẦN TỰ, không nhảy cóc: 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6, với
// -1 (Huỷ) đạt tới từ bất kỳ trạng thái nào và quay lại đúng chỗ cũ qua
// `cancelPrevStatus` (PoService.restoreFromCancel).
//
// ⚠ Đo PROD 23/09/2026 (xem plans/2026-09-23-06-po-plan.md, bảng "Sự thật đã
// ĐO"): `purchase_orders.status` CHỈ có -1(9) · 0(33) · 1(5) · 2(1) · 3(255).
// CHƯA CÓ dòng thật nào ở 4 (THUC_HIEN) / 5 (DA_GIAO) / 6 (TAT_TOAN) — máy
// trạng thái vẫn dựng đủ theo spec, nhưng đường 4/5/6 hoàn toàn do test tự
// dựng, đừng tưởng đã được prod phủ.
export const PoStatus = {
  NHAP: 0,
  CHO_LEADER: 1,
  CHO_TPKD: 2,
  DA_DUYET: 3,
  THUC_HIEN: 4,
  DA_GIAO: 5,
  TAT_TOAN: 6,
  HUY: -1,
} as const;

const LABEL: Record<number, string> = {
  0: 'Nháp',
  1: 'Chờ Leader',
  2: 'Chờ TP.KD',
  3: 'Đã duyệt',
  4: 'Thực hiện',
  5: 'Đã giao',
  6: 'Tất toán',
  [-1]: 'Hủy',
};
export function statusLabel(n: number): string { return LABEL[n] ?? '?'; }

/**
 * D5 Q-D5-5 (quyết định chủ DN 25/09/2026): PO thuộc về sale THEO KHÁCH MUA như web prod
 * (`components/com_po/task/list.php:19,24`), KHÔNG theo người tạo (app). v2 không có cột mã khách
 * trên PO (`buyerCode` trong tài liệu D5 là tên giả định) — nối bằng `buyerId` → `Customer.id` qua H3
 * (`ScopeService.buildDocScope` `viaCustomer` + `viaCustomerKey:'id'`). PO chưa gắn khách (`buyerId`
 * NULL/0) bị ẩn với mọi phạm vi hẹp hơn `all` — như danh sách web prod.
 *
 * ⚠ MỘT chỗ khai cho MỌI đường đọc PO (`PoService.listForUser`, `PoTienNccService`, ScopeGuard
 * entity `purchaseOrder`) — đừng chép cấu hình này ra nơi khác (bài học "bản sao logic").
 */
export const PO_OWNER_FIELDS = Object.freeze({ viaCustomer: 'buyerId', viaCustomerKey: 'id' as const });
