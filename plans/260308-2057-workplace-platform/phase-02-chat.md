# Phase 02: Chat / Messenger Nâng cao

Status: ⬜ Pending
Dependencies: Phase 01 (File Storage)
Est. Time: 5-7 ngày

## Objective

Nâng cấp Chat module hiện tại thành hệ thống messaging đầy đủ ngang LarkSuite: channels, threads, reactions, file sharing, mentions, search, pins.

## Existing Foundation (Tận dụng)

Backend đã có:
- `ChatGateway` (WebSocket /ws) — join, typing, mark-read, emit helpers
- `ChatService` — DM, group, send/edit/delete, participants, search, unread count
- `ChatRepository` — Prisma queries cho Conversation + Message
- Prisma models: Conversation, ConversationParticipant, Message

## Requirements

### Functional — Backend
- [ ] **Channels**: Thêm type `CHANNEL` cho Conversation (public/private)
- [ ] **Threads/Reply**: Message có `parentId` → reply thread
- [ ] **Reactions**: Emoji reactions trên message (MessageReaction model)
- [ ] **File attachments**: Gắn file từ Storage vào message (MessageAttachment)
- [ ] **Mentions**: Parse @mentions trong message content, notify user
- [ ] **Pin messages**: Pin/unpin message trong conversation
- [ ] **Bookmark**: User bookmark message riêng (MessageBookmark model)
- [ ] **Search messages**: Full-text search qua messages (PostgreSQL tsvector)
- [ ] **Message forwarding**: Forward message sang conversation khác
- [ ] **Online presence**: Track online/offline qua Redis (user connect/disconnect)
- [ ] **Unread count per conversation**: Đã có, cải thiện performance

### Functional — Frontend
- [ ] **Chat panel** tích hợp vào sidebar (mở chat bất kỳ lúc nào)
- [ ] **Conversation list** với unread badges, last message preview
- [ ] **Message area**: Tin nhắn, avatar, timestamp, reactions, threads
- [ ] **Compose bar**: Text input, emoji picker, file upload, mention autocomplete
- [ ] **Channel browser**: Xem và join public channels
- [ ] **Thread panel**: Slide-out panel cho thread replies
- [ ] **User search**: Tìm người để chat DM
- [ ] **Online indicator**: Chấm xanh khi online
- [ ] **File preview in chat**: Preview ảnh, video, PDF inline
- [ ] **Notification sound**: Âm thanh khi có tin nhắn mới

### Non-Functional
- [ ] Messages load < 200ms cho 30 messages
- [ ] WebSocket reconnect tự động khi mất kết nối
- [ ] Infinite scroll cho message history
- [ ] Optimistic UI updates (tin nhắn hiện ngay, sync sau)

## Implementation Steps

### Backend (3-4 ngày)
1. [ ] Extend Prisma schema: thêm `parentId`, `pinnedAt` vào Message; thêm MessageReaction, MessageAttachment, MessageBookmark models
2. [ ] Update ChatService: channel CRUD, thread replies, reactions, pins
3. [ ] Tạo MessageSearchService với PostgreSQL full-text search
4. [ ] Tạo OnlinePresenceService (Redis SET cho online users)
5. [ ] Update ChatGateway: presence events, reaction events, thread events
6. [ ] Tạo DTO mới: CreateChannelDto, ReactionDto, etc.
7. [ ] Integrate Storage module cho file attachments

### Frontend (3-4 ngày)
8. [ ] Tạo `src/app/(dashboard)/tro-chuyen/` — chat page chính
9. [ ] Component: `ChatSidebar` — conversation list
10. [ ] Component: `MessageList` — hiển thị messages với infinite scroll
11. [ ] Component: `ComposeBar` — input + emoji + file upload + mentions
12. [ ] Component: `ThreadPanel` — slide-out panel
13. [ ] Component: `ChannelBrowser` — join channels
14. [ ] Component: `EmojiPicker` — emoji selection (dùng emoji-mart)
15. [ ] Component: `MentionAutocomplete` — autocomplete @user
16. [ ] Tạo React hooks: `useChat`, `useMessages`, `usePresence`
17. [ ] WebSocket integration với TanStack Query invalidation

## Files to Create/Modify

### Backend — New
- `src/modules/chat/dto/create-channel.dto.ts`
- `src/modules/chat/dto/reaction.dto.ts`
- `src/modules/chat/message-search.service.ts`
- `src/modules/chat/online-presence.service.ts`

### Backend — Modify
- `prisma/schema/system.prisma` — extend chat models
- `src/modules/chat/chat.service.ts` — channels, threads, reactions, pins
- `src/modules/chat/chat.controller.ts` — new endpoints
- `src/modules/chat/chat.gateway.ts` — presence, reaction events
- `src/modules/chat/chat.repository.ts` — new queries

### Frontend — New
- `src/app/(dashboard)/tro-chuyen/page.tsx`
- `src/app/(dashboard)/tro-chuyen/_components/chat-sidebar.tsx`
- `src/app/(dashboard)/tro-chuyen/_components/message-list.tsx`
- `src/app/(dashboard)/tro-chuyen/_components/compose-bar.tsx`
- `src/app/(dashboard)/tro-chuyen/_components/thread-panel.tsx`
- `src/app/(dashboard)/tro-chuyen/_components/channel-browser.tsx`
- `src/app/(dashboard)/tro-chuyen/_components/emoji-picker.tsx`
- `src/app/(dashboard)/tro-chuyen/_components/mention-autocomplete.tsx`
- `src/lib/hooks/use-chat.ts`
- `src/lib/hooks/use-messages.ts`
- `src/lib/hooks/use-presence.ts`
- `src/lib/api/chat.ts`

## Test Criteria
- [ ] Tạo channel → hiển thị trong channel list
- [ ] Gửi tin nhắn → hiển thị real-time ở cả hai đầu
- [ ] Reply thread → thread panel mở đúng
- [ ] Upload file trong chat → preview hiển thị
- [ ] @mention → người được mention nhận notification
- [ ] Add reaction → emoji hiển thị dưới message
- [ ] Pin message → hiển thị trong pinned list
- [ ] Search "keyword" → tìm đúng message
- [ ] Đóng/mở browser → reconnect WebSocket, load lại messages

---
Next Phase: [Phase 03 - Calendar](./phase-03-calendar.md)
