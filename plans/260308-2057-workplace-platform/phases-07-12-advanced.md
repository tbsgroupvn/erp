# Phases 07-12: Phase 2 Features (Nâng cao)

Status: ⬜ Pending
Dependencies: MVP Phases 01-06
Est. Time: 16-21 ngày tổng

---

## Phase 07: Task Kanban + Gantt (3-4 ngày)

### Objective
Nâng cấp Task module hiện có thêm Kanban board (kéo thả) và Gantt chart.

### Key Features
- [ ] Kanban board: columns = status, drag-drop cards (dùng @dnd-kit)
- [ ] Gantt chart: timeline view cho dự án (dùng gantt-task-react hoặc tự build)
- [ ] Subtasks: task cha-con
- [ ] Dependencies: task A phải xong trước task B
- [ ] Workload view: xem ai đang overload
- [ ] Task templates: tạo template cho quy trình lặp lại

### Files
- `src/app/(dashboard)/cong-viec/_components/kanban-board.tsx` (NEW)
- `src/app/(dashboard)/cong-viec/_components/gantt-chart.tsx` (NEW)
- `src/modules/task/task.service.ts` (MODIFY — subtasks, dependencies)
- `prisma/schema/system.prisma` (MODIFY — Task subtask/dependency fields)

---

## Phase 08: GPS Chấm công (2-3 ngày)

### Objective
Thêm GPS và WiFi check-in cho module chấm công hiện có.

### Key Features
- [ ] GPS check-in: lấy vị trí, validate trong bán kính cho phép
- [ ] WiFi check-in: detect WiFi SSID văn phòng (PWA limitation — cần giải pháp thay thế)
- [ ] Bản đồ check-in: hiển thị vị trí trên map
- [ ] Geofencing: cảnh báo khi check-in ngoài khu vực
- [ ] Photo selfie khi check-in (tùy chọn)
- [ ] Big check-in button trên mobile (1 tap)

### Files
- `src/modules/attendance/gps-checkin.service.ts` (NEW)
- `src/app/(dashboard)/cham-cong/_components/gps-checkin.tsx` (NEW)
- `src/app/(dashboard)/cham-cong/_components/checkin-map.tsx` (NEW)

---

## Phase 09: Báo cáo Export PDF/Excel (2-3 ngày)

### Objective
Thêm xuất PDF và Excel cho tất cả báo cáo, và báo cáo tự động gửi định kỳ.

### Key Features
- [ ] Export Excel: dùng ExcelJS
- [ ] Export PDF: dùng Puppeteer hoặc PDFKit
- [ ] Scheduled reports: BullMQ cron → generate → gửi qua notification/email
- [ ] Custom dashboard widgets (stretch goal)

### Files
- `src/core/export/export.module.ts` (NEW)
- `src/core/export/excel-export.service.ts` (NEW)
- `src/core/export/pdf-export.service.ts` (NEW)
- `src/modules/dashboard/scheduled-reports.service.ts` (NEW)

---

## Phase 10: Video Call — Jitsi Meet (2-3 ngày)

### Objective
Tích hợp Jitsi Meet (self-hosted) cho video call từ trong ERP.

### Key Features
- [ ] Docker Jitsi Meet cùng docker-compose
- [ ] "Call" button trong chat → mở Jitsi room
- [ ] Meeting link shareable
- [ ] Calendar event → auto-create Jitsi link
- [ ] Embedded Jitsi iframe trong ERP (Jitsi IFrame API)

### Files
- `docker-compose.dev.yml` (MODIFY — thêm Jitsi)
- `src/modules/meeting/meeting.module.ts` (NEW)
- `src/app/(dashboard)/tro-chuyen/_components/video-call.tsx` (NEW)

---

## Phase 11: OKR / Mục tiêu (3-4 ngày)

### Objective
Hệ thống OKR: thiết lập mục tiêu theo quý, track key results, liên kết với task.

### Key Features
- [ ] OKR hierarchy: Company → Department → Personal
- [ ] Objective: title, description, period (Q1, Q2...)
- [ ] Key Results: measurable, current/target value, progress %
- [ ] Check-in: cập nhật tiến độ định kỳ
- [ ] Dashboard OKR cho manager
- [ ] Link task → key result

### Files
- `prisma/schema/hr.prisma` (MODIFY — OKR models)
- `src/modules/okr/` (NEW — module, service, controller, DTOs)
- `src/app/(dashboard)/muc-tieu/` (NEW — OKR pages)

---

## Phase 12: Wiki / Knowledge Base (3-4 ngày)

### Objective
Hệ thống wiki nội bộ: bài viết phân cấp, rich-text editor, tìm kiếm full-text.

### Key Features
- [ ] Wiki spaces theo phòng ban hoặc chủ đề
- [ ] Page hierarchy (tree structure)
- [ ] Rich-text editor (TipTap hoặc Plate)
- [ ] Full-text search (PostgreSQL tsvector)
- [ ] Version history cho mỗi page
- [ ] Quyền truy cập theo nhóm
- [ ] Template pages

### Files
- `prisma/schema/system.prisma` (MODIFY — Wiki models)
- `src/modules/wiki/` (NEW — module, service, controller, DTOs)
- `src/app/(dashboard)/wiki/` (NEW — wiki pages)

---

## Tổng ước tính Phase 2

| Phase | Feature | Ngày |
|-------|---------|------|
| 07 | Task Kanban + Gantt | 3-4 |
| 08 | GPS Chấm công | 2-3 |
| 09 | Báo cáo Export | 2-3 |
| 10 | Video Call (Jitsi) | 2-3 |
| 11 | OKR | 3-4 |
| 12 | Wiki | 3-4 |
| **Total** | | **16-21 ngày** |
