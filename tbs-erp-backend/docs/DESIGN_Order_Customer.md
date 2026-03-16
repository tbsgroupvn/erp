# 🎨 DESIGN: Cải tiến Luồng Tạo Đơn Hàng & Khách Hàng

Ngày tạo: 2026-03-16
Dựa trên: `docs/BRIEF_Customer_Order.md` và `docs/plans/260316-0930-order-flow-improvements/plan.md`

---

## 1. Cách Lưu Thông Tin (Database & State)

### 1.1 Khách Hàng Nhanh (Database Schema)
Bảng `Customer` (CRM) giữ nguyên cấu trúc cũ, nhưng API tạo nhanh sẽ gán một số trường mặc định:
- `tier` mặc định là `NEW`.
- `creditLimit`, `currentDebt` mặc định `0`.
- `depositRate` mặc định `100`.

### 1.2 Lưu Nháp Đơn Hàng (Local State Management)
Chúng ta sẽ sử dụng LocalStorage kết hợp thư viện Zustand (hoặc React Hook) để lưu dữ liệu chưa hoàn tất.

```json
// Cấu trúc Data lưu trong trình duyệt: "tbs_order_draft"
{
  "customerId": "cuid_xxx",
  "branch": "HCM",
  "serviceType": "MHH",
  "items": [
     { "productName": "Laptop Mac", "quantity": 1, "unitPrice": 100 }
  ],
  "lastUpdated": "2026-03-16T10:00:00Z"
}
```

---

## 2. Danh Sách Màn Hình (UI Components)

Dưới đây là thiết kế các thay đổi giao diện trên màn hình hiện có:

| # | Màn hình / Component | Mục đích |
|---|---------------------|----------|
| 1 | **Tạo Đơn Hàng (Page)** | Nếu User không có quyền Sale → Nút Submit **bị Khóa (Disabled)**. Có Banner đỏ cảnh báo. |
| 2 | **Customer Selector (Combo-box)** | Dưới cùng của danh sách tìm kiếm KH sẽ có Footer: `[+ Thêm khách hàng mới]`. |
| 3 | **Quick Add Modal (Dialog)** | Form tạo KH rút gọn. Chỉ có 3 trường: **Tên**, **SĐT**, **Email** (tùy chọn). Bấm Lưu → Tự động chọn luôn KH đó. |
| 4 | **Draft Restore Banner (Alert)** | Hiển thị thông báo màu xanh dương: `"Bạn có dữ liệu đơn hàng đang tạo dở từ 10 phút trước. [Tiếp tục] / [Xóa bỏ]"` |

---

## 3. Luồng Hoạt Động (User Journey)

### 📍 Mốc 1: Nhân viên Tạo Khách Hàng Mới ngay lúc lên đơn
1️⃣ Mở trang Tạo đơn hàng → Bấm tìm Tên khách.
2️⃣ Khách chưa có trong hệ thống? → Bấm nút `[+]`.
3️⃣ Hiện Popup → Nhập Tên: "Chú Vượng", SĐT: "0909..." → Bấm Lưu.
4️⃣ Popup đóng lại. Form Tạo đơn tự động điền "Chú Vượng" vào ô Khách Hàng.

### 📍 Mốc 2: Rớt mạng khi điền đơn
1️⃣ Nhân viên điền xong Thông tin chung & Hàng hóa (chưa Submit).
2️⃣ Lỡ tay tắt trình duyệt hoặc cúp điện.
3️⃣ Mở lại link Tạo đơn.
4️⃣ Hệ thống hỏi: `"Bạn có muốn lấy lại dữ liệu đang gõ dở không?"`. Bấm "Đồng ý" → Form điền lại y chang lúc nãy.

### 📍 Mốc 3: Nhập đơn hăng say nhưng Không Có Quyền
1️⃣ Kế toán (không được cấp Sale Code) mở trang Tạo đơn.
2️⃣ Ngay khi Load, hệ thống báo đỏ: `"⚠️ Tài khoản của bạn không được phân quyền tạo Đơn hàng (Thiếu Sale Code)"`.
3️⃣ Tất cả các nút `Nhập Đơn`, `Lưu Đơn` bị làm mờ, không thể bấm.

---

## 4. Checklist Kiểm Tra (Acceptance Criteria / Test Cases)

### 🧪 TC-01: Tạo Khách Rút Gọn (Quick Add)
- [ ] Bấm Nút (+) hiện Modal Create Customer.
- [ ] Bỏ trống Tên/SĐT hệ thống chặn không cho lưu.
- [ ] Tạo thành công KH, Select Box tự động chọn KH vừa tạo.

### 🧪 TC-02: Phục hồi Dữ Liệu Bản Nháp (Auto-Draft)
- [ ] Form thay đổi dữ liệu sẽ tự động lưu vào LocalStorage (Delay 500ms).
- [ ] Tắt trình duyệt, mở lại trang `/don-hang/tao-moi` sẽ hiện thông báo khôi phục (Resume).
- [ ] Bấm Resume thì dữ liệu cũ được load đầy đủ vào Form.
- [ ] Bấm Submit thành công đơn hàng, LocalStorage tự động xóa sạch dữ liệu Draft.

### 🧪 TC-03: Kiểm tra Quyền Sale (Early Role Validation)
- [ ] Tài khoản Admin/Kế Toán truy cập trang tạo đơn sẽ thấy Banner Cảnh Báo "Lỗi quyền". Nút Submit tạo đơn bị vô hiệu hóa (Disabled).
- [ ] Tài khoản Sale chuyên trách truy cập tạo đơn bình thường.

---
*Tạo bởi AWF - Design Workflow Phase*
