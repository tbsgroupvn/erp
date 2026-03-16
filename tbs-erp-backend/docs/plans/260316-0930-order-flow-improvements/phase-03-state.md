# Phase 03: Frontend App State & LocalStorage
Status: ⬜ Pending
Dependencies: phase-01-design.md

## Objective
Xây dựng lớp quản lý trạng thái (State Management) trên Client-side để lưu nháp (Auto-Draft) và phục hồi form tự động nếu sự cố xảy ra.

## Requirements
### Functional
- [ ] Hook `useOrderDraft(entityId, initialData)` sử dụng SessionStorage/LocalStorage hoặc Zustand Persist.
- [ ] Tính năng "Phát hiện bản nháp": Nếu có dữ liệu cũ chưa submit thành công, nhắc nhở User (Pop-over / Alert).
- [ ] Xóa bản nháp sau khi Gửi đơn thành công.

### Non-Functional
- [ ] Draft State không được phình to quá mức giới hạn Storage (tránh Error QuotaExceeded).
- [ ] Timeout dọn dẹp (VD: Auto clear sau 24h).

## Implementation Steps
1. [ ] Cài đặt hoặc tự viết Custom Hook quản lý vòng đời bộ nhớ tạm.
2. [ ] Tích hợp vào `page.tsx` của `/don-hang/tao-moi`.
3. [ ] Xây dựng thông báo (Toast/Banner) cho việc Recover Data.

## Test Criteria
- [ ] Nhập thông tin > Refresh trang (F5) > Dữ liệu vẫn còn.
- [ ] Nhấn Cancel Order > Dữ liệu mất.
- [ ] Nhấn Submit Thành Công > Dữ liệu mất.

---
Next Phase: phase-04-ui.md
