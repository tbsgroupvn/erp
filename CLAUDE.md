# CLAUDE.md — TBS ORDER ERP

> File này đặt tại root dự án. Claude Code tự động đọc khi khởi động.

---

## QUY TẮC CHUNG

- Trả lời bằng tiếng Việt
- Khi fix bug: ĐỌC skill bug-fix-workflow TRƯỚC, tuân thủ quy trình 5 bước
- Khi code mới: tuân thủ 5 nguyên tắc kiến trúc lõi
- KHÔNG refactor khi fix bug
- KHÔNG thay đổi DB schema / API contract khi fix bug
- Mỗi bug = 1 commit riêng: `fix(module): BUG-ID mô tả`

---

## TECH STACK

- Backend: NestJS + Prisma ORM + PostgreSQL + Redis
- Frontend ERP: Next.js 14 (App Router) + Tailwind + shadcn/ui + Zustand + TanStack Query
- Frontend CMS: Next.js 14 + Tailwind + shadcn/ui
- Infra: Docker + Nginx + Sentry
- Auth: JWT (15min) + Refresh (7d) + TOTP 2FA

---

## 5 NGUYÊN TẮC KIẾN TRÚC (BẤT BIẾN)

1. **ORDER-CENTRIC** — Mọi entity liên kết về Order. Không dữ liệu mồ côi.
2. **ZERO TRUST** — Tách nhiệm vụ, chặn vượt tổng, bắt buộc ảnh/chứng từ, kiểm soát kỳ kế toán.
3. **BLOCKING FLOW** — 9 FSM cưỡng chế. Không nhảy cóc trạng thái.
4. **REAL vs DECLARED** — cnWeight/vnWeight lưu riêng. Xóa mềm, không xóa cứng. Audit log mọi CRUD.
5. **DYNAMIC ALLOCATION** — Chi phí vận hành → queue finance-events → phân bổ async.

---

## CẤU TRÚC THƯ MỤC

```
Backend:  src/modules/{mod}/{mod}.controller.ts | .service.ts | dto/*.dto.ts
Frontend: src/lib/hooks/use-{mod}.ts | src/lib/api/{mod}.api.ts | src/app/(dashboard)/{route}/page.tsx
Schema:   prisma/schema/*.prisma (17 files, 95+ models)
FSM:      src/modules/{mod}/{mod}.state-machine.ts
Guards:   src/core/rbac/ | src/common/guards/
```

---

## 9 FSM

| FSM | Transitions |
|---|---|
| Đơn hàng | CONSULTING→QUOTATION→PENDING_DEPOSIT→SOURCING→WAREHOUSE_CN→PACKING→CONSOLIDATION→IN_TRANSIT→CUSTOMS→WAREHOUSE_VN→DELIVERING→SETTLEMENT→COMPLETED (+ON_HOLD/CANCELLED/RETURNED/ISSUE) |
| Đơn NCC | DRAFT→QUOTED→ORDERED→CONFIRMED→PARTIALLY_SHIPPED→SHIPPED_CN→RECEIVED_CN (+RETURN_IN_PROGRESS/REFUNDED/ISSUE/CANCELLED) |
| Container | PLANNING→LOADING→IN_TRANSIT→ARRIVED→CUSTOMS→COMPLETED (+ON_HOLD_BORDER/CUSTOMS_HOLD) |
| Báo giá | DRAFT→PENDING_APPROVAL→APPROVED→CONVERTED/EXPIRED (+REJECTED→DRAFT) |
| Khiếu nại | OPEN→INVESTIGATING→PENDING_RESOLUTION→RESOLVED→CLOSED |
| Phiếu thu/chi | PENDING→APPROVED/REJECTED (+CANCELLED/RETURNED/WITHDRAWN) |
| Kho TQ | RECEIVED→CHECKED→PACKED→SHIPPED |
| Kho VN | RECEIVED→SORTED→READY→DELIVERED |
| Thông quan | DRAFT→READY→SUBMITTED→CHANNEL_ASSIGNED→INSPECTING→CLEARED (+REJECTED→DRAFT/CANCELLED) |

---

## 22 ROLES

CEO, COO, CFO, DIRECTOR_OPERATIONS, SALES_DIRECTOR, SALES_LEADER, SALE, MARKETING_STAFF, CSKH, CHIEF_ACCOUNTANT, ACCOUNTANT, ACCOUNTANT_AR, ACCOUNTANT_COST, HR_MANAGER, LOGISTICS_MANAGER, XNK_MANAGER, XNK_STAFF, WAREHOUSE_MANAGER, WAREHOUSE_CN_AGENT, WAREHOUSE_VN_MANAGER, WAREHOUSE_VN_STAFF, DRIVER
