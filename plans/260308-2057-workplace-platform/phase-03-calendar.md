# Phase 03: Calendar / Lịch

Status: ⬜ Pending
Dependencies: Không (độc lập)
Est. Time: 3-4 ngày

## Objective

Xây dựng hệ thống lịch cho nhân viên: lịch cá nhân, lịch team, tạo sự kiện, mời người tham gia, nhắc nhở, view ngày/tuần/tháng.

## Existing Foundation

- Backend: `calendar.module.ts` (chỉ có file module trống)
- Frontend: Chưa có UI calendar
- Notification module: Có sẵn → dùng cho nhắc nhở sự kiện

## Requirements

### Functional — Backend
- [ ] CRUD Calendar Events (tạo, sửa, xóa sự kiện)
- [ ] Event types: Meeting, Task deadline, Reminder, Company event
- [ ] Invite participants (nhiều người)
- [ ] RSVP: Accept / Decline / Maybe
- [ ] Recurring events (daily, weekly, monthly)
- [ ] Xem lịch rảnh/bận của user khác (free/busy)
- [ ] Nhắc nhở trước sự kiện (5min, 15min, 30min, 1h)
- [ ] Liên kết event với: Phê duyệt, Task, Đơn hàng (tùy chọn)

### Functional — Frontend
- [ ] Calendar view: Ngày, Tuần, Tháng (dùng FullCalendar hoặc @schedule-x)
- [ ] Quick-add event (click vào slot thời gian)
- [ ] Event detail modal / panel
- [ ] Team calendar overlay (xem lịch nhiều người chồng lên)
- [ ] Sidebar: danh sách sự kiện sắp tới (upcoming)
- [ ] Color coding theo loại sự kiện
- [ ] Drag & drop để đổi thời gian sự kiện

### Non-Functional
- [ ] Load tháng calendar < 500ms
- [ ] Real-time update khi có event mới (WebSocket)

## Implementation Steps

### Backend (1.5-2 ngày)
1. [ ] Tạo Prisma models: CalendarEvent, EventParticipant, EventReminder
2. [ ] Tạo `src/modules/calendar/calendar.service.ts` — full CRUD
3. [ ] Tạo `src/modules/calendar/calendar.controller.ts` — REST endpoints
4. [ ] Tạo DTOs: CreateEventDto, UpdateEventDto, EventQueryDto
5. [ ] Recurring event logic (RRule format)
6. [ ] Free/busy query endpoint
7. [ ] Cron job cho reminders (BullMQ)
8. [ ] WebSocket events cho calendar updates

### Frontend (1.5-2 ngày)
9. [ ] Install calendar library (FullCalendar or @schedule-x/react)
10. [ ] Tạo `src/app/(dashboard)/lich/page.tsx` — calendar page
11. [ ] Component: `CalendarView` (day/week/month)
12. [ ] Component: `EventFormModal` — tạo/sửa sự kiện
13. [ ] Component: `EventDetailPanel` — xem chi tiết
14. [ ] Component: `UpcomingSidebar` — danh sách sắp tới
15. [ ] React hooks: `useCalendar`, `useEvents`
16. [ ] API client: `src/lib/api/calendar.ts`

## Prisma Models

```prisma
model CalendarEvent {
  id            String   @id @default(cuid())
  title         String
  description   String?
  startTime     DateTime
  endTime       DateTime
  allDay        Boolean  @default(false)
  location      String?
  type          EventType @default(MEETING)
  color         String?
  recurrence    String?  // RRule string
  createdById   String
  createdBy     User     @relation(fields: [createdById])
  participants  EventParticipant[]
  reminders     EventReminder[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model EventParticipant {
  id        String   @id @default(cuid())
  eventId   String
  event     CalendarEvent @relation(fields: [eventId])
  userId    String
  user      User     @relation(fields: [userId])
  status    RSVPStatus @default(PENDING)
  @@unique([eventId, userId])
}

enum EventType { MEETING, TASK, REMINDER, COMPANY, PERSONAL }
enum RSVPStatus { PENDING, ACCEPTED, DECLINED, MAYBE }
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/calendar/events` | Tạo event |
| GET | `/api/v1/calendar/events` | List events (filter by date range) |
| GET | `/api/v1/calendar/events/:id` | Chi tiết event |
| PATCH | `/api/v1/calendar/events/:id` | Sửa event |
| DELETE | `/api/v1/calendar/events/:id` | Xóa event |
| POST | `/api/v1/calendar/events/:id/rsvp` | RSVP cho event |
| GET | `/api/v1/calendar/free-busy` | Xem lịch rảnh/bận |

## Test Criteria
- [ ] Tạo event → hiển thị trên calendar view
- [ ] Mời participant → họ nhận notification
- [ ] RSVP Accept/Decline → status cập nhật
- [ ] Recurring event → hiển thị đúng các ngày
- [ ] Drag event sang ngày khác → thời gian cập nhật
- [ ] Reminder 15min → notification đẩy đúng thời điểm

---
Next Phase: [Phase 04 - Drive](./phase-04-drive.md)
