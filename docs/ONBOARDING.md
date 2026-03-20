# Hướng dẫn Onboarding dành cho Developer mới — TBS ERP

> Tài liệu này giúp developer mới nắm được toàn bộ codebase, thiết lập môi trường, hiểu kiến trúc và bắt đầu đóng góp trong thời gian ngắn nhất.

---

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Thiết lập môi trường phát triển](#2-thiết-lập-môi-trường-phát-triển)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Modules quan trọng](#4-modules-quan-trọng)
5. [9 FSM State Machines](#5-9-fsm-state-machines)
6. [22 Roles và RBAC](#6-22-roles-và-rbac)
7. [Coding conventions](#7-coding-conventions)
8. [Chạy tests](#8-chạy-tests)
9. [Common tasks](#9-common-tasks)
10. [Resources](#10-resources)

---

## 1. Tổng quan dự án

### TBS ERP là gì?

TBS ERP là hệ thống hoạch định nguồn lực doanh nghiệp (ERP) chuyên biệt cho lĩnh vực **thương mại xuyên biên giới Trung Quốc - Việt Nam**. Hệ thống quản lý toàn bộ vòng đời của một đơn hàng nhập khẩu, từ lúc tư vấn khách hàng, đặt hàng nhà cung cấp bên Trung Quốc, vận chuyển qua kho trung chuyển, làm thủ tục thông quan, đến khi giao hàng tận tay khách hàng tại Việt Nam và quyết toán tài chính.

**Các loại hình dịch vụ chính:**
- **MHH (Mua hàng hộ)** — TBS đứng ra mua hàng thay cho khách, ứng tiền và thu hồi sau.
- **VCT (Vận chuyển thuê)** — Khách tự mua hàng, TBS chỉ vận chuyển và làm thủ tục.

### Tech stack

| Lớp | Công nghệ |
|---|---|
| Backend API | NestJS 11 + TypeScript 5.7 |
| ORM | Prisma 6 (multi-schema) |
| Database | PostgreSQL 16 (qua PgBouncer) |
| Cache / Queue | Redis 7 + BullMQ 5 |
| Frontend ERP | Next.js 14 App Router + Tailwind + shadcn/ui |
| State management | Zustand + TanStack Query |
| Auth | JWT 15min + Refresh 7d + TOTP 2FA |
| Object Storage | MinIO (S3-compatible) |
| Monitoring | Prometheus + Sentry |
| Infra | Docker + Docker Compose + Nginx |
| Authorization | CASL 6 (Attribute-Based Access Control) |

### 5 Nguyên tắc kiến trúc bất biến

Mọi quyết định thiết kế đều phải tuân theo 5 nguyên tắc sau. Đây là **bất biến** — không được vi phạm dù ở bất kỳ hoàn cảnh nào.

**1. ORDER-CENTRIC**
Mọi entity trong hệ thống đều phải liên kết về `Order`. Không có dữ liệu mồ côi (orphan data). Khi tạo bất kỳ bản ghi nghiệp vụ nào (phiếu thu, chi phí, container, khiếu nại...) luôn phải có `orderId` hoặc liên kết gián tiếp về đơn hàng.

**2. ZERO TRUST**
Tách biệt nhiệm vụ giữa các role. Ngăn chặn vượt tổng (ví dụ: tiền thu không được vượt tổng đơn). Bắt buộc đính kèm ảnh/chứng từ ở các bước quan trọng. Kiểm soát kỳ kế toán (không cho phép sửa bút toán đã đóng kỳ).

**3. BLOCKING FLOW**
9 FSM (Finite State Machine) cưỡng chế luồng nghiệp vụ. Không cho phép nhảy cóc trạng thái. Mỗi chuyển đổi trạng thái đều được validate trước khi thực thi.

**4. REAL vs DECLARED**
Lưu riêng hai bộ dữ liệu: dữ liệu thực tế (cnWeight, vnWeight) và dữ liệu khai báo. Không xóa cứng (hard delete) — chỉ xóa mềm (`deletedAt`). Ghi audit log cho mọi thao tác CRUD nhạy cảm.

**5. DYNAMIC ALLOCATION**
Chi phí vận hành không phân bổ trực tiếp mà đi qua queue `finance-events` và được phân bổ async. Điều này đảm bảo tính nhất quán và khả năng mở rộng.

---

## 2. Thiết lập môi trường phát triển

### Prerequisites

| Công cụ | Phiên bản tối thiểu | Mục đích |
|---|---|---|
| Node.js | 20 LTS | Chạy backend/frontend locally |
| Docker Desktop | 4.x | Chạy toàn bộ stack |
| Git | 2.x | Quản lý source code |
| VS Code | Tùy chọn | IDE được khuyến nghị |

### Bước 1: Clone repo

```bash
git clone <repo-url> ERPv1
cd ERPv1
```

### Bước 2: Tạo file `.env` cho backend

```bash
cp tbs-erp-backend/.env.example tbs-erp-backend/.env
```

Điền các giá trị bắt buộc trong file `.env`. Với môi trường dev, giá trị mặc định trong `docker-compose.dev.yml` đã được cấu hình sẵn — chỉ cần đảm bảo không để trống `JWT_SECRET` và `JWT_REFRESH_SECRET`.

Sinh secret mạnh:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Bước 3: Khởi động toàn bộ stack

```bash
docker compose -f docker-compose.dev.yml up -d
```

Lệnh này sẽ khởi động các service theo thứ tự sau (dựa trên `depends_on` + healthcheck):
1. PostgreSQL 16 (tbs_dev_postgres)
2. Redis 7 (tbs_dev_redis)
3. PgBouncer (tbs_dev_pgbouncer) — connection pooler
4. Backend NestJS (tbs_dev_backend)
5. Frontend Next.js (tbs_dev_frontend)
6. Prisma Studio, MinIO, pg-backup (tùy chọn)

### Port mapping

| Service | Host Port | Container Port | URL |
|---|---|---|---|
| PostgreSQL | 5433 | 5432 | `postgresql://localhost:5433/tbs_erp` |
| PgBouncer | 6432 | 6432 | Connection pooler |
| Redis | 6379 | 6379 | `redis://localhost:6379` |
| Backend API | 3001 | 3000 | `http://localhost:3001/api/v1` |
| Frontend ERP | 3000 | 3000 | `http://localhost:3000` |
| Prisma Studio | 5555 | 5555 | `http://localhost:5555` |
| MinIO S3 API | 9000 | 9000 | `http://localhost:9000` |
| MinIO Console | 9001 | 9001 | `http://localhost:9001` |

**Luu y:** PostgreSQL chạy trên port 5433 (không phải 5432 mặc định) để tránh xung đột với PostgreSQL cài sẵn trên máy. Backend kết nối qua PgBouncer (6432), không phải trực tiếp PostgreSQL.

### Bước 4: Chạy database migrations và seed

```bash
# Chạy migrations
docker exec tbs_dev_backend npx prisma migrate deploy

# Seed dữ liệu mẫu (tạo user admin, roles, cấu hình mặc định)
docker exec tbs_dev_backend npx ts-node prisma/seed/index.ts
```

Hoặc chạy trực tiếp trong container backend:
```bash
docker exec -it tbs_dev_backend sh
npx prisma migrate dev
npx prisma db seed
```

### Bước 5: Xác nhận hệ thống hoạt động

```bash
# Health check API
curl http://localhost:3001/api/v1/health

# Kết quả mong đợi:
# {"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"}}}
```

Mở trình duyệt:
- Frontend: `http://localhost:3000`
- Swagger API docs: `http://localhost:3001/api/v1/docs`
- Prisma Studio: `http://localhost:5555`
- Bull Board (queue monitor): `http://localhost:3001/api/v1/queues`

### Khắc phục sự cố thường gặp

**Backend không start:**
```bash
# Xem logs
docker logs tbs_dev_backend --tail=50

# Thường do: DATABASE_URL sai, Redis chưa ready
docker ps  # Kiểm tra tất cả container đang chạy
```

**Port bị chiếm:**
```bash
# Windows
netstat -ano | findstr :3001
# Dừng process hoặc thay đổi port trong .env
```

**Reset toàn bộ:**
```bash
docker compose -f docker-compose.dev.yml down -v  # Xóa volumes
docker compose -f docker-compose.dev.yml up -d    # Khởi động lại
```

---

## 3. Cấu trúc thư mục

### Tổng quan root

```
ERPv1/
├── tbs-erp-backend/          # NestJS API server
├── tbs-erp-frontend/         # Next.js ERP frontend
├── docs/                     # Tài liệu dự án
├── docker-compose.dev.yml    # Dev environment (4 core + utilities)
├── docker-compose.yml        # Production
├── docker-compose.staging.yml
├── CLAUDE.md                 # Quy tắc và conventions (đọc trước)
└── .env.docker.example       # Template biến môi trường
```

### Backend (`tbs-erp-backend/`)

```
src/
├── main.ts                   # Entry point, bootstrap NestJS
├── app.module.ts             # Root module
│
├── core/                     # Infrastructure cross-cutting concerns
│   ├── auth/                 # JWT strategy, guards, 2FA
│   ├── cache/                # Redis cache service + invalidation
│   ├── database/             # PrismaService, connection config
│   ├── email/                # Email templates + sending
│   ├── encryption/           # Field-level encryption
│   ├── event-bus/            # NestJS EventEmitter wrappers
│   ├── events/               # BullMQ processors (order/finance/warehouse)
│   ├── health/               # /health/live + /health/ready endpoints
│   ├── logger/               # Structured logging with correlation IDs
│   ├── metrics/              # Prometheus metrics
│   ├── queue/                # BullMQ module setup, Bull Board
│   ├── rbac/                 # CASL ability factory, DataScopeService
│   ├── storage/              # MinIO / S3 abstraction (@Global)
│   └── websocket/            # Socket.io gateway + Redis adapter
│
├── modules/                  # Domain modules (business logic)
│   ├── order/                # Xem mục 4 bên dưới
│   ├── quotation/
│   ├── supplier-order/
│   ├── container/
│   ├── warehouse-cn/
│   ├── warehouse-vn/
│   ├── customs-declaration/
│   └── ...                   # 80+ modules
│
└── common/                   # Shared utilities không thuộc module cụ thể
    ├── constants/            # OrderStatus, ApprovalType, enums
    ├── decorators/           # @CurrentUser, @Roles, @SanitizeHtml...
    ├── domain/               # BaseStatusMachine, base entity
    ├── exceptions/           # DomainException + ErrorCode registry
    ├── filters/              # Global exception filter
    ├── guards/               # RolesGuard, ThrottlerGuard
    ├── interceptors/         # Logging, transform response
    └── pipes/                # ValidationPipe config
```

**Quy ước đặt tên module:**
```
src/modules/{module-name}/
├── {module-name}.controller.ts    # HTTP endpoints, @ApiTags, @Roles
├── {module-name}.service.ts       # Business logic chính
├── {module-name}.module.ts        # NestJS module wiring
├── {module-name}.repository.ts    # Prisma queries (nếu phức tạp)
├── domain/
│   ├── {module-name}.state-machine.ts   # FSM (nếu có)
│   └── {sub-domain}.service.ts          # Domain logic tách biệt
└── dto/
    ├── create-{entity}.dto.ts
    ├── update-{entity}.dto.ts
    └── {entity}-query.dto.ts
```

### Frontend (`tbs-erp-frontend/`)

```
src/
├── app/
│   ├── (dashboard)/          # Layout yêu cầu đăng nhập
│   │   ├── don-hang/         # Quản lý đơn hàng
│   │   ├── tai-chinh/        # Tài chính
│   │   ├── kho-trung-quoc/   # Kho TQ
│   │   ├── kho-viet-nam/     # Kho VN
│   │   └── ...               # 50+ routes
│   └── (public)/             # Landing page, đăng ký...
│
├── lib/
│   ├── api/                  # Axios-based API clients
│   │   ├── client.ts         # Base axios instance + interceptors
│   │   └── {mod}.api.ts      # Typed API calls per module
│   ├── hooks/                # TanStack Query hooks
│   │   └── use-{mod}.ts      # useQuery / useMutation per module
│   └── stores/               # Zustand global state
│       └── auth-store.ts     # User session, JWT tokens
│
├── components/               # Reusable UI components
│   ├── shared/               # DataTable, FormSkeleton, CustomerPicker...
│   └── ui/                   # shadcn/ui primitives
│
└── features/                 # Complex feature-level components
    └── dashboard/            # Dashboard charts, KPIs
```

### Database Schema (`tbs-erp-backend/prisma/schema/`)

Schema được tách thành **36 file** theo domain, Prisma tổng hợp tất cả qua `schema.prisma`:

```
prisma/schema/
├── schema.prisma             # datasource + generator config
├── auth.prisma               # User, RefreshToken, ApiKey, Session
├── order.prisma              # Order, OrderItem, SubOrder, Package
├── finance.prisma            # PaymentVoucher, Invoice, AccountReceivable
├── hr.prisma                 # Employee, Department, Attendance
├── warehouse.prisma          # Package, WarehouseCN, WarehouseVN
├── container.prisma          # Container, Manifest
├── crm.prisma                # Customer, CustomerTier, Lead
├── customs.prisma            # CustomsDeclaration, CustomsDocument
├── logistics.prisma          # Delivery, Fleet, Driver
├── chat.prisma               # Message, Channel, ChatReaction
├── calendar.prisma           # CalendarEvent, EventParticipant
├── drive.prisma              # DriveFile, DriveFolder, DriveFileShare
└── ...                       # 22 file schema khác
```

---

## 4. Modules quan trọng

### Core Domain Modules

| Module | Mô tả |
|---|---|
| `order` | Trung tâm hệ thống. Quản lý đơn hàng từ CONSULTING đến COMPLETED. Chứa FSM, deposit gate, MHH issue tracking. |
| `quotation` | Tạo và duyệt báo giá cho khách. FSM: DRAFT → PENDING_APPROVAL → APPROVED/REJECTED. |
| `supplier-order` | Đặt hàng nhà cung cấp (NCC) tại TQ. FSM riêng với tracking giao nhận. |
| `container` | Quản lý container vận chuyển. Gom hàng, manifest, tracking hải quan. |
| `customs-declaration` | Khai báo hải quan. FSM từ DRAFT đến CLEARED. Tích hợp nhắc nhở tự động. |
| `warehouse-cn` | Kho trung chuyển tại Trung Quốc. Quét QR, kiểm tra hàng, đóng gói. |
| `warehouse-vn` | Kho nhận hàng tại Việt Nam. Phân loại, giao hàng, lost-and-found. |

### Finance Modules

| Module | Mô tả |
|---|---|
| `general-ledger` | Sổ cái tổng hợp, bút toán kế toán, kiểm soát kỳ kế toán. |
| `accounts-receivable` | Công nợ phải thu. AR aging analysis, snapshot định kỳ. |
| `accounts-payable` | Công nợ phải trả với nhà cung cấp. |
| `cash` | Phiếu thu/chi, quản lý ngân quỹ, xác thực payment voucher. |
| `debt-netting` | Bù trừ công nợ giữa các bên. |
| `operation-cost` | Chi phí vận hành, phân bổ async qua queue finance-events. |
| `commission` | Hoa hồng nhân viên kinh doanh, tính khi đơn COMPLETED. |
| `invoice` | Tạo và quản lý hóa đơn. |
| `budget` | Quản lý ngân sách theo phòng ban. |
| `exchange-rate` | Tỷ giá VND/CNY, tích hợp API Vietcombank. |

### HR & Operations Modules

| Module | Mô tả |
|---|---|
| `employee` | Hồ sơ nhân viên, thông tin cá nhân. |
| `attendance` | Chấm công, GPS tracking. |
| `payroll` | Tính lương, bảng lương tháng. |
| `recruitment` | Quản lý tuyển dụng, pipeline ứng viên. |
| `okr` | Mục tiêu và kết quả then chốt (OKR framework). |
| `performance` | Đánh giá hiệu suất nhân viên. |
| `training` | Quản lý đào tạo nội bộ. |

### CRM & Customer Modules

| Module | Mô tả |
|---|---|
| `crm` | Quản lý khách hàng, tier system (NEW/REGULAR/VIP/STRATEGIC), lịch sử giao dịch. |
| `complaint` | Khiếu nại khách hàng. FSM: OPEN → INVESTIGATING → RESOLVED → CLOSED. |
| `support-ticket` | Ticket hỗ trợ kỹ thuật, SLA monitoring. |
| `notification` | Thông báo in-app + email. Driven bởi event emitter. |
| `customer-portal` | Portal tự phục vụ cho khách hàng. |

### Infrastructure Modules

| Module | Mô tả |
|---|---|
| `reports` | Báo cáo động. Job processor async qua queue report-jobs. |
| `dashboard` | KPI dashboard, dữ liệu realtime qua WebSocket. |
| `tracking` | Theo dõi đơn hàng realtime, cập nhật vị trí. |
| `automation` | Workflow automation, trigger theo event. |
| `batch` | Import/export Excel hàng loạt qua queue batch-jobs. |
| `search` | Full-text search (PostgreSQL trgm indexes). |
| `audit` | Audit log tự động cho mọi CRUD nhạy cảm. |
| `data-retention` | Chính sách lưu trữ và xóa dữ liệu cũ. |

### Workplace Modules (Phase 1 - 2026-03-08)

| Module | Mô tả |
|---|---|
| `chat` | Chat nội bộ, reactions, pin message, presence heartbeat. |
| `calendar` | Lịch họp, đặt phòng, free/busy. |
| `company-feed` | Bảng tin công ty, reactions, comments. |
| `drive` | Quản lý tài liệu, MinIO presigned upload flow. |
| `video` | Video meeting integration. |
| `wiki` | Knowledge base nội bộ. |

### CMS Modules

| Module | Mô tả |
|---|---|
| `cms-pages`, `cms-blog` | Quản lý trang tĩnh và bài viết website công ty. |
| `cms-media` | Upload và quản lý media files. |
| `cms-faq`, `cms-menu` | FAQ và menu navigation. |
| `cms-newsletter` | Quản lý email marketing. |

---

## 5. 9 FSM State Machines

Mỗi FSM được implement trong file `domain/{entity}.state-machine.ts`, kế thừa `BaseStatusMachine`. Mọi chuyển đổi trạng thái phải đi qua FSM — **không được cập nhật status trực tiếp trong database mà bỏ qua validation**.

### FSM 1: Đơn hàng (Order)

Đây là FSM phức tạp nhất, có 2 nhánh tùy service type:

```
CONSULTING
  → QUOTATION
    → PENDING_DEPOSIT (bắt buộc với MHH)
    → SOURCING (VCT có thể skip PENDING_DEPOSIT)
      → WAREHOUSE_CN
        → PACKING
          → CONSOLIDATION
            → IN_TRANSIT
              → CUSTOMS
                → WAREHOUSE_VN
                  → DELIVERING
                    → SETTLEMENT
                      → COMPLETED

Trạng thái đặc biệt (có thể vào từ hầu hết trạng thái):
  ON_HOLD, CANCELLED, RETURNED, ISSUE

Đặc biệt: COMPLETED → SETTLEMENT (reopen, chỉ BGĐ)
```

**File:** `src/modules/order/domain/order-status.machine.ts`

**Quy tắc MHH quan trọng:** Đơn MHH PHẢI đi qua `PENDING_DEPOSIT` trước `SOURCING`. Hệ thống sẽ block nếu cố bypass.

### FSM 2: Đơn NCC (Supplier Order)

```
DRAFT → QUOTED → ORDERED → CONFIRMED
  → PARTIALLY_SHIPPED → SHIPPED_CN → RECEIVED_CN

Nhánh lỗi: RETURN_IN_PROGRESS → REFUNDED
Trạng thái đặc biệt: ISSUE, CANCELLED
```

**File:** `src/modules/supplier-order/domain/`

### FSM 3: Container

```
PLANNING → LOADING → IN_TRANSIT → ARRIVED → CUSTOMS → COMPLETED

Trạng thái hold: ON_HOLD_BORDER, CUSTOMS_HOLD
```

**File:** `src/modules/container/domain/`

### FSM 4: Báo giá (Quotation)

```
DRAFT → PENDING_APPROVAL → APPROVED → CONVERTED hoặc EXPIRED
                         → REJECTED → DRAFT (quay lại chỉnh sửa)
```

**File:** `src/modules/quotation/domain/`

### FSM 5: Khiếu nại (Complaint)

```
OPEN → INVESTIGATING → PENDING_RESOLUTION → RESOLVED → CLOSED
```

SLA monitoring tự động gắn với mỗi trạng thái.

**File:** `src/common/services/sla-monitor.service.ts`

### FSM 6: Phiếu thu/chi (Payment Voucher)

```
PENDING → APPROVED (tài chính xác nhận)
        → REJECTED (từ chối)

Từ APPROVED: CANCELLED, RETURNED, WITHDRAWN (chỉ các role đặc biệt)
```

**File:** `src/modules/cash/domain/payment-voucher.validator.ts`

### FSM 7: Kho Trung Quốc (Warehouse CN)

```
RECEIVED → CHECKED → PACKED → SHIPPED
```

Mỗi bước yêu cầu scan QR và upload ảnh.

**File:** `src/modules/warehouse-cn/domain/`

### FSM 8: Kho Việt Nam (Warehouse VN)

```
RECEIVED → SORTED → READY → DELIVERED
```

**File:** `src/modules/warehouse-vn/domain/`

### FSM 9: Thông quan (Customs Declaration)

```
DRAFT → READY → SUBMITTED → CHANNEL_ASSIGNED → INSPECTING → CLEARED

Trạng thái lỗi: REJECTED → DRAFT (nộp lại)
              CANCELLED
```

**File:** `src/modules/customs-declaration/domain/`

---

## 6. 22 Roles và RBAC

### Phân nhóm role

```typescript
// src/core/rbac/roles.enum.ts

EXECUTIVE_ROLES   = [CEO, COO, CFO, DIRECTOR_OPERATIONS]
SALES_ROLES       = [SALES_DIRECTOR, SALES_LEADER, SALE, HR_MANAGER]
FINANCE_ROLES     = [CHIEF_ACCOUNTANT, ACCOUNTANT, ACCOUNTANT_AR, ACCOUNTANT_COST]
WAREHOUSE_ROLES   = [WAREHOUSE_MANAGER, WAREHOUSE_CN_AGENT, WAREHOUSE_VN_MANAGER, WAREHOUSE_VN_STAFF]
XNK_ROLES         = [XNK_MANAGER, XNK_STAFF]
LOGISTICS_ROLES   = [LOGISTICS_MANAGER, DRIVER]
MARKETING_ROLES   = [MARKETING_STAFF, CSKH]
```

### Bảng 22 Roles

| Role | Tiếng Việt | Phạm vi dữ liệu |
|---|---|---|
| CEO | Tổng Giám đốc | Toàn bộ hệ thống |
| COO | Giám đốc Điều hành | Toàn bộ hệ thống |
| CFO | Giám đốc Tài chính | Toàn bộ + tài chính |
| DIRECTOR_OPERATIONS | Giám đốc Vận hành | Toàn bộ vận hành |
| SALES_DIRECTOR | Giám đốc Kinh doanh | Toàn bộ sales |
| SALES_LEADER | Trưởng nhóm Kinh doanh | Team của mình |
| SALE | Nhân viên Kinh doanh | Đơn hàng của mình |
| MARKETING_STAFF | Nhân viên Marketing | CMS, leads |
| CSKH | Chăm sóc Khách hàng | Tickets, complaint |
| CHIEF_ACCOUNTANT | Kế toán Trưởng | Toàn bộ tài chính |
| ACCOUNTANT | Kế toán viên | Ghi chép phát sinh |
| ACCOUNTANT_AR | Kế toán Thanh toán | AR, phiếu thu |
| ACCOUNTANT_COST | Kế toán Chi phí | Chi phí vận hành |
| HR_MANAGER | Trưởng phòng Nhân sự | HR + employee data |
| LOGISTICS_MANAGER | Trưởng phòng Vận hành | Fleet, delivery |
| XNK_MANAGER | Trưởng phòng XNK | Customs, container |
| XNK_STAFF | Nhân viên XNK | Customs declaration |
| WAREHOUSE_MANAGER | Trưởng phòng Kho | Cả 2 kho |
| WAREHOUSE_CN_AGENT | Agent kho Trung Quốc | Kho TQ |
| WAREHOUSE_VN_MANAGER | Trưởng kho Việt Nam | Kho VN |
| WAREHOUSE_VN_STAFF | Nhân viên kho Việt Nam | Kho VN |
| DRIVER | Tài xế | Delivery của mình |

### Cách RBAC hoạt động

Hệ thống dùng **CASL** kết hợp với **DataScopeService**:

**Bước 1 — Action-level guard (CASL):**
```typescript
// Controller dùng decorator
@Roles(UserRole.SALE, UserRole.SALES_LEADER)
@UseGuards(JwtAuthGuard, RolesGuard)
@Get(':id')
findOne(@Param('id') id: string) {}
```

**Bước 2 — Data-scope filter (DataScopeService):**
```typescript
// Service áp dụng filter theo role
const scopeFilter = await this.dataScopeService.getDataScopeFilter(user, 'order');
// SALE: { saleId: user.id }
// SALES_LEADER: { sale: { leadId: user.id } }
// EXECUTIVE/DIRECTOR: {} (không filter)

return this.prisma.order.findMany({ where: { ...scopeFilter, ...queryFilter } });
```

**Bước 3 — Field-level encryption:** Các trường nhạy cảm (số CMND, tài khoản ngân hàng) được mã hóa tự động qua `EncryptionService` trước khi lưu DB.

**Ability caching:** CASL ability của mỗi user được cache Redis 5 phút để giảm tải DB.

---

## 7. Coding conventions

### Commit format

```
<type>(<module>): <description>

type: feat | fix | refactor | test | docs | chore | perf
module: order | finance | warehouse | crm | auth | ...

Ví dụ:
feat(order): add deposit auto-cancel after 3 days
fix(crm): BUG-234 customer tier not updated on payment
test(auth): add verifyLoginOtp unit tests
docs(onboarding): add developer setup guide
```

**Quy tắc quan trọng:**
- Mỗi bug fix = 1 commit riêng: `fix(module): BUG-ID mô tả`
- KHÔNG kết hợp fix bug với refactor trong cùng commit
- KHÔNG thay đổi DB schema khi fix bug

### Error handling — DomainException

Tất cả lỗi business logic phải dùng `DomainException` thay vì `HttpException` trực tiếp:

```typescript
import { DomainException } from '@common/exceptions';
import { ErrorCode } from '@common/exceptions/error-codes';
import { HttpStatus } from '@nestjs/common';

// Dùng ErrorCode có sẵn
throw new DomainException(
  ErrorCode.ORDER_NOT_FOUND,
  `Order #${orderId} not found`,
  HttpStatus.NOT_FOUND,
);

// Thêm ErrorCode mới vào src/common/exceptions/error-codes.ts
export const ErrorCode = {
  // ...existing codes...
  QUOTATION_EXPIRED: 'QUOTATION_EXPIRED',
};
```

Response format chuẩn (được global exception filter tự động tạo):
```json
{
  "errorCode": "ORDER_NOT_FOUND",
  "message": "Order #123 not found",
  "statusCode": 404,
  "timestamp": "2026-03-20T08:00:00.000Z",
  "path": "/api/v1/orders/123"
}
```

### Validation — class-validator DTOs

```typescript
import { IsString, IsNotEmpty, IsOptional, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class CreateOrderDto {
  @ApiProperty({ example: 'KH-001' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiProperty({ minimum: 1 })
  @Min(1)
  totalItems: number;
}
```

`ValidationPipe` được apply globally với `whitelist: true` và `forbidNonWhitelisted: true`.

### Testing pattern — Manual service instantiation

Không dùng `Test.createTestingModule` với full DI. Thay vào đó mock trực tiếp:

```typescript
describe('OrderService', () => {
  let service: OrderService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockEventPublisher: jest.Mocked<EventPublisherService>;

  beforeEach(() => {
    mockPrisma = {
      order: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as any;

    service = new OrderService(mockPrisma, mockEventPublisher);
  });

  it('should throw NOT_FOUND when order does not exist', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);
    await expect(service.findOne('unknown-id', mockUser))
      .rejects.toThrow(DomainException);
  });
});
```

### Prisma queries — Best practices

```typescript
// Dung: select chi fields cần thiết
const order = await this.prisma.order.findUnique({
  where: { id: orderId },
  select: { id: true, status: true, customerId: true },
});

// Tranh: select * khi không cần
const order = await this.prisma.order.findUnique({ where: { id: orderId } });

// Dung: transaction cho write operations liên quan
await this.prisma.$transaction(async (tx) => {
  await tx.order.update({ where: { id }, data: { status: newStatus } });
  await tx.auditLog.create({ data: { action: 'STATUS_CHANGE', entityId: id } });
});

// Dung: soft delete
await this.prisma.order.update({
  where: { id },
  data: { deletedAt: new Date() },
});
```

### Logging — Structured logging

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  async processOrder(orderId: string) {
    this.logger.log(`Processing order`, { orderId });
    try {
      // ...logic...
    } catch (error) {
      this.logger.error(`Failed to process order`, { orderId, error: error.message });
      throw error;
    }
  }
}
```

---

## 8. Chạy tests

### Unit tests

```bash
cd tbs-erp-backend

# Chạy tất cả unit tests (không tính coverage)
npx jest --no-coverage --forceExit

# Chạy test của một file cụ thể
npx jest --testPathPattern="auth.service.spec" --no-coverage --forceExit

# Chạy test của một module
npx jest --testPathPattern="modules/order" --no-coverage --forceExit

# Chạy với watch mode (khi đang phát triển)
npx jest --watch

# Xem coverage report
npx jest --coverage
```

### Integration tests

Integration tests yêu cầu database thật (dùng test database riêng biệt):

```bash
# Chạy tất cả integration tests
npx jest --config jest.config.js --testPathPattern=test/integration --runInBand --forceExit

# Hoặc dùng npm script
npm run test:integration
```

### Test files quan trọng cần tham khảo

```
src/core/auth/auth.service.spec.ts         # Auth flow, 2FA, refresh token
src/modules/order/order.service.spec.ts    # Order creation, state changes
src/modules/order/order-status.service.spec.ts
src/modules/order/order-cancellation.service.spec.ts
src/modules/order/domain/order-status.machine.spec.ts  # FSM transitions
src/modules/order/domain/deposit-gate.service.spec.ts  # Deposit validation
src/modules/general-ledger/general-ledger.service.spec.ts
```

### Load tests

```bash
# Yêu cầu k6 (https://k6.io/docs/get-started/installation/)
npm run test:load
```

---

## 9. Common tasks

### Thêm endpoint mới

1. **Tạo DTO** trong `src/modules/{mod}/dto/`:
```typescript
// create-widget.dto.ts
export class CreateWidgetDto {
  @IsString() @IsNotEmpty()
  name: string;
}
```

2. **Thêm method vào Service:**
```typescript
// widget.service.ts
async create(dto: CreateWidgetDto, user: AuthUser): Promise<Widget> {
  // validate → business logic → prisma.create → publish event
}
```

3. **Thêm endpoint vào Controller:**
```typescript
// widget.controller.ts
@Post()
@Roles(UserRole.SALE, UserRole.SALES_LEADER)
@ApiOperation({ summary: 'Tạo widget mới' })
@ApiCreatedResponse({ type: WidgetEntity })
async create(
  @Body() dto: CreateWidgetDto,
  @CurrentUser() user: AuthUser,
) {
  return this.widgetService.create(dto, user);
}
```

4. **Viết unit test** cho service method.

5. **Kiểm tra Swagger** tại `http://localhost:3001/api/v1/docs`.

### Thêm module mới

1. Tạo thư mục `src/modules/{new-module}/`
2. Tạo các file theo chuẩn: `.module.ts`, `.service.ts`, `.controller.ts`, `dto/`
3. Đăng ký vào `AppModule` trong `src/app.module.ts`
4. Thêm Prisma schema nếu cần (file mới trong `prisma/schema/`) và chạy `npx prisma generate`
5. Tạo migration: `npx prisma migrate dev --name add_{new_module}`

### Thêm FSM transition mới

1. Cập nhật `TRANSITION_MAP` trong `src/common/constants/order-transitions.ts` (hoặc file constants tương ứng)
2. Thêm business rule validation trong `{entity}-status.machine.ts`
3. Cập nhật endpoint `PATCH /{entity}/:id/status` trong controller
4. Viết test cho transition mới
5. **Không thay đổi DB schema khi chỉ thêm transition** — status được lưu dạng enum, chỉ cần thêm enum value nếu cần trạng thái mới

### Fix bug (5-bước workflow)

Tuân thủ nghiêm ngặt quy trình sau (từ CLAUDE.md):

**Bước 1 — Tái hiện bug:**
Viết failing test trước khi sửa bất kỳ dòng code nào.

**Bước 2 — Xác định root cause:**
Đọc stack trace, tìm đúng file và dòng code gây lỗi.

**Bước 3 — Sửa nhỏ nhất có thể:**
Chỉ sửa đủ để fix bug. Không refactor. Không thay đổi API contract. Không thay đổi DB schema.

**Bước 4 — Verify:**
Chạy lại failing test (phải pass). Chạy toàn bộ test suite (`npx jest --no-coverage --forceExit`).

**Bước 5 — Commit riêng:**
```bash
git commit -m "fix(order): BUG-123 deposit not validated for MHH orders"
```

### Thêm màn hình frontend mới

1. Tạo route: `src/app/(dashboard)/{route}/page.tsx`
2. Tạo API client: `src/lib/api/{mod}.api.ts`
3. Tạo hook: `src/lib/hooks/use-{mod}.ts`
4. Dùng `DataTable` từ `src/components/shared/data-table.tsx` cho list views
5. Dùng `FormSkeleton` cho loading states

---

## 10. Resources

### Tài liệu trong codebase

| File | Nội dung |
|---|---|
| `CLAUDE.md` | Quy tắc tuyệt đối, conventions, 9 FSM, 22 roles |
| `docs/DEVELOPER_GUIDE.md` | Hướng dẫn kỹ thuật chi tiết |
| `docs/RUNBOOKS.md` | Runbooks vận hành (restart service, rollback, incidents) |
| `docs/SYSTEM_DOCUMENTATION.md` | Tài liệu hệ thống đầy đủ |
| `docs/QUICK_START.md` | Quick start cho deployment |
| `docs/DOCKER_DEPLOYMENT_GUIDE.md` | Hướng dẫn deploy Docker |
| `docs/OBSERVABILITY.md` | Metrics, tracing, logging setup |
| `docs/TEST_STRATEGY.md` | Chiến lược test toàn dự án |
| `docs/CI_CD_SECRETS.md` | Quản lý secrets trong CI/CD |
| `docs/TBS_QuyTrinh_NghiepVu_DayDu.md` | Quy trình nghiệp vụ đầy đủ |

### Tools hữu ích khi phát triển

| Tool | URL | Mục đích |
|---|---|---|
| Swagger UI | `http://localhost:3001/api/v1/docs` | Khám phá và test API |
| Prisma Studio | `http://localhost:5555` | Xem/sửa database trực quan |
| Bull Board | `http://localhost:3001/api/v1/queues` | Theo dõi job queues |
| MinIO Console | `http://localhost:9001` | Quản lý file storage |

### Contacts và quy trình

- **Code review:** Tạo Pull Request, cần ít nhất 1 approval trước khi merge
- **Branch strategy:** Feature branch từ `main`, merge qua PR
- **Branch review:** Tên `review/codebase-fixes-YYYY-MM-DD` cho review session
- **Incident:** Xem `docs/RUNBOOKS.md` để biết quy trình xử lý

---

> Tài liệu này cần được cập nhật khi có thay đổi lớn về kiến trúc hoặc conventions. Cập nhật trong cùng PR với code changes theo nguyên tắc "docs as living assets".
