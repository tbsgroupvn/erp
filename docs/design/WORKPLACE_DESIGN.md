# 🎨 DESIGN: TBS Workplace Platform

Ngày tạo: 2026-03-08
Dựa trên: [BRIEF.md](file:///d:/ERPv1/docs/BRIEF.md) + [Plan](file:///d:/ERPv1/plans/260308-2057-workplace-platform/plan.md)

---

## 1. DATABASE — Prisma Schemas Mới

### 1.1. File Storage (`prisma/schema/storage.prisma`)

```prisma
model StoredFile {
  id          String   @id @default(cuid())
  filename    String                          // Tên gốc file
  mimeType    String   @map("mime_type")      // image/png, application/pdf...
  size        Int                             // Bytes
  bucket      String   @default("default")    // MinIO bucket
  key         String   @unique               // MinIO object key
  thumbnailKey String? @map("thumbnail_key")  // Thumbnail cho ảnh
  uploadedBy  String   @map("uploaded_by")
  isPublic    Boolean  @default(false) @map("is_public")
  metadata    Json?                           // Extra metadata
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([uploadedBy])
  @@index([bucket])
  @@map("stored_files")
}
```

### 1.2. Chat Mở rộng (`prisma/schema/chat.prisma` — MODIFY)

```prisma
// THÊM vào ConversationType enum
enum ConversationType {
  DIRECT
  GROUP
  CHANNEL    // MỚI — kênh công khai/riêng tư
}

// THÊM vào ChatConversation
model ChatConversation {
  // ... giữ nguyên fields cũ ...
  description String?                         // MỚI — mô tả channel
  isPublic    Boolean  @default(false) @map("is_public") // MỚI — channel public/private
  avatarUrl   String?  @map("avatar_url")     // MỚI — avatar nhóm/channel
  pinnedMessages ChatPinnedMessage[]           // MỚI
}

// THÊM vào ChatMessage
model ChatMessage {
  // ... giữ nguyên fields cũ ...
  attachments  ChatAttachment[]               // MỚI — file đính kèm
  reactions    ChatReaction[]                  // MỚI — emoji reactions
  mentions     String[]                        // MỚI — danh sách userId được mention
  isPinned     Boolean @default(false) @map("is_pinned") // MỚI
  forwardedFromId String? @map("forwarded_from_id")  // MỚI — forward
}

// === MODELS MỚI ===

model ChatAttachment {
  id        String   @id @default(cuid())
  messageId String   @map("message_id")
  message   ChatMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  fileId    String   @map("file_id")          // FK → StoredFile
  fileName  String   @map("file_name")
  fileSize  Int      @map("file_size")
  mimeType  String   @map("mime_type")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([messageId])
  @@map("chat_attachments")
}

model ChatReaction {
  id        String   @id @default(cuid())
  messageId String   @map("message_id")
  message   ChatMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  userId    String   @map("user_id")
  emoji     String                            // 👍, ❤️, 😂...
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([messageId, userId, emoji])
  @@index([messageId])
  @@map("chat_reactions")
}

model ChatPinnedMessage {
  id             String   @id @default(cuid())
  conversationId String   @map("conversation_id")
  conversation   ChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  messageId      String   @map("message_id")
  pinnedBy       String   @map("pinned_by")
  pinnedAt       DateTime @default(now()) @map("pinned_at")

  @@unique([conversationId, messageId])
  @@map("chat_pinned_messages")
}

model ChatBookmark {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  messageId String   @map("message_id")
  note      String?
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([userId, messageId])
  @@index([userId])
  @@map("chat_bookmarks")
}
```

### 1.3. Calendar (`prisma/schema/calendar.prisma` — NEW)

```prisma
enum EventType {
  MEETING
  TASK_DEADLINE
  REMINDER
  COMPANY_EVENT
  PERSONAL
}

enum RSVPStatus {
  PENDING
  ACCEPTED
  DECLINED
  MAYBE
}

model CalendarEvent {
  id           String   @id @default(cuid())
  title        String
  description  String?  @db.Text
  startTime    DateTime @map("start_time")
  endTime      DateTime @map("end_time")
  allDay       Boolean  @default(false) @map("all_day")
  location     String?
  meetingUrl   String?  @map("meeting_url")   // Jitsi link
  type         EventType @default(MEETING)
  color        String?                        // Hex color
  recurrence   String?                        // RRule (RFC 5545)
  reminderMins Int[]    @map("reminder_mins") // [5, 15, 30]
  createdById  String   @map("created_by_id")
  isPrivate    Boolean  @default(false) @map("is_private")

  participants EventParticipant[]
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@index([createdById])
  @@index([startTime, endTime])
  @@index([type])
  @@map("calendar_events")
}

model EventParticipant {
  id       String     @id @default(cuid())
  eventId  String     @map("event_id")
  event    CalendarEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  userId   String     @map("user_id")
  status   RSVPStatus @default(PENDING)
  respondedAt DateTime? @map("responded_at")

  @@unique([eventId, userId])
  @@index([userId, status])
  @@map("event_participants")
}
```

### 1.4. Drive (`prisma/schema/drive.prisma` — NEW)

```prisma
model DriveFolder {
  id          String   @id @default(cuid())
  name        String
  parentId    String?  @map("parent_id")
  parent      DriveFolder? @relation("FolderHierarchy", fields: [parentId], references: [id])
  children    DriveFolder[] @relation("FolderHierarchy")
  ownerId     String   @map("owner_id")
  color       String?
  isStarred   Boolean  @default(false) @map("is_starred")
  isDeleted   Boolean  @default(false) @map("is_deleted")
  deletedAt   DateTime? @map("deleted_at")
  files       DriveFile[]
  shares      DriveShare[] @relation("FolderShares")

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([parentId])
  @@index([ownerId])
  @@map("drive_folders")
}

model DriveFile {
  id          String   @id @default(cuid())
  name        String
  folderId    String?  @map("folder_id")
  folder      DriveFolder? @relation(fields: [folderId], references: [id])
  fileId      String   @map("file_id")        // FK → StoredFile
  version     Int      @default(1)
  ownerId     String   @map("owner_id")
  isStarred   Boolean  @default(false) @map("is_starred")
  isDeleted   Boolean  @default(false) @map("is_deleted")
  deletedAt   DateTime? @map("deleted_at")
  shares      DriveShare[] @relation("FileShares")
  versions    DriveFileVersion[]

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([folderId])
  @@index([ownerId])
  @@index([isDeleted])
  @@map("drive_files")
}

model DriveFileVersion {
  id          String   @id @default(cuid())
  driveFileId String   @map("drive_file_id")
  driveFile   DriveFile @relation(fields: [driveFileId], references: [id], onDelete: Cascade)
  fileId      String   @map("file_id")        // FK → StoredFile
  version     Int
  uploadedBy  String   @map("uploaded_by")
  changeNote  String?  @map("change_note")
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([driveFileId])
  @@map("drive_file_versions")
}

enum SharePermission { VIEW DOWNLOAD EDIT }

model DriveShare {
  id         String   @id @default(cuid())
  fileId     String?  @map("file_id")
  file       DriveFile? @relation("FileShares", fields: [fileId], references: [id], onDelete: Cascade)
  folderId   String?  @map("folder_id")
  folder     DriveFolder? @relation("FolderShares", fields: [folderId], references: [id], onDelete: Cascade)
  sharedWith String   @map("shared_with")     // userId
  permission SharePermission @default(VIEW)
  sharedBy   String   @map("shared_by")
  createdAt  DateTime @default(now()) @map("created_at")

  @@unique([fileId, sharedWith])
  @@unique([folderId, sharedWith])
  @@index([sharedWith])
  @@map("drive_shares")
}
```

### 1.5. Bảng tin (`prisma/schema/bulletin.prisma` — NEW)

```prisma
enum BulletinCategory {
  NEWS          // Tin tức
  ANNOUNCEMENT  // Thông báo
  EVENT         // Sự kiện
  RECOGNITION   // Khen thưởng
  POLICY        // Quy trình
}

model BulletinPost {
  id          String   @id @default(cuid())
  title       String
  content     String   @db.Text
  category    BulletinCategory @default(NEWS)
  coverImage  String?  @map("cover_image")    // FK → StoredFile (tùy chọn)
  attachments Json?                           // Array of StoredFile IDs
  authorId    String   @map("author_id")
  isPinned    Boolean  @default(false) @map("is_pinned")
  audience    String   @default("ALL")        // ALL, DEPARTMENT:<id>
  publishedAt DateTime? @map("published_at")
  isPublished Boolean  @default(true) @map("is_published")

  reactions   BulletinReaction[]
  comments    BulletinComment[]
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([category])
  @@index([authorId])
  @@index([isPinned, publishedAt])
  @@map("bulletin_posts")
}

model BulletinReaction {
  id       String   @id @default(cuid())
  postId   String   @map("post_id")
  post     BulletinPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId   String   @map("user_id")
  emoji    String                             // 👍, 👏, ❤️, 🔥
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([postId, userId, emoji])
  @@map("bulletin_reactions")
}

model BulletinComment {
  id       String   @id @default(cuid())
  postId   String   @map("post_id")
  post     BulletinPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  parentId String?  @map("parent_id")        // nested 1 level
  userId   String   @map("user_id")
  content  String
  createdAt DateTime @default(now()) @map("created_at")

  @@index([postId])
  @@map("bulletin_comments")
}
```

### 1.6. Push Subscription (`prisma/schema/notification.prisma` — MODIFY)

```prisma
// THÊM model mới cho Web Push
model PushSubscription {
  id           String   @id @default(cuid())
  userId       String   @map("user_id")
  endpoint     String   @db.Text
  p256dh       String                        // Public key
  auth         String                        // Auth secret
  userAgent    String?  @map("user_agent")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@unique([userId, endpoint])
  @@index([userId, isActive])
  @@map("push_subscriptions")
}
```

---

## 2. API ENDPOINTS

### 2.1. Storage API (`/api/v1/storage`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/upload` | Upload file (multipart) | JWT |
| POST | `/upload/multiple` | Upload nhiều files | JWT |
| GET | `/:id` | File metadata | JWT |
| GET | `/:id/download` | Download file (stream) | JWT |
| GET | `/:id/thumbnail` | Lấy thumbnail (ảnh) | JWT |
| GET | `/:id/presigned` | Presigned URL (5min) | JWT |
| DELETE | `/:id` | Xóa file | JWT |

### 2.2. Chat API (`/api/v1/chat`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/channels` | Tạo channel mới |
| GET | `/channels` | List public channels |
| POST | `/channels/:id/join` | Join channel |
| POST | `/channels/:id/leave` | Leave channel |
| GET | `/conversations` | List conversations (đã có) |
| POST | `/conversations/dm` | Tạo/get DM (đã có) |
| POST | `/conversations/group` | Tạo group (đã có) |
| GET | `/conversations/:id/messages` | Get messages (đã có) |
| POST | `/conversations/:id/messages` | Send message (đã có) |
| POST | `/conversations/:id/messages/with-files` | Send message + files |
| PATCH | `/messages/:id` | Edit message (đã có) |
| DELETE | `/messages/:id` | Delete message (đã có) |
| POST | `/messages/:id/reactions` | Add reaction |
| DELETE | `/messages/:id/reactions/:emoji` | Remove reaction |
| POST | `/conversations/:id/pin/:messageId` | Pin message |
| DELETE | `/conversations/:id/pin/:messageId` | Unpin message |
| GET | `/conversations/:id/pinned` | List pinned messages |
| POST | `/messages/:id/bookmark` | Bookmark message |
| GET | `/bookmarks` | My bookmarks |
| GET | `/search` | Search messages (full-text) |
| GET | `/presence` | Online users |

### 2.3. Calendar API (`/api/v1/calendar`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/events` | Tạo event |
| GET | `/events` | List events (query: start, end, type) |
| GET | `/events/:id` | Chi tiết event |
| PATCH | `/events/:id` | Sửa event |
| DELETE | `/events/:id` | Xóa event |
| POST | `/events/:id/rsvp` | RSVP (accept/decline/maybe) |
| GET | `/free-busy` | Xem lịch rảnh/bận (query: userIds, start, end) |
| GET | `/upcoming` | Sự kiện sắp tới (7 ngày) |

### 2.4. Drive API (`/api/v1/drive`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/folders` | List root folders |
| POST | `/folders` | Tạo folder |
| GET | `/folders/:id` | Folder contents (files + subfolders) |
| PATCH | `/folders/:id` | Rename / move folder |
| DELETE | `/folders/:id` | Delete folder (→ trash) |
| POST | `/files/upload` | Upload file vào folder |
| GET | `/files/:id` | File metadata |
| PATCH | `/files/:id` | Rename / move / star file |
| DELETE | `/files/:id` | Delete file (→ trash) |
| POST | `/files/:id/versions` | Upload phiên bản mới |
| GET | `/files/:id/versions` | List versions |
| POST | `/share` | Share file/folder |
| GET | `/shared-with-me` | Files shared with me |
| GET | `/starred` | Starred files/folders |
| GET | `/trash` | Trash items |
| POST | `/trash/:id/restore` | Restore from trash |
| DELETE | `/trash/:id/permanent` | Permanent delete |
| GET | `/search` | Search files |
| GET | `/usage` | Storage usage stats |

### 2.5. Bulletin API (`/api/v1/bulletin`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/posts` | Tạo bài |
| GET | `/posts` | List posts (feed, pagination) |
| GET | `/posts/:id` | Chi tiết bài |
| PATCH | `/posts/:id` | Sửa bài |
| DELETE | `/posts/:id` | Xóa bài |
| POST | `/posts/:id/pin` | Pin/unpin bài |
| POST | `/posts/:id/reactions` | React bài |
| DELETE | `/posts/:id/reactions/:emoji` | Remove reaction |
| POST | `/posts/:id/comments` | Comment |
| GET | `/posts/:id/comments` | List comments |

### 2.6. Push Notification API (`/api/v1/push`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/subscribe` | Register push subscription |
| DELETE | `/unsubscribe` | Remove subscription |
| POST | `/test` | Test push (dev only) |

---

## 3. WEBSOCKET EVENTS

### Chat Events (namespace `/ws`)

| Event | Direction | Payload | Mô tả |
|-------|-----------|---------|--------|
| `chat:message:new` | Server→Client | `{conversationId, message}` | Tin nhắn mới |
| `chat:message:edited` | Server→Client | `{conversationId, messageId, content}` | Đã sửa |
| `chat:message:deleted` | Server→Client | `{conversationId, messageId}` | Đã xóa |
| `chat:reaction:add` | Server→Client | `{conversationId, messageId, userId, emoji}` | Reaction mới |
| `chat:reaction:remove` | Server→Client | `{conversationId, messageId, userId, emoji}` | Bỏ reaction |
| `chat:typing` | Both | `{conversationId, userId, isTyping}` | Đang gõ |
| `chat:presence` | Server→Client | `{userId, status: 'online'|'offline'}` | Online status |
| `chat:pinned` | Server→Client | `{conversationId, messageId, action: 'pin'|'unpin'}` | Pin/unpin |

### Calendar Events

| Event | Payload | Mô tả |
|-------|---------|--------|
| `calendar:event:created` | `{event}` | Event mới |
| `calendar:event:updated` | `{event}` | Event thay đổi |
| `calendar:event:deleted` | `{eventId}` | Event xóa |
| `calendar:rsvp` | `{eventId, userId, status}` | RSVP cập nhật |

### Bulletin Events

| Event | Payload | Mô tả |
|-------|---------|--------|
| `bulletin:post:new` | `{post}` | Bài mới |
| `bulletin:reaction` | `{postId, userId, emoji, action}` | Reaction |
| `bulletin:comment:new` | `{postId, comment}` | Comment mới |

---

## 4. DATA FLOW DIAGRAMS

### 4.1. Chat: Gửi tin nhắn có file

```
User A (Browser)                    Server                         User B (Browser)
     │                                │                                │
     │──POST /chat/.../messages ──────▶│                                │
     │  + file upload                  │                                │
     │                                 │──upload file → MinIO           │
     │                                 │◀─ fileId                      │
     │                                 │──save ChatMessage + Attachment │
     │                                 │──emit chat:message:new ──────▶│
     │◀─── 201 {message} ─────────────│                                │
     │                                 │──push notification ──────────▶│
```

### 4.2. Calendar: Tạo sự kiện + nhắc nhở

```
User                    Server                    BullMQ/Redis        Participants
  │                       │                           │                    │
  │──POST /calendar ────▶│                           │                    │
  │                       │──save CalendarEvent       │                    │
  │                       │──create EventParticipants │                    │
  │                       │──schedule reminder job ──▶│                    │
  │                       │──emit calendar:event ─────┼──────────────────▶│
  │◀─201 {event}─────────│                           │                    │
  │                       │                           │                    │
  │   ... 15 min before meeting ...                   │                    │
  │                       │◀─── trigger job ──────────│                    │
  │                       │──push notification ───────┼──────────────────▶│
  │◀──push notification──│                           │                    │
```

### 4.3. Drive: Upload file + versioning

```
User                     Server                   MinIO
  │                        │                        │
  │──POST /drive/upload ──▶│                        │
  │  (file + folderId)     │──PUT object ──────────▶│
  │                        │◀─ key, etag            │
  │                        │──save StoredFile        │
  │                        │──save DriveFile          │
  │◀─ 201 {driveFile} ────│                        │
  │                        │                        │
  │── POST /:id/versions ─▶│                        │
  │  (new file version)    │──PUT new object ──────▶│
  │                        │──save StoredFile        │
  │                        │──save DriveFileVersion  │
  │                        │──update DriveFile.ver   │
  │◀─ 201 {version} ──────│                        │
```

---

## 5. ACCEPTANCE CRITERIA (Kiểm tra hoàn thành)

### Phase 01: File Storage
- [ ] Upload ảnh 5MB → nhận fileId + thumbnail URL
- [ ] Download bằng fileId → đúng file, đúng MIME type
- [ ] Upload > 100MB → lỗi 413 Payload Too Large
- [ ] Presigned URL → download trực tiếp từ browser, hết hạn sau 5 phút
- [ ] Delete file → file không còn trong MinIO

### Phase 02: Chat
- [ ] Tạo channel "Marketing" → hiển thị trong channel list
- [ ] User A gửi tin → User B thấy ngay (< 200ms)
- [ ] Gửi tin có ảnh → ảnh hiển thị inline
- [ ] @mention UserB → UserB nhận notification
- [ ] 👍 reaction → emoji counter +1 real-time
- [ ] Reply thread → thread panel mở đúng context
- [ ] Search "hóa đơn" → tìm đúng messages chứa keyword
- [ ] Pin message → hiện trong pinned list
- [ ] Offline → reconnect → load lại messages từ last read

### Phase 03: Calendar
- [ ] Tạo event "Họp Sales 9:00" → hiển thị trên calendar
- [ ] Mời 3 người → họ nhận notification + thấy event
- [ ] RSVP Accept → status cập nhật cho tất cả
- [ ] Drag event sang ngày khác → thời gian thay đổi
- [ ] Reminder 15 phút → push notification đúng giờ
- [ ] Free/busy → thấy đúng slots đã bận

### Phase 04: Drive
- [ ] Tạo folder "Hợp đồng 2026" → folder hiển thị
- [ ] Upload PDF → file trong folder, xem preview được
- [ ] Share file với UserB → UserB thấy trong "Shared with me"
- [ ] Upload version 2 → version history hiển thị 2 entries
- [ ] Delete → vào Trash, restore → quay về folder cũ
- [ ] Search "invoice" → tìm đúng files theo tên

### Phase 05: Bảng tin
- [ ] Admin đăng "Thông báo lịch nghỉ Tết" → toàn bộ NV thấy
- [ ] Pin bài → nằm đầu feed
- [ ] 👏 bài → animation + counter tăng
- [ ] Comment → hiện real-time cho người khác
- [ ] Filter "Khen thưởng" → chỉ hiện đúng category

### Phase 06: PWA
- [ ] Chrome mobile → hiện "Add to Home Screen"
- [ ] Cài PWA → icon trên home screen, mở full screen
- [ ] Push notification → tap → đi đúng page
- [ ] Bottom nav → 4 tab chuyển mượt
- [ ] Lighthouse PWA score ≥ 90

---

*Design bởi AWF /design workflow — 2026-03-08*
