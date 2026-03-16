# Phase 06: Mobile PWA

Status: ⬜ Pending
Dependencies: Phase 02 (Chat), Phase 03 (Calendar) — nên có trước để test mobile
Est. Time: 3-4 ngày

## Objective

Biến TBS ERP frontend thành Progressive Web App: cài trên điện thoại, push notification, offline caching, touch-friendly UI cho các tính năng chính (Chat, Phê duyệt, Chấm công, Lịch).

## Requirements

### Functional
- [ ] `manifest.json` — app name, icon, theme colors, splash screen
- [ ] Service Worker — caching strategies, offline support
- [ ] Push notifications (Web Push API + VAPID keys)
- [ ] Install prompt ("Add to Home Screen")
- [ ] Offline indicator + cached data display
- [ ] Touch-optimized UI cho mobile:
  - Bottom navigation bar (Chat, Approval, Calendar, Profile)
  - Swipe gestures (swipe to approve/reject)
  - Pull-to-refresh
  - Floating action button (FAB)
- [ ] App-like transitions (slide, fade)

### Non-Functional
- [ ] Lighthouse PWA score > 90
- [ ] First paint < 2s on 3G
- [ ] Offline → show cached data, queue actions for when online
- [ ] Push notification click → deep link đến đúng page

## Implementation Steps

### Infrastructure (1 ngày)
1. [ ] Install & configure `next-pwa` hoặc `@serwist/next`
2. [ ] Tạo `public/manifest.json`
3. [ ] Tạo app icons (192x192, 512x512)
4. [ ] Configure Service Worker caching (runtime caching for API, precache for static)
5. [ ] Setup Web Push: VAPID keys, `PushSubscription` API
6. [ ] Backend: `POST /api/v1/push/subscribe` — lưu subscription
7. [ ] Backend: `src/modules/notification/push.service.ts` — gửi push via web-push

### Mobile UI (2-3 ngày)
8. [ ] Tạo `MobileLayout` — bottom nav, no sidebar
9. [ ] Responsive breakpoints: detect mobile → switch layout
10. [ ] Component: `BottomNavBar` — fixed bottom (4-5 tabs)
11. [ ] Component: `MobileHeader` — compact header with back button
12. [ ] Component: `PullToRefresh` — wrapper component
13. [ ] Component: `SwipeAction` — swipe left/right on list items
14. [ ] Component: `FAB` — floating action button
15. [ ] Tối ưu existing pages cho mobile viewport:
    - Phê duyệt: swipe approve/reject
    - Chat: full screen on mobile
    - Calendar: day view default on mobile
    - Chấm công: big check-in button
16. [ ] Offline indicator banner + queue actions (dùng IndexedDB)

## Files to Create/Modify

### New
- `public/manifest.json`
- `public/icons/` — PWA icons
- `src/components/mobile/bottom-nav.tsx`
- `src/components/mobile/mobile-header.tsx`
- `src/components/mobile/pull-to-refresh.tsx`
- `src/components/mobile/swipe-action.tsx`
- `src/components/mobile/fab.tsx`
- `src/components/mobile/offline-indicator.tsx`
- `src/lib/hooks/use-mobile.ts`
- `src/lib/hooks/use-push-notification.ts`
- Backend: `src/modules/notification/push.service.ts`

### Modified
- `next.config.mjs` — PWA config
- `src/app/layout.tsx` — manifest link, mobile meta tags
- `src/app/(dashboard)/layout.tsx` — responsive layout switch

## Test Criteria
- [ ] mở trên Chrome mobile → hiện "Add to Home Screen"
- [ ] Cài PWA → icon trên home screen, mở full screen
- [ ] Push notification → tap → đi đúng page
- [ ] Offline → hiện banner, xem data đã cache
- [ ] Bottom nav → chuyển tab mượt mà
- [ ] Swipe phê duyệt → approve thành công
- [ ] Lighthouse PWA audit > 90

---
Next Phase: [Phase 07 - Task Kanban](./phase-07-kanban.md)
