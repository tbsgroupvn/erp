# Design Specifications - TBS ERP Dashboard

## 🎯 Vibe & Concept
**"The Command Center"**
- Phong cách: Chuyên nghiệp, Đáng tin cậy, Doanh nghiệp (Corporate/Formal).
- Đối tượng: Ban Giám Đốc (Board of Directors), Quản lý Cấp cao.
- Cảm xúc: Uy tín, Rõ ràng, Dữ liệu chuẩn xác, Kiểm soát hoàn toàn.

## 🎨 Color Palette (Trust & Stability)
Chủ đạo là màu xanh Navy (tượng trưng cho sự tin cậy, bảo mật và tài chính), kết hợp với nền trắng xám sáng sủa để làm nổi bật dữ liệu.

| Name | Hex | Usage |
|------|-----|-------|
| Primary | #1e3a8a (Blue 900) | Sidebar, Header chính, Nút bấm Primary |
| Primary Light | #3b82f6 (Blue 500) | Hover, Active states, Chart lines |
| Secondary | #0f172a (Slate 900) | Text chính (Headings) |
| Background | #f8fafc (Slate 50) | Nền toàn trang (giảm mỏi mắt) |
| Surface | #ffffff (White) | Nền của Cards, Bảng biểu (elevated) |
| Success | #10b981 (Emerald 500) | Chỉ số tăng trưởng tốt, Trạng thái Hoàn thành |
| Warning | #f59e0b (Amber 500) | Cảnh báo, Cần duyệt |
| Danger/Error | #ef4444 (Red 500) | Giảm sút, Quá hạn, Lỗi |
| Text Muted | #64748b (Slate 500) | Subtitles, Label phụ, Trục tọa độ |

## 📝 Typography
Cần sự rõ ràng, dễ đọc số liệu lướt qua nhanh. Khuyên dùng **Inter** hoặc **Roboto**.

| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| Tên Metric (KPi) | Inter | 36px/40px | 700 (Bold) | 1.2 |
| H1 (Tiêu đề trang)| Inter | 28px | 600 (Semibold)| 1.3 |
| H2 (Tiêu đề Card) | Inter | 18px | 600 (Semibold)| 1.4 |
| Body | Inter | 14px | 400 (Regular) | 1.5 |
| Số nhỏ/Ngày tháng | Inter | 12px | 500 (Medium) | 1.5 |

## 📐 Layout & Structure
- **Sidebar (Trái):** Màu Navy (#1e3a8a). Chứa Logo, User Profile (thu gọn), Mũi tên Collapse, Danh sách menu phân cấp rõ ràng.
- **Top Header:** Màu Trắng. Chứa Global Search, Date Range Picker (rất quan trọng với Giám đốc), Notification Bell, Export PDF/Excel button.
- **Content Area:** 
  - Margin/Padding: Rộng rãi (padding: 24px - 32px).
  - Grid: Thường dùng lưới 12 cột. (4 cards x 3 cột cho KPI, 2 charts lớn x 6 cột).

## 🔲 Border & Shadows (Crisp & Clean)
Không dùng bo góc quá tròn (giữ sự nghiêm túc). Tránh shadow quá lố.

| Name | Value | Usage |
|------|-------|-------|
| Border Radius | 6px | Cực kỳ gọn gàng, sắc nét. Áp dụng cho Cards, Buttons. |
| Shadow Card | 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06) | Shadow RẤT nhẹ, chỉ đủ tách Card khỏi nền F8FAFC. |
| Border Color | #e2e8f0 (Slate 200) | Dùng chia dòng trong bảng biểu, viền icon. |

## 📊 Visual Components (Đặc thù Dashboard)
1. **KPI Cards (Top row):** 
   - Tổng Doanh Thu (VND) - Số siêu to.
   - Tổng Công nợ (AR)
   - Lợi nhuận gộp (Commission Total)
   - Số lượng Đơn hàng (Orders)
   *Mỗi card phải có mũi tên % tăng/giảm so với tháng trước (màu Xanh/Đỏ).*

2. **Charts:**
   - **Line/Spline Chart:** Biểu đồ xu hướng Doanh thu & Công nợ theo các tháng. (Nét mượt, không góc cạnh).
   - **Bar Chart:** Top khách hàng mang lại doanh thu cao nhất.
   - **Doughnut Chart:** Tỉ trọng các loại dịch vụ (VCT, MHH, UTXNK).

3. **Data Grid (Table):**
   - Bảng "Recent High-Value Orders" (Các đơn hàng giá trị cao mới nhất) hoặc "Overdue Invoices" (Công nợ quá hạn). Header bảng nền xám nhạt (#f1f5f9), chữ đậm.

## 📱 Responsiveness
- **Desktop (1200px+):** Sidebar mở rộng, KPI 4 cột, Biểu đồ 2 cột.
- **Tablet (768px - 1199px):** Sidebar thu gọn (chỉ hiện icon), KPI 2 cột, Biểu đồ 1 cột (full width).
- **Mobile (<768px):** Hamburger menu, Header trôi, KPI 1 cột vuốt dọc, Ẩn bớt cột table rườm rà.
