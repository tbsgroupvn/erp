# TBS ERP SYSTEM — BÁO CÁO REVIEW TOÀN DIỆN

> Ngày review: 25/02/2026
> Phiên bản: v3.0

---

## 1. TỔNG QUAN KIẾN TRÚC

### 1.1 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | Next.js (App Router) | 14.2.21 |
| | React | 18.x |
| | TypeScript | 5.x |
| | TailwindCSS | 3.4.x |
| | shadcn/ui + Radix UI | latest |
| | TanStack Query (React Query) | 5.x |
| | TanStack Table | 8.x |
| | React Hook Form + Zod | latest |
| | Recharts | 2.x |
| | Lucide React (icons) | latest |
| **Backend** | NestJS | 10.x |
| | TypeScript | 5.x |
| | Prisma ORM | 6.19.x |
| | Passport + JWT | latest |
| | EventEmitter2 | latest |
| | BullMQ (queues) | latest |
| | Socket.IO (WebSocket) | latest |
| | class-validator + class-transformer | latest |
| | Swagger (OpenAPI) | latest |
| | GraphQL (Apollo) | latest |
| **Database** | PostgreSQL | 16.x |
| **Cache** | Redis (ioredis) | latest |
| **Infra** | Docker Compose | — |

### 1.2 Cấu trúc thư mục

```
tbs-erp-backend/
├── prisma/schema/          → 18 file .prisma, 128 models
├── src/
│   ├── core/               → Auth, Database, Cache, Events, Config, GraphQL, Health, WebSocket
│   ├── common/             → Guards, Decorators, DTOs, Pipes, Interceptors, Utils
│   ├── modules/            → 40+ feature modules
│   └── app.module.ts       → Root module
│
tbs-erp-frontend/
├── src/
│   ├── app/(dashboard)/    → 98 trang quản trị
│   ├── app/(public)/       → 16 trang công khai
│   ├── app/admin/          → 14 trang admin CMS
│   ├── app/(auth)/         → Login page
│   ├── app/(blog-admin)/   → 3 trang blog admin
│   ├── lib/api/            → 40 API client files
│   ├── lib/hooks/          → 54 React hook files
│   ├── lib/types/          → Type definitions
│   ├── lib/utils/          → Utilities
│   └── components/         → Shared + UI components
```

### 1.3 Thống kê mã nguồn

| Metric | Số lượng |
|--------|---------|
| Backend .ts files | 638 |
| Frontend .ts/.tsx files | 496 |
| Backend lines of code | ~83,770 |
| Frontend lines of code | ~83,840 |
| **Tổng LOC** | **~167,600** |
| Prisma models | 128 |
| REST endpoints | 549 |
| Frontend pages | 147 |
| API client files | 40 |
| React hooks | 54 |
| Controllers | 68 |
| Services | 128 |
| Modules | 89 |

### 1.4 Design Patterns

- **Modular Monolith**: Mỗi module có controller → service → repository riêng
- **Event-Driven Architecture**: EventEmitter2 cho giao tiếp cross-module (container.arrived → warehouse VN chuẩn bị nhận)
- **Domain-Driven Design**: Domain services tách biệt (ConsolidationService, DutyCalculatorService, ChargeableWeightService)
- **Finite State Machine**: Status machines cho Order, Container, Package, Voucher, Customs Declaration
- **Repository Pattern**: Prisma repositories trừu tượng hóa data access
- **Guard Pattern**: JWT + Role-based guards trên mọi protected endpoint
- **CQRS-lite**: Tách query (findAll, findById) và command (create, update, transition)
- **Event Sourcing-lite**: OrderStatusHistory, TrackingEvent tables lưu lịch sử thay đổi

---

## 2. CÁC TÍNH NĂNG ĐANG HOẠT ĐỘNG (✅ WORKING)

### 2.1 Core Infrastructure
| Feature | Status | Ghi chú |
|---------|--------|---------|
| JWT Authentication + Session | ✅ | Login, refresh token, logout, session management |
| 2FA (TOTP + SMS OTP) | ✅ | Setup, verify, backup codes |
| RBAC (Role-Based Access Control) | ✅ | 15+ roles, RolesGuard, DataScopeGuard |
| Swagger API Docs | ✅ | http://localhost:3000/api/v1/docs |
| GraphQL Endpoint | ✅ | http://localhost:3000/graphql |
| WebSocket Gateway | ✅ | Real-time notifications |
| Redis Cache | ✅ | CacheService, query caching |
| BullMQ Queues | ✅ | Bull Board UI, background jobs |
| Health Checks | ✅ | Database, Redis, memory monitoring |
| Audit Logging | ✅ | AuditLogInterceptor, IP tracking |
| Rate Limiting | ✅ | @Throttle on auth endpoints |
| CORS Configuration | ✅ | Configurable origins |
| Data Retention & GDPR | ✅ | Export, anonymize, consent management |

### 2.2 Business Modules — Backend + Frontend

| Module | Endpoints | Frontend Pages | Status |
|--------|-----------|---------------|--------|
| **Đơn hàng (Order)** | 12 | 5 (list, detail, create, templates, excel import) | ✅ |
| **Container** | 11 | 2 (list, unload) | ✅ |
| **Kho TQ (Warehouse CN)** | 10+ | 5 (list, detail, batch receive, consolidate, lost&found) | ✅ |
| **Kho VN (Warehouse VN)** | 10+ | 3 (list, pick-list, inventory count) | ✅ |
| **Giao hàng (Delivery)** | 8 | 2 (list, route optimization) | ✅ |
| **Khách hàng (CRM)** | 14 | 5 (list, detail, create, leads, support view) | ✅ |
| **Thông quan (Customs)** | 15 | 4 (list, detail, HS lookup, service rates) | ✅ |
| **Hóa đơn (Invoice)** | 8 | 2 (list, detail) | ✅ |
| **Phiếu thu chi (Cash)** | 5 | 1 | ✅ |
| **Công nợ phải thu (AR)** | 6 | 2 (list, aging analysis) | ✅ |
| **Công nợ phải trả (AP)** | 6 | 1 | ✅ |
| **Sổ cái (GL)** | 10 | 1 | ✅ |
| **Tỷ giá (Exchange Rate)** | 5 | 1 | ✅ |
| **Bù trừ công nợ (Debt Netting)** | 6 | 1 | ✅ |
| **COD** | 6 | — (integrated in delivery) | ✅ |
| **Quỹ chưa phân bổ** | 4 | 1 | ✅ |
| **Khiếu nại (Complaint)** | 6 | 3 (list, detail, create) | ✅ |
| **Hỗ trợ (Support Ticket)** | 6 | 3 (list, detail, create) | ✅ |
| **QC (Quality Control)** | 6 | 1 | ✅ |
| **Báo giá (Quotation)** | 6 | 3 (list, detail, create) | ✅ |
| **Hợp đồng (Contract)** | 5 | 3 (list, detail, create) | ✅ |
| **Nhà cung cấp (Vendor)** | 8 | 2 (list, detail) | ✅ |
| **Mua hàng (Purchase)** | 7 | 3 (list, detail, create) | ✅ |
| **Kho vật tư (Inventory)** | 7 | 1 | ✅ |
| **Phương tiện (Fleet)** | 9 | 2 (list, detail) | ✅ |
| **Tài xế (Driver)** | 9 | 2 (list, detail) | ✅ |
| **Nhân sự (Employee)** | 7 | 4 (list, detail, create, candidates) | ✅ |
| **Chấm công (Attendance)** | 13 | 3 (main, manual, review) | ✅ |
| **Lương (Payroll)** | 5 | 1 | ✅ |
| **Phê duyệt (Approval)** | 18 | 2 (list, detail) | ✅ |
| **Công việc (Task)** | 9 | 3 (list, detail, create) | ✅ |
| **Tài liệu (Document)** | 7 | 1 | ✅ |
| **Thông báo (Notification)** | 7 | 1 | ✅ |
| **Dashboard** | 6+ | 3 (overview, sales, CSKH) | ✅ |
| **Báo cáo (Reports)** | 5 | 5 (sales, financial, P&L, margin, cash flow) | ✅ |
| **Hoa hồng (Commission)** | — | 1 | ✅ |
| **Customer Portal** | 9 | — (API only) | ✅ |
| **Blog Admin** | 7 | 3 | ✅ |
| **CMS (Pages, Media, Menu, Settings, FAQ, Newsletter, Contacts)** | 50+ | 14 | ✅ |
| **Cài đặt (Settings)** | — | 4 (main, notification rules, escalation, approval flows) | ✅ |

### 2.3 Public Website (16 pages)
| Page | Status |
|------|--------|
| Trang chủ | ✅ |
| Giới thiệu | ✅ |
| Dịch vụ (4 sub-pages) | ✅ |
| Tin tức + Chi tiết | ✅ |
| Liên hệ | ✅ |
| Hỏi đáp | ✅ |
| Tra cứu vận đơn | ✅ |
| Tính phí | ✅ |
| So sánh dịch vụ | ✅ |
| Đăng ký | ✅ |
| Chính sách bảo mật | ✅ |
| Điều khoản sử dụng | ✅ |

---

## 3. CÁC TÍNH NĂNG CHƯA HOẠT ĐỘNG (❌ NOT WORKING)

### 3.1 Integration Services — Toàn bộ là STUB (23 TODO)

Tất cả 5 integration services trả về **mock data**, chưa tích hợp API thực:

| Service | File | TODO count | Mô tả |
|---------|------|-----------|-------|
| **Accounting (MISA/FAST)** | `integration/accounting/accounting.service.ts` | 5 | Export MISA, Fast, sync CoA, financial statements, bank import |
| **Banking** | `integration/banking/banking.service.ts` | 4 | Balance inquiry, transactions, reconciliation, transfer |
| **Customs (VNACCS)** | `integration/customs/customs.service.ts` | 5 | Declaration submit, status, HS lookup, manifest, duty calc |
| **Shipping (Carriers)** | `integration/shipping/shipping.service.ts` | 4 | Tracking, rate quotes, pickup booking, webhook handling |
| **LarkSuite** | `integration/larksuite/larksuite.service.ts` | 5 | Employee sync, messages, calendar, approvals, user lookup |

### 3.2 Tính năng có code nhưng chưa hoàn thiện

| Feature | Vấn đề | File |
|---------|--------|------|
| **Excel export (CMS Contacts)** | `// TODO: Implement Excel export` | `cms-contacts/contacts.controller.ts:51` |
| **Excel export (Newsletter)** | `// TODO: Implement Excel export` | `cms-newsletter/newsletter.controller.ts:59` |
| **Exchange Rate API (VCB)** | `// TODO: Implement Vietcombank API integration` | `exchange-rate/exchange-rate.service.ts:269` |
| **File Storage Cleanup** | `// TODO: Implement background job for purging` | `document/document.service.ts:125` |
| **Customs Document Notification** | `// TODO: Send notification to customs team` | `customs-document.service.ts:321` |
| **Route Optimization (Google Maps)** | Frontend page exists, backend endpoint is a stub | `delivery-dispatch.service.ts` |
| **Live GPS Tracking** | No real GPS data source | WebSocket + Redis có, nhưng không có driver app |
| **Offline Mode (PWA)** | Chưa implement | Planned for Phase 9 |
| **Email/SMS Sending** | SmsModule exists but likely no real provider configured | Config-dependent |

### 3.3 Frontend Pages có nhưng dùng static/mock data

| Page | Vấn đề |
|------|--------|
| `/tong-quan` (Dashboard) | Gọi API thật nhưng DB trống → hiện 0 |
| `/ngan-sach` (Budget) | Page có nhưng backend budget module chưa rõ |
| `/tai-san` (Assets) | Page có nhưng không có asset module riêng |
| `/theo-doi` (Tracking) | Gọi portal API, cần customer context |
| `/giao-hang/toi-uu-lo-trinh` | UI bản đồ có, backend route optimization là stub |

---

## 4. CÁC VẤN ĐỀ KỸ THUẬT (⚠️ ISSUES)

### 4.1 Security

| Severity | Vấn đề | Chi tiết |
|----------|--------|----------|
| ⚠️ Medium | **Impersonation endpoint** | `POST /auth/impersonate/:customerId` cho phép admin giả mạo customer — cần audit kỹ |
| ⚠️ Medium | **Public endpoint không rate limit** | `POST /api/v1/public/leads` và `GET /api/v1/public/tracking/:code` có thể bị abuse |
| ✅ OK | JWT + bcrypt | Passwords hashed with bcrypt (10 rounds), JWT with configurable secret |
| ✅ OK | RBAC Guards | Mọi protected endpoint đều có `@UseGuards(JwtAuthGuard, RolesGuard)` |
| ✅ OK | Input Validation | class-validator DTOs trên hầu hết endpoints |
| ✅ OK | SQL Injection | Prisma ORM parameterized queries |
| ✅ OK | CORS | Configurable, not wildcard in production |

### 4.2 Performance

| Severity | Vấn đề | File |
|----------|--------|------|
| ⚠️ Medium | **N+1 in batchReceive** | `warehouse-cn.service.ts:505` — loop qua trackingNumbers với individual DB queries |
| ⚠️ Low | **pg_stat_replication query error** | `read-replica.service.ts` — raw SQL error mỗi 30s (non-blocking) |
| ⚠️ Low | **Cache warming queries** | Dashboard cache warming runs every 60s with 15+ queries |
| ✅ OK | Redis caching | Barcode scan cached 5 min, dashboard cached |
| ✅ OK | Pagination | All list endpoints paginated |
| ✅ OK | Database indexes | Models have `@@index` on frequently queried fields |

### 4.3 Code Quality

| Severity | Vấn đề | Count |
|----------|--------|-------|
| ⚠️ Info | **TODO comments** | 74 in backend, 1 in frontend |
| ⚠️ Info | **Type casts to `any`** | ~10 places (status machine casts, Prisma type mismatches) |
| ✅ OK | No dead code files | All module files are imported |
| ✅ OK | Consistent patterns | All modules follow controller→service→repository pattern |
| ✅ OK | Event-driven | Cross-module communication via events, no circular deps |

### 4.4 Missing Features (Business Logic)

| Feature | Impact |
|---------|--------|
| No file upload implementation | Documents, images stored as URLs but no upload endpoint with storage (S3/local) |
| No email sending | Password reset, notifications rely on email but no provider configured |
| No report export (PDF/Excel) | Report pages show data but no download/export |
| No cron job runner | Scheduled tasks (aging reminders, escalation checks) need cron setup |

---

## 5. DATABASE REVIEW

### 5.1 Schema Files (18 files, 128 models)

| File | Models | Key Tables |
|------|--------|-----------|
| `auth.prisma` | 6 | User, Session, ApiKey, AuditLog, AuditLogArchive, ImpersonationLog |
| `order.prisma` | 8 | Order, OrderItem, OrderStatusHistory, MasterOrder, PreAlert, OrderExtraCharge, Quotation, QuotationItem |
| `container.prisma` | 2 | Container, TrackingEvent |
| `warehouse.prisma` | 4 | Package, PackageConsolidation, StorageLocation, QCPhotoGuideline |
| `delivery.prisma` | 2 | Delivery, CODRecord |
| `crm.prisma` | 8 | Customer, Wallet, WalletTransaction, Lead, LeadNote, CustomerInteractionNote, CommissionRule, CommissionRecord |
| `customs.prisma` | 8 | CustomsDeclaration, CustomsDeclarationLine, CustomsLineSourceItem, CustomsStatusHistory, CustomsTaxAllocation, HSCodeLibrary, HSCodeKeyword, ComplianceRule/Alert |
| `finance.prisma` | 10 | AccountReceivable, AccountPayable, PaymentVoucher, Invoice, InvoiceItem, PaymentAllocation, CashTransaction, etc. |
| `general-ledger.prisma` | 5 | ChartOfAccount, JournalEntry, JournalEntryLine, ClosedPeriod, ExchangeRate |
| `hr.prisma` | 10 | Employee, Attendance, LeaveRequest, OvertimeRequest, PayrollRecord, Contract, TrainingRecord, etc. |
| `fleet.prisma` | 4 | Vehicle, VehicleMaintenance, FuelRecord, Driver |
| `procurement.prisma` | 5 | Vendor, VendorRating, PurchaseRequest, PurchaseOrder, StockItem/Movement |
| `complaint.prisma` | 2 | Complaint, LostAndFound |
| `notification.prisma` | 4 | Notification, NotificationRecord, NotificationRule, EscalationRule |
| `approval.prisma` | 7 | Approval, ApprovalStep, ApprovalFlowDefinition, FlowNode/Edge, Delegation, ActionLog, Comment, CC |
| `system.prisma` | 8 | Task, TaskComment, Document, MHHIssue, OperationCost, CostAllocation, DebtNetting, etc. |
| `cms.prisma` | 12 | BlogPost, BlogCategory, BlogComment, Page, Media, Menu, MenuItem, SiteSetting, FAQ, Contact, Newsletter, etc. |
| `support.prisma` | 4 | SupportTicket, TicketResponse, ResponseTemplate, Candidate, OnboardingChecklist, PerformanceNote |

### 5.2 Indexes & Constraints

- ✅ **128 models** đều có `@id @default(cuid())` primary key
- ✅ **Unique constraints** trên `code`, `email`, `slug` fields
- ✅ **Composite indexes** trên frequently queried combinations (e.g., `@@index([customerId, createdAt])`)
- ✅ **Foreign keys** via Prisma `@relation` on all linked models
- ✅ **Soft delete** pattern: `deletedAt DateTime?` trên OrderItem
- ⚠️ **No migrations**: Sử dụng `prisma db push` thay vì migration files (chấp nhận được cho development)

### 5.3 Seed Data

| File | Status |
|------|--------|
| `prisma/seed/approval-flows.seed.ts` | ✅ Seeds DISCOUNT, PAYMENT_VOUCHER, ORDER_CANCEL flows |
| `prisma/seed/compliance-rules.seed.ts` | ✅ Seeds customs compliance rules |
| `scripts/seed-blog.ts` | ✅ Seeds blog posts |
| `NotificationRulesSeedService` | ✅ Auto-seeds 4 default notification rules on startup |
| `ChartOfAccount seeding` | ⚠️ Not found — cần seed tài khoản kế toán chuẩn VN |
| `User seeding` | ⚠️ Không có — phải tạo user thủ công |

---

## 6. TIẾN ĐỘ TỔNG THỂ

### 6.1 Bảng tổng hợp Module

| # | Module | Backend | Frontend | DB | Integration | % | Ghi chú |
|---|--------|---------|----------|-----|------------|---|---------|
| 1 | Auth & Security | ✅ | ✅ | ✅ | — | **95%** | Thiếu email verification |
| 2 | Đơn hàng (Order) | ✅ | ✅ | ✅ | — | **95%** | Đầy đủ CRUD + status flow |
| 3 | Container | ✅ | ✅ | ✅ | — | **95%** | Vừa fix xong unload endpoints |
| 4 | Kho TQ | ✅ | ✅ | ✅ | — | **90%** | Thiếu offline mode |
| 5 | Kho VN | ✅ | ✅ | ✅ | — | **90%** | Storage location management OK |
| 6 | Giao hàng | ✅ | ✅ | ✅ | ⚠️ | **75%** | Route optimization là stub |
| 7 | CRM (KH + Leads) | ✅ | ✅ | ✅ | — | **90%** | Lead pipeline, interaction notes OK |
| 8 | Thông quan | ✅ | ✅ | ✅ | ⚠️ | **85%** | VNACCS integration là stub |
| 9 | Hóa đơn | ✅ | ✅ | ✅ | ⚠️ | **80%** | E-invoice push-tax là stub |
| 10 | Phiếu thu chi | ✅ | ✅ | ✅ | — | **90%** | Approval flow hoạt động |
| 11 | Công nợ phải thu | ✅ | ✅ | ✅ | — | **90%** | Aging analysis OK |
| 12 | Công nợ phải trả | ✅ | ✅ | ✅ | — | **90%** | |
| 13 | Sổ cái | ✅ | ✅ | ✅ | — | **85%** | Period closing, FX revaluation OK |
| 14 | Tỷ giá | ✅ | ✅ | ✅ | ⚠️ | **80%** | Vietcombank API là TODO |
| 15 | Bù trừ công nợ | ✅ | ✅ | ✅ | — | **90%** | |
| 16 | COD | ✅ | — | ✅ | — | **85%** | Không có UI riêng |
| 17 | Quỹ chưa phân bổ | ✅ | ✅ | ✅ | — | **90%** | |
| 18 | Khiếu nại | ✅ | ✅ | ✅ | — | **90%** | |
| 19 | Hỗ trợ (Ticket) | ✅ | ✅ | ✅ | — | **90%** | SLA tracking OK |
| 20 | QC | ✅ | ✅ | ✅ | — | **85%** | Photo guidelines OK |
| 21 | Báo giá | ✅ | ✅ | ✅ | — | **90%** | |
| 22 | Hợp đồng | ✅ | ✅ | ✅ | — | **85%** | |
| 23 | Nhà cung cấp | ✅ | ✅ | ✅ | — | **90%** | Rating system OK |
| 24 | Mua hàng | ✅ | ✅ | ✅ | — | **85%** | |
| 25 | Kho vật tư | ✅ | ✅ | ✅ | — | **85%** | |
| 26 | Phương tiện | ✅ | ✅ | ✅ | — | **90%** | Maintenance, fuel tracking OK |
| 27 | Tài xế | ✅ | ✅ | ✅ | — | **85%** | |
| 28 | Nhân sự | ✅ | ✅ | ✅ | — | **85%** | Training, onboarding, candidates OK |
| 29 | Chấm công | ✅ | ✅ | ✅ | — | **90%** | Leave, overtime OK |
| 30 | Lương | ✅ | ✅ | ✅ | — | **80%** | |
| 31 | Phê duyệt | ✅ | ✅ | ✅ | — | **95%** | Multi-step, delegation, flow builder OK |
| 32 | Công việc | ✅ | ✅ | ✅ | — | **90%** | |
| 33 | Tài liệu | ✅ | ✅ | ✅ | ⚠️ | **75%** | Thiếu actual file storage |
| 34 | Thông báo | ✅ | ✅ | ✅ | — | **90%** | Rules engine, escalation OK |
| 35 | Dashboard | ✅ | ✅ | ✅ | — | **85%** | Sales pipeline, analytics OK |
| 36 | Báo cáo | ✅ | ✅ | ✅ | — | **80%** | 5 báo cáo, thiếu export PDF/Excel |
| 37 | Customer Portal | ✅ | — | ✅ | — | **70%** | API only, chưa có UI portal riêng |
| 38 | CMS | ✅ | ✅ | ✅ | — | **90%** | Full pages, media, menus, FAQ |
| 39 | Blog | ✅ | ✅ | ✅ | — | **90%** | Categories, comments, admin |
| 40 | **Tích hợp bên ngoài** | ⚠️ | — | — | ❌ | **10%** | Tất cả 5 integration services là STUB |

### 6.2 Tổng kết

```
┌─────────────────────────────────────────────────────┐
│  TIẾN ĐỘ TỔNG THỂ:  ~85%                          │
│                                                      │
│  ████████████████████░░░░  Backend Logic:    90%     │
│  ████████████████████░░░░  Frontend UI:      88%     │
│  █████████████████████░░░  Database Schema:  95%     │
│  ██░░░░░░░░░░░░░░░░░░░░░  Integrations:     10%     │
│  ████████████████░░░░░░░░  Testing:           0%     │
│  ████████████░░░░░░░░░░░░  DevOps/CI-CD:     5%     │
└─────────────────────────────────────────────────────┘
```

### 6.3 Thứ tự ưu tiên hoàn thiện

| Ưu tiên | Task | Impact | Effort |
|---------|------|--------|--------|
| **P0** | Seed data (Users, ChartOfAccount, HS codes) | Không có data thì không test được | S |
| **P0** | File upload service (S3/MinIO) | Documents, images đều cần | M |
| **P0** | Email service thật (SendGrid/SES) | Password reset, notifications | S |
| **P1** | Unit tests cho core modules | Quality assurance | L |
| **P1** | Migration files (từ db push → migrate) | Production deployment | M |
| **P1** | Tích hợp Vietcombank tỷ giá API | Tỷ giá tự động | S |
| **P2** | Integration: Banking (bank reconciliation) | Tài chính tự động | L |
| **P2** | Integration: E-Invoice (tax push) | Legal requirement | L |
| **P2** | Report export PDF/Excel | Business users cần | M |
| **P2** | Cron jobs cho scheduled tasks | Escalation, reminders | M |
| **P3** | Integration: Shipping carriers | Tracking tự động | L |
| **P3** | Integration: MISA/FAST accounting | Export kế toán | L |
| **P3** | Integration: LarkSuite | HR sync | L |
| **P3** | Route optimization (Google Maps API) | Delivery efficiency | M |
| **P4** | Customer portal frontend | Self-service | L |
| **P4** | Offline mode (PWA) | Kho TQ khi mất mạng | XL |
| **P4** | CI/CD pipeline | Automated deployment | M |
| **P4** | E2E testing | Full coverage | XL |

---

## PHỤ LỤC: Danh sách TODO/FIXME đầy đủ (74 items)

### Integration Stubs (23 items)
- `integration/accounting/accounting.service.ts` — 5 TODO
- `integration/banking/banking.service.ts` — 4 TODO
- `integration/customs/customs.service.ts` — 5 TODO
- `integration/shipping/shipping.service.ts` — 4 TODO
- `integration/larksuite/larksuite.service.ts` — 5 TODO

### Business Logic TODOs (8 items)
- `cms-contacts/contacts.controller.ts:51` — Excel export
- `cms-newsletter/newsletter.controller.ts:59` — Excel export
- `exchange-rate/exchange-rate.service.ts:269` — Vietcombank API
- `document/document.service.ts:125` — Storage cleanup cron
- `customs-document.service.ts:321` — Notification
- `complaint/complaint.service.ts:81` — Rate limiting
- `error-boundary.tsx:59` — Error reporting (Sentry)
- Còn lại là format code comments (XXXX patterns), không phải TODO thực sự

---

*Report generated by Claude Code on 2026-02-25*
