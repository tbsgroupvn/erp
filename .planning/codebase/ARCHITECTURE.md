# Architecture

**Analysis Date:** 2026-03-18

## Pattern Overview

**Overall:** Modular NestJS backend (TypeScript) + Next.js frontend (React) with layered, domain-driven design.

**Key Characteristics:**
- **Order-centric data model**: All business operations pivot around Order as the central entity. No orphaned data.
- **Finite State Machines (FSM)**: 9 blocking state machines enforce rigid lifecycle transitions for Orders, Containers, Quotations, Complaints, Payment Vouchers, Warehouses, and Customs declarations.
- **Event-driven async flow**: Domain events trigger async processors via BullMQ job queue. Finance allocations, notifications, and integrations respond to events.
- **RBAC + Data Scoping**: 22 role-based access controls combined with hierarchical data scopes (CEO sees all, Sales sees own customer data).
- **Repository pattern**: Database access abstraction via Service → Repository → Prisma layers ensures testability and separation of concerns.
- **Real vs. Declared**: Physical measurements (cnWeight, vnWeight) stored separately from billing/charged values. Soft deletes everywhere—no hard deletes.

## Layers

**Presentation Layer:**
- Purpose: HTTP endpoints, WebSocket gateways, file uploads
- Location: `src/modules/*/[module].controller.ts`, `src/core/websocket/ws.gateway.ts`
- Contains: NestJS `@Controller` classes, request/response DTOs, decorators for auth/roles
- Depends on: Services, Guards, Pipes
- Used by: HTTP clients (frontend, mobile, external integrations)

**Application Layer (Services):**
- Purpose: Business logic orchestration, transactions, event emission
- Location: `src/modules/*/[module].service.ts`
- Contains: Core business logic, service composition, transaction handling
- Depends on: Repositories, Domain services, Event emitters, External service integrations
- Used by: Controllers, Event listeners, Other services

**Domain Layer:**
- Purpose: Pure business rules, state machines, domain calculations
- Location: `src/modules/*/domain/*.service.ts`, `src/common/domain/base-status-machine.ts`
- Contains: FSMs (`order-status.machine.ts`, `container-status.machine.ts`), validators, calculators
- Depends on: Constants, Enums, No persistence layer
- Used by: Application services, Validators

**Repository Layer (Data Access):**
- Purpose: Abstraction over Prisma ORM, query composition
- Location: `src/modules/*/[module].repository.ts`
- Contains: `find*()`, `create()`, `update()`, `delete()` methods with complex query logic
- Depends on: PrismaService, Type definitions
- Used by: Services

**Infrastructure Layer:**
- Purpose: Cross-cutting concerns, integrations, external APIs
- Location: `src/core/*`, `src/common/*`
- Contains:
  - **Auth**: JWT strategies, 2FA (TOTP), session management (`src/core/auth/`)
  - **Database**: Prisma wrapper with encryption extensions, read replicas (`src/core/database/`)
  - **Cache**: Redis-backed caching for hot data (`src/core/cache/`)
  - **Queue**: BullMQ job processor for async work (`src/core/queue/`)
  - **Events**: Event emitter bus for inter-module communication (`src/core/event-bus/`)
  - **Metrics**: Prometheus collectors, performance monitoring (`src/core/metrics/`)
  - **WebSocket**: Socket.io with Redis pub/sub for real-time updates (`src/core/websocket/`)
  - **Storage**: MinIO S3-compatible file storage wrapper (`src/core/storage/`)
  - **Logger**: ELK (Elasticsearch/Logstash/Kibana) structured logging (`src/core/logger/`)
  - **Email**: Nodemailer SMTP integration (`src/core/email/`)
- Depends on: External services (Redis, PostgreSQL, S3, etc.)
- Used by: All layers above

**Common Layer:**
- Purpose: Shared utilities, middleware, guards, decorators
- Location: `src/common/`
- Contains:
  - **Guards**: `RolesGuard`, `DataScopeGuard`, `JwtAuthGuard`
  - **Filters**: `HttpExceptionFilter`, `PrismaExceptionFilter`
  - **Interceptors**: `TransformInterceptor`, `LoggingInterceptor`, `MetricsInterceptor`, `AuditLogInterceptor`
  - **Pipes**: Validation pipes
  - **Decorators**: `@Roles()`, `@CurrentUser()`, `@DataScope()`
  - **Utils**: Code generators, date formatters, sanitizers
  - **Constants**: Enum maps, status transition tables, business rules
- Depends on: Core layer
- Used by: All modules

## Data Flow

**Order Creation Flow:**

1. Client submits `POST /api/v1/orders/create` with order details
2. `OrderController` receives request, applies `@Auth` + `@Roles(SALE, CSKH)` guards
3. `DataScopeGuard` attaches filter to request (limit to customer owned by user's sale team)
4. `OrderService.createOrder()` validates:
   - Customer exists and is accessible via data scope
   - Items and totals are valid
   - Deposit requirement calculated by `DepositGateService` based on customer tier + service type
5. Order record created with `status: CONSULTING`
6. `OrderStatusHistory` entry logged
7. `OrderCreatedEvent` emitted via `EventEmitter2`
8. `OrderCreatedListener` responds asynchronously:
   - Increment customer order count
   - Invalidate customer cache
   - Send notification to assigned account manager
9. Response returned to client with order ID

**Order Status Transition (FSM Blocking):**

1. User calls `PATCH /api/v1/orders/{id}/status` with `toStatus`
2. `OrderStatusMachine.validateTransition(from, to, serviceType)` checked
3. If MHH order and `from=QUOTATION` and `to=SOURCING`: deposit gate applies (reject if no approved deposit)
4. On valid transition:
   - Status updated
   - `OrderStatusHistory` record created with change metadata
   - `OrderStatusChangedEvent` emitted
5. Event triggers cascading updates:
   - Warehouse CN receives notification if `to=WAREHOUSE_CN`
   - Finance triggered if `to=SETTLEMENT` (start cost allocation)
   - Customer notified via SMS/email if terminal status (COMPLETED, CANCELLED, ISSUE)

**Finance Cost Allocation (Async Queue):**

1. Order moves to `SETTLEMENT` status → `OrderStatusChangedEvent` emitted
2. `OperationCostListener` catches event, enqueues `operation-cost-allocation` job
3. BullMQ processor (`report-job.processor.ts`) runs async:
   - Load all expenses tied to order (warehouse fees, shipping, handling)
   - Allocate to line items proportionally by weight or quantity
   - Create `OperationCostAllocation` records with audit trail
   - Emit `CostAllocationCompleteEvent`
4. Finance module listens and updates `GeneralLedger` entries
5. `InvoiceService` notified, generates invoice if enabled

**Real-time WebSocket Updates:**

1. Multiple backend instances subscribed to Socket.io Redis adapter
2. Any instance updates order (via HTTP) → `OrderUpdatedEvent` emitted
3. `WsGateway.handleOrderUpdate()` receives event, broadcasts to connected clients via Socket.io
4. Redis pub/sub ensures all backend instances forward update to their WebSocket clients
5. Frontend receives real-time update, invalidates React Query cache for that order

**State Management:**

**Backend:**
- Order state: Persisted in PostgreSQL via `Order` model with `status` field
- Cache: Redis caches hot order lists (2-minute TTL) and customer data
- Audit trail: Every CRUD operation logged to `AuditLog` table via `AuditLogInterceptor`
- Transactions: Prisma transaction wrapper ensures atomicity (all-or-nothing updates)

**Frontend:**
- User state: Zustand `useAuthStore` holds `{ user, accessToken, isAuthenticated }`
- Query cache: TanStack React Query caches API responses with staleTime hints per resource type
- Offline mutations: Fallback queue (`src/lib/offline/mutation-queue.ts`) stores writes when offline, syncs on reconnect
- WebSocket subscriptions: Socket.io client maintains persistent connection for real-time updates

## Key Abstractions

**Status Machine (FSM):**
- Purpose: Enforce valid state transitions for multi-stage entities
- Examples: `OrderStatusMachine`, `ContainerStatusMachine`, `QuotationStatusMachine`
- Pattern: Extends `BaseStatusMachine<T>`, overrides `validateTransition()` for domain-specific rules
- Location: `src/modules/*/domain/*-status.machine.ts`

**Repository Pattern:**
- Purpose: Encapsulate database queries, provide testable data access
- Examples: `OrderRepository`, `ContainerRepository`, `CustomerRepository`
- Pattern: Class with `find()`, `findUnique()`, `create()`, `update()` methods; composes Prisma queries
- Location: `src/modules/*/[module].repository.ts`

**Event System:**
- Purpose: Decouple modules via asynchronous pub/sub
- Pattern: Emit domain events (`OrderCreatedEvent`, `OrderStatusChangedEvent`); listeners respond in separate transactions
- Benefits: If listener fails (e.g., email fails), order creation still succeeds; listeners retry via Dead Letter Queue
- Location: Events emitted in services, listeners in `src/modules/*/listeners/*.listener.ts`

**Domain Service:**
- Purpose: Encapsulate complex business logic not tied to persistence
- Examples: `DepositGateService` (calculate required deposit), `PenaltyCalculatorService`, `MhhPriceCalculatorService`
- Pattern: Pure business rules, no database access, easily testable
- Location: `src/modules/*/domain/*.service.ts`

**Data Scope Guard:**
- Purpose: Row-level access control based on user role and organizational hierarchy
- Pattern: Inspects user role, builds filter object (`{ saleId, teamLeaderId, isGlobal, denied }`)
- Examples: Sales staff sees only own customers; Team leads see team's customers; CEO sees all
- Location: `src/common/guards/data-scope.guard.ts`

## Entry Points

**Backend HTTP:**
- Location: `src/main.ts`
- Triggers: Node.js process start, Docker container run
- Responsibilities:
  - Create NestJS app, apply global pipes/filters/interceptors
  - Register static assets (`/uploads`)
  - Setup Swagger docs
  - Configure CORS, helmet, compression
  - Initialize Redis WebSocket adapter
  - Listen on port 3000 (or env-configured)

**Frontend Next.js:**
- Location: `src/app/layout.tsx` (root layout)
- Triggers: Browser page request, Next.js server build
- Responsibilities:
  - Setup global providers (Auth, QueryClient, Theme, Toast)
  - Load fonts (Google Fonts: Inter, Poppins)
  - Setup PWA metadata
  - Apply Tailwind CSS

**Module Initialization:**
- Pattern: Each module file (e.g., `OrderModule`) imports controllers, services, repositories
- Example: `src/modules/order/order.module.ts` imports `OrderController`, `OrderService`, `OrderRepository`, `OrderStatusMachine`
- Modules organized by domain: Order, CRM, Finance, Logistics, HR, etc.

## Error Handling

**Strategy:** Layered exception handling—catch at source, propagate with context, transform at boundary.

**Patterns:**

1. **Domain/Service layer:**
   ```typescript
   if (!customer) {
     throw new NotFoundException(`Customer ${customerId} not found`);
   }
   ```

2. **Controller layer:**
   - Uses `@Catch(SomeException)` filters
   - `HttpExceptionFilter` transforms NestJS exceptions into consistent JSON format:
   ```json
   {
     "success": false,
     "statusCode": 404,
     "message": "Customer not found",
     "timestamp": "2026-03-18T10:30:00Z",
     "path": "/api/v1/orders/123"
   }
   ```

3. **Database layer:**
   - `PrismaExceptionFilter` catches Prisma-specific errors (unique constraint, foreign key, etc.)
   - Maps to appropriate HTTP status (409 for conflict, 400 for validation)

4. **Async (queue) layer:**
   - Failed jobs captured by BullMQ and stored in Dead Letter Queue
   - Retried up to 3 times with exponential backoff
   - If final failure, logged to `JobFailureLog` and alerted via Sentry

5. **Frontend:**
   - Axios interceptor catches 401 (token expired), triggers token refresh + request retry
   - Axios interceptor catches other errors, shows toast notification to user

## Cross-Cutting Concerns

**Logging:**
- **Backend**: ELK-structured logging via `ElkLoggerService`. In production, all logs streamed to Elasticsearch; in dev, console output.
- **Frontend**: Browser console logs, Sentry error tracking for production

**Validation:**
- **Backend**: `class-validator` + `class-transformer` via global `ValidationPipe` in main.ts. DTOs define schema, applied to every controller method.
- **Frontend**: `react-hook-form` + `zod` for form validation; Zod schemas define request payload shape.

**Authentication:**
- **Strategy**: JWT (15-minute expiry) + HttpOnly Refresh Token (7-day expiry) + TOTP 2FA
- **Flow**: Login endpoint checks credentials, generates tokens, stores refresh token in httpOnly cookie, returns access token in body. Frontend stores access token in memory, sends in every request Authorization header.
- **Token Refresh**: On 401 response, frontend sends refresh token in cookie (automatically included by axios with `withCredentials: true`), gets new access token, retries original request.

**Rate Limiting:**
- **Backend**: `@nestjs/throttler` applied globally and per-endpoint:
  - Default: 100 requests/minute
  - Auth endpoints: 5 requests/15 minutes
  - File uploads: 20 requests/minute

**Metrics & Monitoring:**
- **Prometheus**: Collects request count, duration, error rate via `MetricsInterceptor`
- **Grafana**: Dashboards for request latency, error trends, queue backlog
- **Sentry**: Error tracking and alerting; captures exceptions with full context (user, session, breadcrumbs)

**Audit Logging:**
- **Table**: `AuditLog` captures all CRUD operations on sensitive entities
- **Fields**: userId, action, entityType, entityId, oldValues, newValues, timestamp, ipAddress
- **Trigger**: `AuditLogInterceptor` hooks into response, writes audit records after successful write operations
- **Retention**: Partitioned by month for performance; old partitions archived quarterly

---

*Architecture analysis: 2026-03-18*
