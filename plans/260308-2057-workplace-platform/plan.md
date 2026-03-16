# Plan: TBS ERP → Workplace Platform

Created: 2026-03-08T20:57:00+07:00
Status: 🟡 In Progress
Source: [BRIEF.md](file:///d:/ERPv1/docs/BRIEF.md)

## Overview

Biến TBS ERP thành nền tảng làm việc toàn diện thay thế LarkSuite. Tận dụng hạ tầng hiện có (NestJS + WebSocket + Redis + PostgreSQL + Next.js) để xây dựng các tính năng Workplace: Chat, Calendar, Drive, Bảng tin, Mobile PWA.

## Tech Stack (Kế thừa)

- **Frontend:** Next.js 14 (App Router) + React 18 + TailwindCSS + shadcn/ui
- **Backend:** NestJS 10 + Prisma 6 + PostgreSQL 16
- **Real-time:** Socket.IO (đã có gateway /ws)
- **Cache:** Redis (đã có ioredis)
- **Queue:** BullMQ (đã có)
- **File Storage:** MinIO (mới — S3-compatible, self-hosted)
- **Mobile:** PWA (next-pwa)

## Existing Foundation

| Module | Status | Reusable |
|--------|--------|----------|
| Chat WebSocket Gateway | ✅ có | Join rooms, typing, mark-read, emit helpers |
| Chat Service | ✅ có | DM, group, send/edit/delete, participants, search, unread count |
| Notification Module | ✅ có | Rules engine, escalation, WebSocket push |
| Approval Module | ✅ có | Multi-step, delegation, flow builder — đã tốt hơn Lark |
| Task Module | ✅ có | CRUD, comments, tracking |
| Attendance Module | ✅ có | Check-in, leave, overtime |
| Auth + RBAC | ✅ có | JWT, 15+ roles, guards |

## Phases

| Phase | Name | Status | Scope | Est. Time |
|-------|------|--------|-------|-----------|
| 01 | File Storage (MinIO) | ⬜ Pending | Backend infra | 2-3 ngày |
| 02 | Chat Nâng cao | ⬜ Pending | Backend + Frontend | 5-7 ngày |
| 03 | Calendar | ⬜ Pending | Backend + Frontend | 3-4 ngày |
| 04 | Drive / Tài liệu | ⬜ Pending | Backend + Frontend | 3-4 ngày |
| 05 | Bảng tin Công ty | ⬜ Pending | Backend + Frontend | 2-3 ngày |
| 06 | Mobile PWA | ⬜ Pending | Frontend infra | 3-4 ngày |
| 07 | Task Kanban + Gantt | ⬜ Pending | Frontend | 3-4 ngày |
| 08 | GPS Chấm công | ⬜ Pending | Backend + Frontend | 2-3 ngày |
| 09 | Báo cáo Export | ⬜ Pending | Backend + Frontend | 2-3 ngày |
| 10 | Video Call (Jitsi) | ⬜ Pending | Integration | 2-3 ngày |
| 11 | OKR | ⬜ Pending | Backend + Frontend | 3-4 ngày |
| 12 | Wiki / Knowledge Base | ⬜ Pending | Backend + Frontend | 3-4 ngày |

**Tổng ước tính:** ~35-45 ngày (Phase 01-06 MVP: ~18-25 ngày)

## Quick Commands

- Thiết kế chi tiết: `/design`
- Bắt đầu code: `/code phase-01`
- Xem tiến độ: `/next`
- Lưu context: `/save-brain`
