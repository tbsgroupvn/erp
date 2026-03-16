# Phase 05: Testing
Status: ⬜ Pending
Dependencies: phase-04-ui.md

## Objective
Kiểm thử Toàn trình (End-to-End) luồng làm việc mới của nhân viên Sales. Đảm bảo UI/UX mượt mà, không gián đoạn, không lỗi bảo mật quyền năng.

## Requirements
### Functional
- [ ] Chạy Automation Script giả lập tài khoản GĐ (không có Sale Code) cố gắng bấm Tạo Đơn -> Bị hệ thống cấm.
- [ ] Chạy Automation Script giả lập tài khoản NV KD (có Sale Code) tạo khách hàng mới ngay trong form và submit đơn hàng thành công.
- [ ] Manual Test: Rút dây mạng / Refresh giữa chừng để test LocalStorage Draft.

### Non-Functional
- [ ] Performance: Popup Load nhanh không bị lag, Search Combobox update tức thì sau khi POST Khách hàng mới.

## Implementation Steps
1. [ ] Viết API test (Postman / Jest) cho endpoint Quick Add.
2. [ ] Chỉ định Browser Subagent thực thi lại quy trình E2E tạo đơn trên UI port 3001.
3. [ ] Ghi lại Video kết quả và đính kèm vào Report.

## Test Criteria
- [ ] Vượt qua 100% test case Validation quyền Hạn.
- [ ] Luồng tạo khách -> tạo đơn dứt điểm trong 1 thao tác không cần chuyển trang.

---
Next Phase: Hoàn thành Plan. Đợi User sử dụng lệnh báo cáo để kết luận.
