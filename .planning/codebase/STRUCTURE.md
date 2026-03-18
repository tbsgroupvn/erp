# Codebase Structure

**Analysis Date:** 2026-03-18

## Directory Layout

```
D:\ERPv1 (project root)
├── tbs-erp-backend/              # NestJS backend server
│   ├── src/
│   │   ├── main.ts               # Bootstrap entry point
│   │   ├── app.module.ts         # Root module with all imports
│   │   ├── core/                 # Infrastructure/shared services
│   │   ├── common/               # Shared utilities, guards, filters
│   │   ├── config/               # Configuration (env validation, JWT, DB, etc.)
│   │   ├── modules/              # Business domain modules (60+ modules)
│   │   └── types/                # Global TypeScript types
│   ├── prisma/
│   │   ├── schema/               # 35 .prisma files (data models by domain)
│   │   ├── migrations/           # Database schema version history
│   │   └── seed/                 # Seed scripts for test data
│   ├── test/                     # Test suites (unit, integration, e2e, load)
│   ├── dist/                     # Compiled output (npm run build)
│   ├── package.json              # NestJS 11, Prisma 6.3, Node 18+
│   └── tsconfig.json             # TypeScript config with path aliases
│
├── tbs-erp-frontend/             # Next.js 14 ERP dashboard
│   ├── src/
│   │   ├── app/                  # Next.js App Router pages
│   │   │   ├── (auth)/           # Login page group
│   │   │   ├── (dashboard)/      # Main ERP routes (40+ pages)
│   │   │   ├── (blog-admin)/     # Blog editor pages
│   │   │   ├── (public)/         # Public site pages (FAQ, About, News)
│   │   │   ├── layout.tsx        # Root layout (providers, fonts)
│   │   │   ├── globals.css       # Tailwind, theme variables
│   │   │   └── 403/              # Error pages
│   │   ├── lib/
│   │   │   ├── api/              # Axios-based API clients (70+ .api.ts files)
│   │   │   ├── hooks/            # React Query + custom hooks (50+ use-*.ts files)
│   │   │   ├── stores/           # Zustand state (auth, notifications)
│   │   │   ├── utils/            # Utilities (date, numbers, sanitizers, a11y)
│   │   │   ├── config/           # Branding, constants
│   │   │   ├── types/            # TypeScript types (enums, DTO mirrors)
│   │   │   ├── offline/          # Offline mutation queue
│   │   │   └── providers/        # React context providers
│   │   ├── components/
│   │   │   ├── shared/           # Reusable components (data-table, forms, etc.)
│   │   │   ├── ui/               # shadcn/ui components (buttons, dialogs, etc.)
│   │   │   ├── cms/              # CMS-specific components (editor, media picker)
│   │   │   ├── finance/          # Finance dashboard components
│   │   │   └── sales/            # Sales dashboard components
│   │   ├── features/             # Feature-specific components (unused pattern, prefer feature folders in app/)
│   │   ├── services/             # Deprecated (use lib/api/ instead)
│   │   ├── test/                 # Test factories, mocks
│   │   └── middleware.ts         # Next.js middleware (auth redirect)
│   ├── e2e/                      # Playwright E2E tests (POM architecture)
│   ├── public/                   # Static assets, manifest.json, icons
│   ├── package.json              # Next.js 14, React 18, TanStack Query, Zustand
│   ├── tsconfig.json             # TypeScript config with @ path alias
│   └── playwright.config.ts      # E2E test configuration
│
├── tbs-cms-frontend/             # Next.js 14 CMS dashboard (separate from ERP)
│   └── src/                      # Same structure as tbs-erp-frontend
│
├── .planning/codebase/           # GSD documentation
│   ├── ARCHITECTURE.md           # Layer architecture, FSM, data flow
│   ├── STRUCTURE.md              # This file
│   ├── CONVENTIONS.md            # Code style, naming patterns
│   ├── TESTING.md                # Test organization, patterns
│   ├── STACK.md                  # Technology versions
│   ├── INTEGRATIONS.md           # External APIs, services
│   └── CONCERNS.md               # Technical debt, issues
│
├── .github/workflows/            # CI/CD pipeline (GitHub Actions)
├── docker-compose.yml            # Multi-container orchestration (prod)
├── docker-compose.dev.yml        # Dev environment setup
├── k8s/                          # Kubernetes manifests (ArgoCD for production)
├── nginx/                        # Nginx reverse proxy, WAF (ModSecurity)
├── monitoring/                   # Prometheus, Grafana, ELK stack configs
└── docs/                         # Business process, design, PRD docs
```

## Directory Purposes

**Backend Core (`tbs-erp-backend/src/core/`):**
- Purpose: Infrastructure and shared services
- Contains: Database, Auth, Cache, Queue, Events, Metrics, WebSocket, Logger, Email
- Key files:
  - `database/prisma.service.ts`: ORM wrapper with encryption extensions
  - `auth/auth.service.ts`: JWT strategy, token generation, 2FA
  - `cache/cache.service.ts`: Redis wrapper with TTL management
  - `queue/queue.module.ts`: BullMQ job queue setup
  - `websocket/ws.gateway.ts`: Socket.io real-time updates
  - `metrics/metrics.service.ts`: Prometheus instrumentation

**Backend Common (`tbs-erp-backend/src/common/`):**
- Purpose: Shared utilities, middleware, guards, decorators
- Contains: Guards (roles, data scope), Filters (exception handling), Interceptors (logging, metrics, audit), Pipes, Decorators, Utils, Constants
- Key files:
  - `guards/roles.guard.ts`: RBAC enforcement
  - `guards/data-scope.guard.ts`: Row-level access control
  - `filters/http-exception.filter.ts`: Transform exceptions to API response
  - `interceptors/audit-log.interceptor.ts`: Log all CRUD operations
  - `constants/index.ts`: Order status transitions, roles, business rules

**Business Modules (`tbs-erp-backend/src/modules/`):**
- Pattern: Each module is a directory with standardized structure:
  - `[module].module.ts`: Module imports/exports
  - `[module].controller.ts`: HTTP routes
  - `[module].service.ts`: Business logic
  - `[module].repository.ts`: Database queries
  - `domain/`: Domain-specific services (FSMs, validators, calculators)
  - `listeners/`: Event handlers
  - `dto/`: Request/response DTOs
- Major modules:
  - **order/**: Order lifecycle, 9-status FSM, deposits, returns
  - **container/**: Container tracking, customs, consolidation
  - **warehouse-cn/**: China warehouse operations
  - **warehouse-vn/**: Vietnam warehouse operations
  - **quotation/**: Quote management, conversion to orders
  - **crm/**: Customer relationship management
  - **accounts-receivable/**: AR aging, collections
  - **accounts-payable/**: AP management, payment tracking
  - **cash/**: Payment vouchers, bank reconciliation
  - **approval/**: Approval workflows, delegation, templates
  - **notification/**: SMS, email, WebSocket notifications
  - **ai-assistant/**: Claude API integration, OCR for documents
  - **integration/**: 3rd-party API connectors (shipping, banking, customs, LarkSuite)

**Frontend Pages (`tbs-erp-frontend/src/app/`):**
- Pattern: Next.js App Router with route groups (parentheses) for layout organization
- **(dashboard)/** — Main ERP pages:
  - `don-hang/` — Order management (create, list, detail, excel import)
  - `kho-trung-quoc/` — China warehouse
  - `kho-viet-nam/` — Vietnam warehouse
  - `giao-hang/` — Delivery tracking
  - `tai-chinh/` — Finance (AR, AP, invoices, cash, aging reports)
  - `kho-hang/` — Inventory
  - `khiếu-nại/` — Complaints
  - `khách-hàng/` — CRM
  - `cham-cong/` — Attendance
  - `nhan-su/` — HR
  - `bao-gia/` — Quotations
  - `hop-dong/` — Contracts
  - `thong-quan/` — Customs declarations
  - `bang-tin/` — Company feed
  - `lich/` — Calendar
  - `tai-lieu/` — Drive
  - `tro-chuyen/` — Chat
  - `cai-dat/` — Settings (approvals, rate cards, emoji, security)
  - `ai-chat/` — AI assistant
- **(public)/** — Customer-facing pages:
  - `dang-ky/` — Sign up
  - `hoi-dap/` — FAQ
  - `so-sanh/` — Compare plans
  - `tin-tuc/` — Blog
  - `lien-he/` — Contact
- **(auth)/** — Authentication:
  - `login/` — Login page
- **(blog-admin)/** — Blog editor:
  - `bai-viet/` — Blog post management

**Frontend APIs (`tbs-erp-frontend/src/lib/api/`):**
- Pattern: One `.api.ts` file per backend module
- Examples: `orders.api.ts`, `customers.api.ts`, `approvals.api.ts`
- Pattern: Each exports named functions (`list()`, `getById()`, `create()`, `update()`, `delete()`) that call backend via Axios

**Frontend Hooks (`tbs-erp-frontend/src/lib/hooks/`):**
- Pattern: One `use-[module].ts` per domain module
- Examples: `use-orders.ts`, `use-customers.ts`, `use-approvals.ts`
- Pattern: Define React Query key factory, wrap API calls in `useQuery()` and `useMutation()`, return results with loading/error states

## Key File Locations

**Entry Points:**

**Backend:**
- `tbs-erp-backend/src/main.ts`: Node.js entry point, initializes NestJS app, configures middleware, starts listening

**Frontend:**
- `tbs-erp-frontend/src/app/layout.tsx`: Next.js root layout, wraps all pages with providers
- `tbs-erp-frontend/src/app/(dashboard)/layout.tsx`: Dashboard layout with sidebar, header, breadcrumbs

**Configuration:**

**Backend:**
- `tbs-erp-backend/.env.example` — Environment variable template
- `tbs-erp-backend/src/config/env.validation.ts` — Joi schema for env vars
- `tbs-erp-backend/src/config/app.config.ts` — App name, port, CORS
- `tbs-erp-backend/src/config/database.config.ts` — PostgreSQL connection, pool size
- `tbs-erp-backend/src/config/jwt.config.ts` — JWT secret, expiry durations
- `tbs-erp-backend/src/config/redis.config.ts` — Redis connection, cache TTLs

**Frontend:**
- `tbs-erp-frontend/.env.local` — Runtime variables (API URL, branding)
- `tbs-erp-frontend/src/lib/config/branding.ts` — App title, logo, colors, cookie names
- `tbs-erp-frontend/tsconfig.json` — Path alias `@/*` → `src/`
- `tbs-erp-frontend/next.config.js` — PWA plugin, image optimization

**Core Logic:**

**Order workflow:**
- `tbs-erp-backend/src/modules/order/order.service.ts` — Create, update, status change
- `tbs-erp-backend/src/modules/order/domain/order-status.machine.ts` — FSM with 13 statuses
- `tbs-erp-backend/src/modules/order/domain/deposit-gate.service.ts` — Calculate required deposit
- `tbs-erp-backend/src/modules/order/domain/penalty-calculator.service.ts` — Late delivery penalties

**Finance workflow:**
- `tbs-erp-backend/src/modules/accounts-receivable/ar-aging-calculator.service.ts` — AR aging report
- `tbs-erp-backend/src/modules/cash/cash.service.ts` — Payment voucher creation/approval
- `tbs-erp-backend/src/modules/operation-cost/operation-cost.service.ts` — Cost allocation to orders

**Warehouse operations:**
- `tbs-erp-backend/src/modules/warehouse-cn/warehouse-cn.service.ts` — CN warehouse status, packing
- `tbs-erp-backend/src/modules/warehouse-vn/warehouse-vn.service.ts` — VN warehouse delivery coordination
- `tbs-erp-backend/src/modules/container/container.service.ts` — Container consolidation, customs

**Frontend API integration:**
- `tbs-erp-frontend/src/lib/api/client.ts` — Axios instance with auth interceptors, token refresh
- `tbs-erp-frontend/src/lib/api/orders.api.ts` — Order CRUD endpoints
- `tbs-erp-frontend/src/lib/api/approvals.api.ts` — Approval workflow endpoints

**Testing:**

**Backend:**
- `tbs-erp-backend/test/factories/` — Jest factories for creating test data (orders, customers, etc.)
- `tbs-erp-backend/test/integration/` — Integration tests (database + service layer)
- `tbs-erp-backend/test/load/` — k6 load testing scenarios
- `tbs-erp-backend/src/modules/order/domain/order-status.machine.spec.ts` — Unit tests for FSM

**Frontend:**
- `tbs-erp-frontend/e2e/` — Playwright E2E tests with Page Object Model architecture
- `tbs-erp-frontend/e2e/pages/` — Page classes (selectors, actions)
- `tbs-erp-frontend/e2e/auth/` — Authentication flow tests
- `tbs-erp-frontend/src/test/` — Test utilities, mocks

## Naming Conventions

**Files:**

- **Modules**: kebab-case, plural when plural
  - `order.service.ts` (Order business logic)
  - `order.controller.ts` (Order HTTP routes)
  - `order.repository.ts` (Order database queries)
  - `order.module.ts` (Order module definition)
- **DTOs**: PascalCase + `Dto` suffix
  - `CreateOrderDto`, `UpdateOrderDto`, `OrderQueryDto`
- **Domain services**: kebab-case + `.service.ts`
  - `deposit-gate.service.ts`, `penalty-calculator.service.ts`
- **Listeners**: kebab-case + `.listener.ts`
  - `order-created.listener.ts`, `warehouse-updated.listener.ts`
- **State machines**: kebab-case + `-status.machine.ts`
  - `order-status.machine.ts`, `container-status.machine.ts`
- **Frontend pages**: kebab-case route segments
  - `don-hang/page.tsx`, `kho-trung-quoc/[id]/page.tsx`
- **Frontend hooks**: camelCase + `use-` prefix
  - `use-orders.ts`, `use-customers.ts`, `use-approval-flows.ts`
- **Frontend APIs**: kebab-case + `.api.ts`
  - `orders.api.ts`, `approvals.api.ts`
- **Components**: PascalCase
  - `OrderForm.tsx`, `CustomerPicker.tsx`, `DataTable.tsx`
- **Utils**: camelCase + `.util.ts` or `.ts`
  - `date.util.ts`, `code-generator.util.ts`, `sanitize-html.ts`

**Directories:**

- **Business domains**: kebab-case (plural when multiple entities)
  - `order/`, `quotation/`, `warehouse-cn/`, `accounts-receivable/`
- **Cross-cutting layers**: lowercase
  - `core/`, `common/`, `config/`, `types/`
- **Route groups** (Next.js): parentheses for layout organization
  - `(dashboard)/`, `(auth)/`, `(blog-admin)/`, `(public)/`

**TypeScript:**

- **Enums**: PascalCase, singular or plural (UPPER_SNAKE_CASE members)
  ```typescript
  enum OrderStatus { CONSULTING, QUOTATION, PENDING_DEPOSIT, ... }
  enum UserRole { CEO, SALE, ACCOUNTANT, ... }
  ```
- **Interfaces**: PascalCase, `I` prefix for Prisma-external types
  ```typescript
  interface ICurrentUser { id: string; role: UserRole; ... }
  interface OrderWithRelations extends Order { customer: ...; items: ...; }
  ```
- **Types**: PascalCase
  ```typescript
  type DataScopeFilter = { saleId?: string; isGlobal: boolean; ... }
  ```
- **Functions**: camelCase
  ```typescript
  function hashQueryParams(params) { ... }
  async function createOrder(dto, user) { ... }
  ```
- **Classes**: PascalCase
  ```typescript
  class OrderService { ... }
  class OrderRepository { ... }
  ```
- **Constants**: UPPER_SNAKE_CASE
  ```typescript
  const ORDER_LIST_CACHE_TTL_MS = 2 * 60 * 1000;
  const TERMINAL_STATUSES = [OrderStatus.COMPLETED, ...];
  ```

## Where to Add New Code

**New Feature (e.g., "Loyalty Points"):**

1. **Backend:**
   - Create `src/modules/loyalty/` directory
   - `loyalty.module.ts` — Define module
   - `loyalty.controller.ts` — HTTP routes
   - `loyalty.service.ts` — Business logic
   - `loyalty.repository.ts` — Database queries
   - `domain/` — Subdirectory for domain services if complex
   - `listeners/` — Event handlers (e.g., respond to order completed)
   - `dto/` — Request/response DTOs
   - `loyalty.module.ts` — Register in `app.module.ts`

2. **Database:**
   - Create `prisma/schema/loyalty.prisma`
   - Define `LoyaltyProgram`, `LoyaltyBalance`, `LoyaltyTransaction` models
   - Add to `prisma/schema/schema.prisma` via `import`
   - Run `npm run prisma:migrate` to create migration

3. **Frontend:**
   - Create `src/lib/api/loyalty.api.ts` with list/get/create/update functions
   - Create `src/lib/hooks/use-loyalty.ts` with React Query hooks
   - Create `src/app/(dashboard)/khach-hang/loyalty-points/page.tsx` as main page
   - Create components in `src/components/loyalty/` (e.g., LoyaltyBalance, TransactionHistory)

**New Component (UI reusable):**

1. Create file: `src/components/shared/[ComponentName].tsx`
2. Export from: `src/components/shared/index.ts`
3. If from shadcn: `npx shadcn-ui@latest add [component-name]`
4. Use in pages: `import { ComponentName } from '@/components/shared'`

**New Utility Function:**

1. **Backend:** Place in `src/common/utils/[domain].util.ts` or `src/modules/[module]/utils/`
2. **Frontend:** Place in `src/lib/utils/[domain].ts`
3. Export and reuse across codebase

**New Guard/Decorator (Backend):**

1. **Guard:** Create in `src/common/guards/[name].guard.ts`, implement `CanActivate`
2. **Decorator:** Create in `src/core/rbac/decorators/[name].decorator.ts`
3. Register in `app.module.ts` if global, or apply via `@UseGuards()` in controller

## Special Directories

**Prisma Migrations (`tbs-erp-backend/prisma/migrations/`):**
- Purpose: Database schema version history
- Generated: Automatically by `npm run prisma:migrate`
- Committed: Yes, to git
- Do NOT manually edit; always create new migrations

**Uploads (`tbs-erp-backend/uploads/`):**
- Purpose: Local file storage for blog images, thumbnails (deprecated in favor of MinIO S3)
- Generated: Created by file upload endpoints
- Committed: No, `.gitignore`
- Cleanup: Set data retention policy

**Public Assets (`tbs-erp-frontend/public/`):**
- Purpose: Static files (manifest.json, icons, robots.txt)
- Generated: No
- Committed: Yes
- Critical files:
  - `manifest.json` — PWA manifest (update icon paths if adding icons)
  - `icons/icon-192.png`, `icon-512.png` — PWA icons

**Build Output:**

**Backend:**
- `tbs-erp-backend/dist/` — Compiled JavaScript
- Generated: By `npm run build` (nest build)
- Committed: No, `.gitignore`
- Entry: `dist/src/main.js` (not `dist/main.js` due to tsconfig baseUrl)

**Frontend:**
- `tbs-erp-frontend/.next/` — Next.js build cache and compiled routes
- Generated: By `npm run build`
- Committed: No, `.gitignore`

---

*Structure analysis: 2026-03-18*
