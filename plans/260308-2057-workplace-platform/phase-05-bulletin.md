# Phase 05: Bảng tin Công ty

Status: ⬜ Pending
Dependencies: Phase 01 (File Storage — cho đính kèm)
Est. Time: 2-3 ngày

## Objective

Tạo hệ thống bảng tin nội bộ (News Feed) — nơi công ty đăng thông báo, tin tức, sự kiện, khen thưởng. Nhân viên tương tác qua reactions và comments.

## Requirements

### Functional — Backend
- [ ] CRUD bài viết (Post) với rich-text content
- [ ] Phân loại: Thông báo, Tin tức, Sự kiện, Khen thưởng, Quy trình
- [ ] Pin bài quan trọng (hiển thị đầu)
- [ ] Đính kèm file/ảnh (dùng StorageService)
- [ ] Reactions (like, clap, heart, fire)
- [ ] Comments (nested 1 level)
- [ ] Phạm vi: Toàn công ty / Phòng ban cụ thể
- [ ] Quyền đăng bài: Admin, HR, Manager (configurable)
- [ ] Notification khi có bài mới (dùng NotificationModule)

### Functional — Frontend
- [ ] News feed page — scroll infinite
- [ ] Post card: title, content preview, image, author, reactions, comments count
- [ ] Post detail page: full content, reactions bar, comments section
- [ ] Compose post: rich-text editor, category select, attach files, set audience
- [ ] Reaction animation (click reaction → counter tăng)
- [ ] Comment section: type, submit, nested reply
- [ ] Filter by category (tabs hoặc sidebar)
- [ ] Pinned posts section (top)

## Implementation Steps

### Backend (1 ngày)
1. [ ] Tạo Prisma models: BulletinPost, PostReaction, PostComment
2. [ ] Tạo `src/modules/bulletin/bulletin.module.ts`
3. [ ] Tạo `src/modules/bulletin/bulletin.service.ts`
4. [ ] Tạo `src/modules/bulletin/bulletin.controller.ts`
5. [ ] DTOs: CreatePostDto, ReactDto, CommentDto
6. [ ] Integrate NotificationModule khi post mới

### Frontend (1.5-2 ngày)
7. [ ] Tạo `src/app/(dashboard)/bang-tin/page.tsx`
8. [ ] Component: `PostFeed` — infinite scroll list
9. [ ] Component: `PostCard` — preview card
10. [ ] Component: `PostDetail` — full post
11. [ ] Component: `ComposePost` — tạo bài mới
12. [ ] Component: `ReactionBar` — reaction buttons + counts
13. [ ] Component: `CommentSection` — comments
14. [ ] React hooks: `useBulletin`, `usePosts`
15. [ ] API client: `src/lib/api/bulletin.ts`

## Test Criteria
- [ ] Admin tạo bài → hiển thị cho toàn bộ nhân viên
- [ ] Pin bài → bài nằm đầu feed
- [ ] React bài → counter tăng, animation hoạt động
- [ ] Comment → comment hiện real-time
- [ ] Filter "Khen thưởng" → chỉ hiện bài category đó
- [ ] Đính kèm ảnh → hiển thị inline trong bài

---
Next Phase: [Phase 06 - Mobile PWA](./phase-06-pwa.md)
