# Phase 04: Frontend UI & Integration
Status: ⬜ Pending
Dependencies: phase-02-api.md, phase-03-state.md

## Objective
Tích hợp tất cả mảnh ghép để tạo thành giao diện mượt mà: Modal tạo Khách hàng tại chỗ, Logic Check Quyền tạo đơn, và Hook Lưu nháp. Bổ sung nút "Tạo lại đơn này" (Clone) ở màn hình Chi tiết.

## Requirements
### Functional
- [ ] **Quick Add Customer Modal:** Ở Component Search Khách hàng, khi không tìm thấy kết quả hoặc thả dropdown, có nút `+ Thêm mới`. Bấm vào sẽ hiện Shadcn Dialog.
- [ ] **Integration API:** Thêm mới Customer -> Gọi API (`POST /customers/quick`) -> Gọi Mutation -> Invalidate Queries -> Set giá trị Form Order = Customer ID vừa tạo.
- [ ] **Auth / Rule Guard:** Tại lệnh Load (Server Action) của Trang Tạo đơn, check xem user có `saleCode` không. Nếu không, trả về UI Error State (hoặc Disable toàn bộ button Submit và hiện Banner Đỏ to rõ).
- [ ] **Order Clone Button:** Ở trang `/don-hang/[id]`, thêm nút "Nhân bản" (Copy Item List sang Tạo Mới).

## Implementation Steps
1. [ ] Tạo Component `QuickCustomerFormDialog.tsx`.
2. [ ] Sửa Component `CustomerSelector.tsx` (hoặc Combo-box tương tự) để nhúng Dialog.
3. [ ] Viết API client function `createQuickCustomer()`.
4. [ ] Bổ sung Component Alert/Banner cho việc chặn `saleCode` ở `page.tsx`.

## Files to Create/Modify
- `src/lib/api/customers.api.ts`
- Thư mục components liên quan đến combobox & dialog của form đặt hàng.
- `src/app/(dashboard)/don-hang/tao-moi/page.tsx`
- `src/app/(dashboard)/don-hang/[id]/page.tsx`

## Test Criteria
- [ ] Tạo được khách từ Modal trong form Tạo Đơn, khách này tự chọn luôn vào Form.
- [ ] Tài khoản Admin không có SalesCode sẽ thấy nút "Tạo Đơn" bị xám/vô hiệu hóa.
- [ ] Bấm nút "Nhân bản đơn hàng" trên đơn cũ chuyển hướng sang Form điền sẵn data cũ.

---
Next Phase: phase-05-testing.md
