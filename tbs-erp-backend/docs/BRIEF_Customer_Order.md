# 💡 BRIEF: Cải tiến luồng Tạo Khách Hàng & Đơn Hàng

**Ngày tạo:** 2026-03-05
**Brainstorm cùng:** Ban Quản Trị Hệ Thống ERP TBS

---

## 1. VẤN ĐỀ CẦN GIẢI QUYẾT (THỰC TRẠNG)
Qua quá trình Test luồng tạo Đơn Hàng thực tế trên trình duyệt, em nhận thấy User (đặc biệt là bộ phận Sale) đang gặp một số "điểm nghẽn" (bottleneck) trong thao tác:
1. **Đứt gãy luồng làm việc:** Nếu khách hàng gọi điện chốt đơn nhưng thông tin khách hàng chưa có trên hệ thống, Sale phải thoát trang "Tạo đơn hàng", sang trang "Khách hàng" để tạo mới, rồi mới quay lại tạo đơn từ đầu.
2. **Thiếu cảnh báo sớm (Pre-flight check):** Lỗi kinh điển vừa xảy ra là người dùng hì hục điền xong toàn bộ thông tin đơn hàng, bấm Submit mới báo lỗi "Thiếu mã Sale (saleCode)". Hệ thống nên chặn ngay từ khi mở trang.
3. **Mất Dữ Liệu:** Form tạo đơn hàng khá dài (Thông tin chung -> Sản phẩm -> Vận chuyển). Nếu rớt mạng hoặc báo lỗi, dữ liệu có thể bay mất.

## 2. GIẢI PHÁP ĐỀ XUẤT (CẢI TIẾN UX/UI)
Dựa trên trải nghiệm thực tế, em đề xuất 4 điểm cải tiến:

- **Giải pháp 1: Form "Tạo Khách Hàng Nhanh" (Quick Add Modal)**
  Ngay tại ô tìm kiếm Khách Hàng trong trang Tạo Đơn, thêm nút `+ Thêm Khách Hàng Mới`. Nhấn vào sẽ hiện một Popup nhỏ chỉ hỏi các trường bắt buộc (Tên, SĐT, Kênh liên hệ). Tạo xong tự động fill vào Đơn hàng.

- **Giải pháp 2: Hệ thống Auto-Draft (Lưu Nháp Tự Động)**
  Lưu trạng thái form liên tục vào LocalStorage của trình duyệt hoặc Redis. Nếu Sale lỡ đóng tab hoặc lỗi mạng, khi mở lại form sẽ hỏi: "Bạn có muốn tiếp tục đơn hàng đang soạn dở không?".

- **Giải pháp 3: Validate Quyền Tức Thì (Early Validation)**
  Ngay khi load trang `/don-hang/tao-moi`, Backend bắn API check trước. Nếu thiếu `saleCode` hoặc Khách Hàng bị Block công nợ, giao diện sẽ khóa form (Disabled) và hiện cảnh báo màu Đỏ ngay lập tức.

- **Giải pháp 4: Nhân bản Đơn hàng (Clone Order)**
  Nhiều khách hàng nhập đi nhập lại cùng một danh sách sản phẩm. Thêm nút "Tạo lại đơn này" từ trang Chi tiết Đơn hàng cũ.

## 3. PHÂN LOẠI ĐỘ ƯU TIÊN (PRIORITIZATION)

### 🚀 Ưu tiên cao (Dễ làm - Tác động lớn):
- [ ] **Thêm nút & Popup "Tạo Khách Mới"** ngay trong form Tạo Đơn.
- [ ] **Kiểm tra quyền Sale** ngay khi load trang Tạo Đơn (Early Validation).

### 🎁 Ưu tiên vừa (Cần code thêm logic):
- [ ] Tính năng **Lưu Nháp (Auto-Draft)**.
- [ ] Nút **Nhân bản Đơn hàng cũ**.

## 4. ƯỚC TÍNH SƠ BỘ & KỸ THUẬT
- **Độ phức tạp:** Trung bình (Frontend chủ yếu dùng React Hook Form và Radix UI Dialog. Backend chỉ cần thêm API tạo khách rút gọn).
- **Rủi ro:** Cần đảm bảo Popup tạo khách hàng phải sync ngay ID khách hàng mới vào state của Form đơn hàng hiện tại.

## 5. BƯỚC TIẾP THEO
→ Review bản nháp này, chốt phương án và chạy lệnh `/plan` để em bắt tay vào viêt Spec triển khai Code.
