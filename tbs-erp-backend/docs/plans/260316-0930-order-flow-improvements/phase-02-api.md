Status: ✅ Complete
Dependencies: phase-01-design.md

## Objective
Cung cấp các endpoints cần thiết để Frontend có thể xác thực quyền Sale, tạo nhanh Khách hàng và hỗ trợ Order Cloning (nếu cần xử lý phức tạp ở server).

## Requirements
### Functional
- [x] **Quick Add Customer API:** `POST /api/v1/customers/quick`
  - Body: `{ fullName, phone, email(opt), source(opt) }`
  - Response: Trả về Customer Object với `id` để fill vào dropdown.
- [x] **Early Validation API / Logic:** Bổ sung trường `hasSaleCode` vào Payload JWT khi đăng nhập HOẶC tạo `GET /api/v1/users/me/permissions`.
- [ ] **Clone Order API (Optional):** `POST /api/v1/orders/:id/clone`
  - Trả về bản nháp của Đơn hàng mới (Status DRAFT) chứa chung Items.

### Non-Functional
- [x] Quick Add Customer cần xử lý trùng lặp Phone Number.

## Implementation Steps
1. [x] Viết/Cập nhật Controller, Service, DTO cho Customer module.
2. [x] Viết Data Access logic trong Repository.
3. [x] Bổ sung/chỉnh sửa Auth Guard liên quan đến `saleCode`.
4. [x] Viết Unit Test cho các API mới.

## Files to Create/Modify
- `src/modules/customer/customer.controller.ts`
- `src/modules/customer/customer.service.ts`
- `src/modules/customer/dto/create-customer-quick.dto.ts`
- `src/modules/auth/auth.service.ts` (nếu nhét quyền vào Token)

## Test Criteria
- [x] Postman / Jest tự động gọi được `/customers/quick`.
- [x] Bắt lỗi 403 Forbidden nếu user tạo đơn không có sale code.

---
Next Phase: phase-03-state.md
