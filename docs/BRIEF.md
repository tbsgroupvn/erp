# 💡 BRIEF: TBS ERP → Workplace Platform

**Ngày tạo:** 2026-03-08
**Brainstorm cùng:** CEO/CTO TBS Group
**Tầm nhìn:** Biến TBS ERP thành nền tảng làm việc toàn diện, thay thế hoàn toàn LarkSuite

---

## 1. VẤN ĐỀ CẦN GIẢI QUYẾT

Hiện tại TBS Group đang dùng **2 hệ thống song song**:
- **TBS ERP** → Quản lý logistics, tài chính, đơn hàng
- **LarkSuite** → Chat, phê duyệt, lịch, tài liệu, chấm công

**Vấn đề:**
- Nhân viên phải nhảy giữa 2 hệ thống → giảm năng suất
- Dữ liệu phân tán → khó tổng hợp, khó quản lý
- Chi phí license LarkSuite cao → lãng phí khi ERP đã mạnh
- Phụ thuộc vào nền tảng bên thứ 3 → rủi ro khi họ thay đổi chính sách

## 2. GIẢI PHÁP ĐỀ XUẤT

Nâng cấp TBS ERP thành **"TBS Workplace"** — một nền tảng duy nhất cho:
- 📦 Quản lý nghiệp vụ logistics (đã có ~85%)
- 💬 Giao tiếp & cộng tác nội bộ (cần xây mới/nâng cấp)
- 📱 Hỗ trợ mobile (PWA) cho nhân viên di động

## 3. ĐỐI TƯỢNG SỬ DỤNG

- **Primary:** Toàn bộ nhân viên TBS Group (Sales, Kho, Kế toán, HR, Vận hành)
- **Secondary:** Ban Giám đốc (dashboard, báo cáo, phê duyệt)
- **External:** Khách hàng (Customer Portal — tra cứu, thanh toán)

## 4. NGHIÊN CỨU: SO SÁNH VỚI LARKSUITE

### Tính năng LarkSuite vs TBS ERP hiện tại:

| Tính năng | LarkSuite | TBS ERP hiện tại | Cần làm |
|-----------|-----------|-------------------|---------|
| **Messenger** | ⭐⭐⭐⭐⭐ | ⭐⭐ (chat cơ bản, WebSocket có sẵn) | Nâng cấp lớn |
| **Phê duyệt** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (multi-step, delegation, flow builder) | Đã tốt hơn Lark |
| **Lịch** | ⭐⭐⭐⭐ | ⭐ (backend module, chưa có UI) | Xây mới UI |
| **Tài liệu/Drive** | ⭐⭐⭐⭐ | ⭐⭐ (document module, chưa có file storage) | Nâng cấp lớn |
| **Task/Công việc** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ (CRUD, comments, tracking) | Thêm Kanban/Gantt |
| **Chấm công** | ⭐⭐⭐ | ⭐⭐⭐⭐ (check-in, leave, overtime) | Thêm GPS/WiFi |
| **Nghỉ phép** | ⭐⭐⭐ | ⭐⭐⭐⭐ (requests, approval flow) | OK, nhỏ |
| **Lương/HR** | ⭐⭐⭐ | ⭐⭐⭐⭐ (payroll, onboarding, training) | OK, nhỏ |
| **Video Call** | ⭐⭐⭐⭐⭐ | ❌ | Tích hợp Jitsi/WebRTC |
| **Email** | ⭐⭐⭐ | ❌ | Không ưu tiên (dùng email riêng) |
| **OKR/Mục tiêu** | ⭐⭐⭐⭐ | ❌ | Xây mới |
| **Wiki/Knowledge Base** | ⭐⭐⭐⭐ | ❌ | Xây mới |
| **Bảng tin công ty** | ⭐⭐⭐ | ❌ | Xây mới |
| **Mobile App** | ⭐⭐⭐⭐⭐ | ❌ | PWA hoặc React Native |

### Điểm khác biệt của TBS ERP so với LarkSuite:

- ✅ **Chuyên sâu logistics** — LarkSuite không có quản lý đơn hàng, container, thông quan, kho TQ/VN
- ✅ **Tài chính tích hợp** — Công nợ, sổ cái, hoa hồng, đối soát ngân hàng
- ✅ **Phê duyệt mạnh hơn** — Multi-step, delegation, flow builder visual
- ✅ **Dữ liệu tập trung** — Mọi thứ trong 1 hệ thống, không cần sync

---

## 5. TÍNH NĂNG

### 🚀 MVP — Phase 1: Workplace Core (Ưu tiên cao nhất)

Mục tiêu: Nhân viên có thể bỏ LarkSuite, dùng TBS ERP cho mọi thứ hàng ngày.

#### 💬 A. Chat / Messenger (Nâng cấp lớn)
- [ ] Chat 1-1 và nhóm (group chat) thời gian thực
- [ ] Tạo kênh (channels) theo phòng ban, dự án
- [ ] Gửi file, hình ảnh, video trong chat
- [ ] Mention (@user, @all), reply thread
- [ ] Tìm kiếm tin nhắn, bookmark
- [ ] Emoji reactions
- [ ] Trạng thái online/offline
- [ ] Thông báo đẩy (push notification)
- [ ] Chat pinned messages
- [ ] Typing indicator

#### 📅 B. Lịch / Calendar (Xây mới UI)
- [ ] Lịch cá nhân + lịch team
- [ ] Tạo sự kiện, mời thành viên
- [ ] Xem lịch rảnh/bận của đồng nghiệp
- [ ] Đặt phòng họp
- [ ] Nhắc nhở tự động trước cuộc họp
- [ ] Đồng bộ với Google Calendar (tùy chọn)
- [ ] View: Ngày, Tuần, Tháng

#### 📁 C. Tài liệu & Drive (Nâng cấp lớn)
- [ ] File storage thực (MinIO/S3) — thay thế URL-only hiện tại
- [ ] Upload/download file với quản lý thư mục
- [ ] Xem trước file (PDF, ảnh, video, Office)
- [ ] Chia sẻ file với quyền (view, edit, download)
- [ ] Quota lưu trữ theo phòng ban
- [ ] Tìm kiếm file toàn hệ thống
- [ ] Lịch sử phiên bản file

#### 📢 D. Bảng tin công ty (Mới)
- [ ] Thông báo toàn công ty (announcement)
- [ ] Bài viết nội bộ (news feed)
- [ ] React (like, clap) + comment
- [ ] Pin bài quan trọng
- [ ] Phân loại: Tin tức, Quy trình, Sự kiện, Khen thưởng

#### 📱 E. Mobile PWA (Mới)
- [ ] Progressive Web App — cài trên điện thoại không cần store
- [ ] Responsive layout cho tất cả tính năng chính
- [ ] Push notification trên mobile
- [ ] Offline mode cho xem dữ liệu đã cache
- [ ] Touch-friendly UI cho chấm công, phê duyệt, chat

---

### 🎁 Phase 2: Nâng cao Trải nghiệm

#### 🎥 F. Video Call (Tích hợp)
- [ ] Gọi video 1-1 từ chat
- [ ] Họp nhóm video (tích hợp Jitsi Meet self-hosted)
- [ ] Chia sẻ màn hình
- [ ] Ghi âm cuộc họp (tùy chọn)

#### 📊 G. Task Management Nâng cao
- [ ] Bảng Kanban (kéo thả)
- [ ] Gantt chart cho dự án
- [ ] Subtasks và dependencies
- [ ] Thống kê workload theo nhân viên
- [ ] Template công việc cho quy trình lặp lại

#### 🏆 H. OKR / Mục tiêu
- [ ] Thiết lập OKR theo quý (công ty → phòng ban → cá nhân)
- [ ] Track tiến độ key results
- [ ] Dashboard OKR cho quản lý
- [ ] Liên kết task → key result

#### 📖 I. Wiki / Knowledge Base
- [ ] Tạo wiki chung theo phòng ban / chủ đề
- [ ] Editor rich-text (WYSIWYG)
- [ ] Cây thư mục bài viết
- [ ] Tìm kiếm full-text
- [ ] Quyền truy cập theo nhóm

#### ⏰ J. Chấm công Thông minh
- [ ] GPS check-in/check-out (cho nhân viên đi thực địa)
- [ ] WiFi check-in (tự động khi ở văn phòng)
- [ ] Face recognition (tùy chọn)
- [ ] Bản đồ vị trí check-in
- [ ] Thống kê giờ làm tự động

#### 📊 K. Báo cáo & Export
- [ ] Xuất PDF/Excel cho tất cả báo cáo
- [ ] Báo cáo tự động gửi định kỳ (email/chat)
- [ ] Dashboard tùy chỉnh kéo thả (widget-based)

---

### 💭 Backlog — Phase 3: AI & Automation

- [ ] AI Chatbot nội bộ — hỏi đáp quy trình, tra cứu dữ liệu
- [ ] Tự động gợi ý task từ nội dung chat
- [ ] Tóm tắt cuộc họp bằng AI
- [ ] Smart search toàn hệ thống (tìm đơn hàng, khách hàng, file, tin nhắn)
- [ ] Workflow automation builder (no-code) — tương tự Lark Base
- [ ] Tích hợp email (gửi/nhận trong ERP)
- [ ] Custom emoji/sticker công ty

---

## 6. ƯỚC TÍNH SƠ BỘ

| Phase | Tính năng | Độ phức tạp | Thời gian ước tính |
|-------|-----------|-------------|---------------------|
| **MVP** | Chat, Calendar, Drive, Bảng tin, PWA | 🔴 Phức tạp | 6-8 tuần |
| **Phase 2** | Video, Kanban, OKR, Wiki, GPS Chấm công | 🟡 Trung bình | 4-6 tuần |
| **Phase 3** | AI, Automation, Smart Search | 🔴 Phức tạp | 4-6 tuần |

**Rủi ro:**
- Performance: Chat real-time + nhiều người dùng → cần tối ưu WebSocket + Redis
- File storage: MinIO cần server riêng hoặc cloud storage
- PWA limitations: Không mạnh bằng native app, push notification hạn chế trên iOS

## 7. BƯỚC TIẾP THEO

→ Chạy `/plan` để thiết kế chi tiết từng module
→ Ưu tiên: Chat → Calendar → Drive → Bảng tin → PWA
