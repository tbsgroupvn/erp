# Phase 01: Setup & Design Specs
Status: ⬜ Pending
Dependencies: None

## Objective
Thiết kế chi tiết DTO, API Endpoint, Flowchart và UX Map cho các tính năng mới trước khi bắt tay vào Code. (Thực hiện thông qua lệnh `/design`)

## Requirements
### Functional
- [ ] Lên tài liệu thiết kế Schema/DTO cho tính năng "Tạo Khách Hàng Rút Gọn" (Quick Add).
- [ ] Viết mô tả Logic API kiểm tra quyền SaleCode (Auth Guard / Interceptor).
- [ ] Xác định cấu trúc Zustand Store / LocalStorage key để lưu nháp (Auto-Draft) Đơn hàng.
- [ ] Vẽ Flowchart luồng tạo Đơn Hàng mới kết hợp Quick Add và Auto-Draft.

### Non-Functional
- [ ] Technical Design Document (TDD) cần gọn gàng, rõ ràng.

## Implementation Steps
1. [ ] Gọi `/design` báo cáo User.
2. [ ] Tạo file spec chi tiết trong `docs/specs`.
3. [ ] User duyệt spec.

## Test Criteria
- [ ] User đồng ý với bản thiết kế `/design`.

---
Next Phase: phase-02-api.md
