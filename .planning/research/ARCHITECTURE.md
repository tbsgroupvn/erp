# Architecture Research: ERP Hardening Integration

**Domain:** ERP system hardening (error handling, query optimization, RBAC audit, FSM verification)
**Researched:** 2026-03-18
**Confidence:** HIGH

## System Overview: Hardening Touchpoints

The hardening effort spans all six architectural layers of the existing TBS Order ERP. The diagram below shows the existing layered architecture with hardening integration points marked.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Controllers  │  │ WS Gateway   │  │ Global Filters           │  │
│  │ (91 files)   │  │              │  │ HttpException [MODIFY]   │  │
│  │ [RBAC AUDIT] │  │              │  │ PrismaException [MODIFY] │  │
│  └──────┬───────┘  └──────┬───────┘  │ Sentry [MODIFY]         │  │
│         │                 │          │ AllExceptions [ADD]      │  │
│         │                 │          └──────────────────────────┘  │
├─────────┴─────────────────┴───────────────────────────────────────┤
│                    APPLICATION LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Services     │  │ Listeners    │  │ Error Standardization    │  │
│  │ (60+ files)  │  │ (event-      │  │ [MODIFY service error    │  │
│  │ [MODIFY      │  │  driven)     │  │  throwing patterns]      │  │
│  │  queries]    │  │ [VERIFY]     │  │                          │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────────┘  │
├─────────┴─────────────────┴───────────────────────────────────────┤
│                    DOMAIN LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ 9 FSMs       │  │ Validators   │  │ BaseStatusMachine        │  │
│  │ [VERIFY all  │  │ [VERIFY]     │  │ [MODIFY: add logging,    │  │
│  │  transitions]│  │              │  │  metrics hooks]          │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────────┘  │
├─────────┴─────────────────┴───────────────────────────────────────┤
│                    REPOSITORY LAYER                                │
│  ┌──────────────┐  ┌──────────────────────────────────────────┐   │
│  │ Repositories │  │ Query Optimization                       │   │
│  │ (60+ files)  │  │ [MODIFY: select vs include, pagination, │   │
│  │ [MODIFY      │  │  index-aware queries]                   │   │
│  │  queries]    │  │                                          │   │
│  └──────┬───────┘  └──────────────────────────────────────────┘   │
├─────────┴─────────────────────────────────────────────────────────┤
│                    INFRASTRUCTURE LAYER                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ Database │ │ Cache    │ │ Metrics  │ │ Queue    │             │
│  │ [MODIFY: │ │ [VERIFY  │ │ [ADD:    │ │ [VERIFY  │             │
│  │  slow    │ │  inv.    │ │  query   │ │  DLQ]    │             │
│  │  query   │ │  paths]  │ │  perf    │ │          │             │
│  │  logging]│ │          │ │  metrics]│ │          │             │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
├───────────────────────────────────────────────────────────────────┤
│                    COMMON LAYER                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │ Guards   │ │ Filters  │ │ Intercep.│ │ Decorators           │ │
│  │ [AUDIT:  │ │ [MODIFY] │ │ [MODIFY: │ │ [ADD: @RequireRoles  │ │
│  │  Roles,  │ │          │ │  perf,   │ │  audit decorator]    │ │
│  │  DataScp]│ │          │ │  audit]  │ │                      │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐│
│  │ API Client   │  │ Error        │  │ Query Provider           ││
│  │ [MODIFY:     │  │ Boundary     │  │ [MODIFY: retry           ││
│  │  error       │  │ [MODIFY:     │  │  policies, error         ││
│  │  extraction] │  │  Sentry      │  │  callbacks]              ││
│  │              │  │  integration]│  │                          ││
│  └──────────────┘  └──────────────┘  └──────────────────────────┘│
└───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities in Hardening

| Component | Current State | Hardening Action | Type |
|-----------|--------------|------------------|------|
| `HttpExceptionFilter` | Handles HttpException only | Add request ID correlation, standardize error codes | MODIFY |
| `PrismaExceptionFilter` | Maps 6 Prisma error codes | Add P2010 (raw query), P2028 (transaction), P2036 (external connector) | MODIFY |
| `SentryExceptionFilter` | Captures 5xx to Sentry, re-throws | Integrate with new AllExceptionsFilter chain | MODIFY |
| `AllExceptionsFilter` | Does not exist | Catch-all for non-HTTP, non-Prisma errors (unhandled throws) | ADD |
| `RolesGuard` | Default-allow when no `@Roles()` | No code change; audit all 91 controllers for missing `@Roles()` | AUDIT |
| `DataScopeGuard` | Builds filter per role, attaches to request | Verify all repositories actually apply `request.dataScope` | AUDIT |
| `PerformanceInterceptor` | Logs slow requests >1s, >5s | Add query count tracking per request | MODIFY |
| `AuditLogInterceptor` | Logs CUD operations | Add `oldData` capture for UPDATE ops (currently null) | MODIFY |
| `BaseStatusMachine` | 69 lines, transition validation + assertion | Add transition event logging, metrics counter | MODIFY |
| `OrderStatusMachine` | Delegates to external maps, MHH gate | Verify all transitions with comprehensive tests | VERIFY |
| `PrismaService` | Slow query logging >200ms | Add Prisma query middleware for N+1 detection | MODIFY |
| `OrderReadService` | Always includes all relations | Split into tiered query methods (list/detail/full) | MODIFY |
| `CacheInvalidationService` | Event-driven invalidation | Verify all write paths emit events, add missing patterns | VERIFY |
| `ErrorBoundary` (FE) | Generic fallback, no Sentry | Wire up Sentry capture, add per-route boundaries | MODIFY |
| `apiClient` (FE) | 401 retry, offline queue | Standardize error toast messages by status code | MODIFY |
| `QueryProvider` (FE) | staleTime 30s, retry < 1 | Add global `onError` callback for toast standardization | MODIFY |

## Hardening Integration Points

### 1. Error Handling Standardization

**Current state:** Three exception filters exist, registered in two places:
- `main.ts` registers `HttpExceptionFilter` and `PrismaExceptionFilter` via `useGlobalFilters()`
- `app.module.ts` registers `SentryExceptionFilter` via DI-based `APP_FILTER` provider

**Problem:** Unhandled exceptions (non-HTTP, non-Prisma) fall through to NestJS default handler, producing inconsistent JSON. No request correlation ID in error responses.

**Integration plan:**

```
Request → SentryExceptionFilter (catch-all, captures 5xx to Sentry, re-throws)
       → PrismaExceptionFilter (catches Prisma errors, returns JSON)
       → HttpExceptionFilter (catches HTTP errors, returns JSON)
       → AllExceptionsFilter [ADD] (catches everything else, returns JSON)
```

**Files to modify:**
- `tbs-erp-backend/src/common/filters/http-exception.filter.ts` -- Add `requestId` to response, use error code enum
- `tbs-erp-backend/src/common/filters/prisma-exception.filter.ts` -- Add `requestId`, handle additional Prisma codes
- `tbs-erp-backend/src/common/filters/sentry-exception.filter.ts` -- Ensure it works in the filter chain
- `tbs-erp-backend/src/main.ts` -- Register filters in correct order

**Files to add:**
- `tbs-erp-backend/src/common/filters/all-exceptions.filter.ts` -- Catch-all for unhandled exceptions
- `tbs-erp-backend/src/common/constants/error-codes.ts` -- Standardized error code enum (ERR_VALIDATION, ERR_NOT_FOUND, ERR_FORBIDDEN, ERR_FSM_INVALID_TRANSITION, etc.)

**Frontend integration:**
- `tbs-erp-frontend/src/lib/api/client.ts` -- Map backend error codes to user-facing Vietnamese messages
- `tbs-erp-frontend/src/components/shared/error-boundary.tsx` -- Wire Sentry integration (currently TODO at line 59)
- `tbs-erp-frontend/src/lib/providers/query-provider.tsx` -- Add global `onError` for toast notifications

**Standard error response contract (existing, to be enforced):**
```typescript
interface ApiErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;    // ADD: machine-readable code (e.g., "ERR_ORDER_INVALID_TRANSITION")
  message: string | string[];
  error?: string;
  timestamp: string;
  path: string;
  requestId?: string;   // ADD: correlation ID from X-Request-ID header
}
```

### 2. Query Optimization

**Current state:** PrismaService logs slow queries (>200ms warn, >2000ms error). `OrderReadService` separates read concerns (CQRS pattern). Repositories use `include` for related data loading.

**Problem:** N+1 risk in list endpoints that `include` all relations. No query count tracking per request. Missing database indexes on filtered fields.

**Integration points -- all MODIFY existing files:**

| File | Change | Impact |
|------|--------|--------|
| `tbs-erp-backend/src/core/database/prisma.service.ts` | Add query count middleware per request context | Infrastructure |
| `tbs-erp-backend/src/common/interceptors/performance.interceptor.ts` | Track query count from request context, warn if >10 queries | Cross-cutting |
| `tbs-erp-backend/src/modules/order/order-read.service.ts` | Replace `include` with `select` in list endpoints | Service |
| `tbs-erp-backend/src/modules/crm/crm.repository.ts` | Optimize customer list queries (avoid loading orders relation) | Repository |
| `tbs-erp-backend/src/modules/container/container.repository.ts` | Optimize container list with selective joins | Repository |
| `tbs-erp-backend/src/modules/customs-declaration/customs-declaration.repository.ts` | Add pagination defaults, optimize joins | Repository |
| `tbs-erp-backend/src/modules/dashboard/dashboard.service.ts` | Use materialized views or cached aggregations | Service |

**Index analysis -- ADD new migration files:**

```
prisma/migrations/YYYYMMDD_hardening_indexes/migration.sql
-- Orders table
CREATE INDEX CONCURRENTLY idx_order_status_created ON "Order" (status, "createdAt" DESC);
CREATE INDEX CONCURRENTLY idx_order_sale_status ON "Order" ("saleId", status);
CREATE INDEX CONCURRENTLY idx_order_customer_created ON "Order" ("customerId", "createdAt" DESC);

-- AuditLog table (partitioned, high volume)
CREATE INDEX CONCURRENTLY idx_audit_entity_created ON "AuditLog" (entity, "createdAt" DESC);
CREATE INDEX CONCURRENTLY idx_audit_user_created ON "AuditLog" ("userId", "createdAt" DESC);

-- Container table
CREATE INDEX CONCURRENTLY idx_container_status ON "Container" (status) WHERE status NOT IN ('COMPLETED');

-- Customs
CREATE INDEX CONCURRENTLY idx_customs_status ON "CustomsDeclaration" (status) WHERE status NOT IN ('CLEARED', 'CANCELLED');
```

**Query pattern to enforce:**
```typescript
// BAD: List endpoint loading all relations
async findAll(where) {
  return this.prisma.order.findMany({
    where,
    include: { customer: true, items: true, statusHistory: true, containers: true },
  });
}

// GOOD: List endpoint with select projection
async findAll(where) {
  return this.prisma.order.findMany({
    where,
    select: {
      id: true, code: true, status: true, serviceType: true,
      totalAmount: true, createdAt: true,
      customer: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: params.limit,
    skip: (params.page - 1) * params.limit,
  });
}
```

### 3. RBAC Verification

**Current state:** 91 controllers exist. 67 controllers have `@Roles()` decorators (504 total usages). `RolesGuard` defaults to allow-all when no `@Roles()` is present (line 23: "If no @Roles() decorator, allow all authenticated users").

**Problem:** 24 controllers may have endpoints accessible to any authenticated user when they should be role-restricted. The guard itself is correctly implemented -- the issue is decorator coverage.

**Integration approach -- AUDIT, then MODIFY:**

This is primarily an audit task that produces controller modifications. No new components needed.

**Audit methodology:**
1. List all 91 controllers
2. For each controller, identify which endpoints lack `@Roles()` at handler or class level
3. Cross-reference with business rules (which roles should access which endpoints)
4. Add missing `@Roles()` decorators

**Key files to audit (controllers without class-level `@Roles()`):**

| Controller | Endpoints | Risk |
|------------|-----------|------|
| `calendar.controller.ts` | Calendar CRUD | LOW -- Workplace module, all roles access |
| `chat.controller.ts` | Chat messages | LOW -- All authenticated users |
| `health.controller.ts` | Health check | NONE -- Public diagnostic |
| `cod.controller.ts` | COD operations | HIGH -- Finance data |
| `commission.controller.ts` | Commission calculations | HIGH -- Finance data |
| `contract.controller.ts` | Contract CRUD | MEDIUM -- Sales + Management |
| `search.controller.ts` | Global search | LOW -- Scoped by DataScopeGuard |
| `video.controller.ts` | Video conferencing | LOW -- All authenticated |
| `wiki.controller.ts` | Internal wiki | LOW -- All authenticated |
| `batch.controller.ts` | Batch operations | HIGH -- Admin only |
| `lost-and-found.controller.ts` | Lost items | LOW -- Warehouse roles |

**DataScopeGuard verification:**
The `DataScopeGuard` builds a `DataScopeFilter` and attaches it to `request.dataScope`. However, repositories must explicitly use this filter. The audit must verify:
1. Every repository method that returns lists checks `request.dataScope`
2. `saleId` filter is applied for SALE role (not just branch)
3. `teamLeaderId` filter actually queries team membership
4. `denied: true` is handled (should return empty results)

**Files to spot-check:**
- `tbs-erp-backend/src/modules/order/order-read.service.ts` -- Does it apply dataScope?
- `tbs-erp-backend/src/modules/crm/crm.repository.ts` -- Customer list scoping
- `tbs-erp-backend/src/modules/dashboard/dashboard.service.ts` -- Dashboard data scoping

### 4. FSM Verification

**Current state:** 9 FSMs extend `BaseStatusMachine`. The `OrderStatusMachine` delegates to external transition maps in `@common/constants`. Test coverage exists (795-line spec files per FSM from commit 15b659d).

**Problem:** Tests validate transitions but do not verify integration with services. Dual location of MHH deposit gate logic (FSM + DepositGateService) creates divergence risk. No runtime metrics on transition frequency or failure rate.

**Integration approach -- MODIFY base class, VERIFY all 9 FSMs:**

**Files to modify:**
- `tbs-erp-backend/src/common/domain/base-status-machine.ts` -- Add optional metrics/logging hooks
- All 9 FSM spec files -- Add integration-level tests that exercise service layer

**Verification matrix (each cell = test case):**

| FSM | Happy Path | Invalid Transitions | Terminal States | Edge Cases |
|-----|-----------|--------------------|-----------------|-----------:|
| Order | 12 transitions | All 15 invalid pairs | COMPLETED, CANCELLED | MHH gate, reopen |
| Supplier Order | 7 transitions | Invalid pairs | REFUNDED, CANCELLED | Partial ship |
| Container | 5 transitions | Invalid pairs | COMPLETED | Border hold |
| Quotation | 4 transitions | Invalid pairs | CONVERTED, EXPIRED | Reject-redraft |
| Complaint | 4 transitions | Invalid pairs | CLOSED | No escalation path |
| Payment Voucher | 2 transitions | Invalid pairs | APPROVED, REJECTED | Withdrawal |
| Warehouse CN | 3 transitions | Invalid pairs | SHIPPED | Recheck |
| Warehouse VN | 3 transitions | Invalid pairs | DELIVERED | Re-sort |
| Customs | 5 transitions | Invalid pairs | CLEARED, CANCELLED | Reject-redraft |

**Domain-specific verification points:**
1. **Order FSM + DepositGateService:** Verify MHH QUOTATION->SOURCING is blocked unless deposit approved
2. **Order FSM + CancellationService:** Verify NON_CANCELLABLE_STATUSES are enforced
3. **Container FSM + Customs Listener:** Verify auto-declaration creation on CUSTOMS status
4. **Complaint FSM:** Verify no path skips INVESTIGATING (currently possible to go OPEN->PENDING_RESOLUTION)
5. **Payment Voucher FSM + ApprovalService:** Verify approval chain required before APPROVED status

## Data Flow Changes

### Error Flow (Current)

```
Exception thrown in Service
    ↓
NestJS Exception Handler
    ↓
SentryExceptionFilter (if 5xx → Sentry, always re-throws)
    ↓
PrismaExceptionFilter (if Prisma error → JSON response)
    OR
HttpExceptionFilter (if HTTP error → JSON response)
    OR
NestJS Default (unhandled → inconsistent 500)
```

### Error Flow (After Hardening)

```
Exception thrown in Service
    ↓
NestJS Exception Handler
    ↓
SentryExceptionFilter (if 5xx → Sentry with requestId, re-throws)
    ↓
PrismaExceptionFilter (if Prisma error → standard JSON with errorCode)
    OR
HttpExceptionFilter (if HTTP error → standard JSON with errorCode)
    OR
AllExceptionsFilter [NEW] (catch-all → standard JSON with errorCode)
    ↓
Frontend apiClient interceptor
    ↓
Maps errorCode → Vietnamese user message → toast notification
```

### Query Performance Flow (After Hardening)

```
HTTP Request arrives
    ↓
PerformanceInterceptor starts timer, initializes query counter
    ↓
Service calls Repository
    ↓
Repository calls PrismaService
    ↓
PrismaService middleware increments query counter per request
    ↓
Repository returns results
    ↓
PerformanceInterceptor:
  - Records total duration
  - Records query count
  - If queries > 10: WARN "N+1 suspected"
  - If duration > 1000ms: WARN "slow request"
  - If duration > 5000ms: ERROR "critical slow request"
  - Records to Prometheus histogram
```

## Architectural Patterns

### Pattern 1: Exception Filter Chain

**What:** Ordered exception filter pipeline where each filter handles a specific exception type and passes through others.
**When to use:** Always -- this is the global error handling strategy.
**Trade-offs:** More filters = more complexity, but each filter stays focused. Order matters (NestJS applies filters in reverse registration order).

**Current registration (main.ts line 75):**
```typescript
app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());
```

**After hardening:**
```typescript
// AllExceptionsFilter MUST be first (catches unhandled), processed last by NestJS
app.useGlobalFilters(
  new AllExceptionsFilter(),
  new HttpExceptionFilter(),
  new PrismaExceptionFilter(),
);
// SentryExceptionFilter registered via APP_FILTER in app.module.ts (DI-based)
```

### Pattern 2: CQRS Read Separation (Already Exists)

**What:** Separate read service (`OrderReadService`) from write service (`OrderService`).
**When to use:** For query optimization -- list/detail/aggregate queries live in the read service, mutation logic in the write service.
**Trade-offs:** More files per module, but query optimization is isolated from business logic.

**Hardening application:** Optimize read services without touching write services. Each read method gets a purpose-specific select projection.

### Pattern 3: Guard-Based Access Audit

**What:** Audit `@Roles()` decorator coverage across all controllers rather than changing the guard implementation.
**When to use:** The `RolesGuard` implementation is correct (allow-all when no decorator is intentional for some endpoints). The gap is missing decorators.
**Trade-offs:** Changing to deny-by-default would break many endpoints. The audit approach is safer and backward-compatible.

### Pattern 4: Request-Scoped Query Counter

**What:** Track number of database queries per HTTP request using AsyncLocalStorage or request context.
**When to use:** For N+1 detection during development and in staging.
**Trade-offs:** Small runtime overhead from AsyncLocalStorage. Disable in production if overhead is measurable.

**Implementation sketch:**
```typescript
// In PrismaService constructor, add query event counter
this.$on('query', (event) => {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.queryCount = (store.queryCount || 0) + 1;
  }
});

// In PerformanceInterceptor, initialize and read the counter
intercept(context, next) {
  const store = { queryCount: 0 };
  return asyncLocalStorage.run(store, () => {
    return next.handle().pipe(
      tap(() => {
        if (store.queryCount > 10) {
          this.logger.warn(`N+1 suspect: ${store.queryCount} queries for ${request.url}`);
        }
      }),
    );
  });
}
```

## Anti-Patterns

### Anti-Pattern 1: Scattershot Error Handling

**What people do:** Each service throws different exception types with inconsistent messages. Some throw string errors, some NestJS exceptions, some raw Prisma errors.
**Why it's wrong:** Frontend cannot reliably parse error responses. Users see technical messages.
**Do this instead:** Always throw NestJS built-in exceptions (NotFoundException, BadRequestException, etc.) from services. Let filters handle the formatting. Use error code enums for machine-readable classification.

### Anti-Pattern 2: Include-Everything Queries

**What people do:** Use Prisma `include: { relation: true }` in list endpoints to avoid separate queries for related data.
**Why it's wrong:** Loads ALL fields of ALL related records even when displaying a table that only needs name and ID. Causes memory bloat and slow responses.
**Do this instead:** Use `select` with explicit field lists. Create purpose-specific query methods: `findForList()`, `findForDetail()`, `findForExport()`.

### Anti-Pattern 3: RBAC via Application Logic Instead of Guards

**What people do:** Check `user.role` inside service methods instead of using `@Roles()` decorator on controller endpoints.
**Why it's wrong:** Role checks are scattered, inconsistent, and untestable. Service layer should not know about HTTP concerns.
**Do this instead:** Use `@Roles()` on every endpoint that needs restriction. Use `DataScopeGuard` for row-level filtering. Service layer receives pre-filtered data scope.

### Anti-Pattern 4: Testing FSMs Without Service Integration

**What people do:** Unit test the FSM class in isolation (validates transitions) but skip testing the service that calls the FSM.
**Why it's wrong:** FSM allows a transition, but service has additional preconditions (deposit gate, approval chain, document requirements). The FSM test passes but the real flow fails.
**Do this instead:** Add integration tests that exercise `OrderService.changeStatus()` with mocked repositories but real FSMs, gates, and validators.

## Component Modification vs Addition Summary

### Components to MODIFY (existing files)

| Layer | File | Change Description |
|-------|------|--------------------|
| Filter | `common/filters/http-exception.filter.ts` | Add requestId, errorCode |
| Filter | `common/filters/prisma-exception.filter.ts` | Add requestId, errorCode, new Prisma codes |
| Filter | `common/filters/sentry-exception.filter.ts` | Add requestId to Sentry scope |
| Interceptor | `common/interceptors/performance.interceptor.ts` | Add query count tracking |
| Interceptor | `common/interceptors/audit-log.interceptor.ts` | Capture oldData for UPDATE |
| Guard | Various controllers (per audit) | Add missing `@Roles()` decorators |
| Domain | `common/domain/base-status-machine.ts` | Add metrics/logging hooks |
| Infrastructure | `core/database/prisma.service.ts` | Add query count middleware |
| Service | `modules/order/order-read.service.ts` | Select projections for lists |
| Service | `modules/dashboard/dashboard.service.ts` | Cached aggregations |
| Repository | `modules/crm/crm.repository.ts` | Optimized customer queries |
| Repository | `modules/container/container.repository.ts` | Selective joins |
| Repository | `modules/customs-declaration/customs-declaration.repository.ts` | Pagination defaults |
| Bootstrap | `main.ts` | Register AllExceptionsFilter |
| Frontend | `lib/api/client.ts` | Error code mapping, toast standardization |
| Frontend | `components/shared/error-boundary.tsx` | Sentry integration |
| Frontend | `lib/providers/query-provider.tsx` | Global onError callback |

### Components to ADD (new files)

| Layer | File | Purpose |
|-------|------|---------|
| Filter | `common/filters/all-exceptions.filter.ts` | Catch-all for unhandled exceptions |
| Constants | `common/constants/error-codes.ts` | Standardized error code enum |
| Migration | `prisma/migrations/YYYYMMDD_hardening_indexes/` | Performance indexes |
| Test | `test/integration/rbac-coverage.spec.ts` | Automated RBAC decorator audit |
| Test | `test/integration/fsm-service-integration.spec.ts` | FSM + service integration tests |
| Test | `test/integration/query-performance.spec.ts` | N+1 detection tests |

### Components to VERIFY (audit only, may trigger modifications)

| Component | Verification Task |
|-----------|------------------|
| 91 controllers | Every endpoint has appropriate `@Roles()` |
| DataScopeGuard usage | Every repository applies `request.dataScope` |
| 9 FSMs | All transitions match business rules |
| Cache invalidation | All write paths emit events |
| BullMQ DLQ | Failed jobs are captured and alerting works |
| Event listeners | Silent failures are detected |

## Build Order for Hardening Phases

Based on dependency analysis, hardening should proceed in this order:

### Phase 1: Error Handling Standardization (Foundation)

**Rationale:** All other hardening work produces errors that need consistent handling. Error codes and response format must be established first.

**Dependency:** None -- this is pure infrastructure.

**Scope:**
1. Create error code constants
2. Add `AllExceptionsFilter`
3. Modify existing filters for requestId + errorCode
4. Update frontend error handling
5. Wire ErrorBoundary to Sentry

### Phase 2: RBAC Audit (Security)

**Rationale:** Security gaps should be closed before optimizing queries (which might inadvertently expose data). Uses error handling from Phase 1 for proper 403 responses.

**Dependency:** Phase 1 (error codes for RBAC violations).

**Scope:**
1. Audit all 91 controllers for `@Roles()` coverage
2. Verify `DataScopeGuard` usage in repositories
3. Add missing decorators
4. Create automated RBAC coverage test

### Phase 3: FSM Verification (Correctness)

**Rationale:** Business logic correctness must be verified before performance optimization (no point optimizing incorrect queries).

**Dependency:** Phase 1 (error codes for FSM violations), Phase 2 (RBAC on status change endpoints).

**Scope:**
1. Verify all 9 FSMs against business rules
2. Add integration tests (FSM + service)
3. Fix any discovered transition gaps
4. Add FSM transition metrics

### Phase 4: Query Optimization (Performance)

**Rationale:** Now that correctness is assured, optimize for performance. Uses error handling from Phase 1, verified RBAC from Phase 2, and correct business logic from Phase 3.

**Dependency:** Phases 1-3 (correct, secure queries to optimize).

**Scope:**
1. Add query count tracking (N+1 detection)
2. Optimize list endpoints (select projections)
3. Add missing database indexes
4. Verify cache invalidation paths
5. Create query performance tests

```
Phase 1: Error Handling ──→ Phase 2: RBAC ──→ Phase 3: FSM ──→ Phase 4: Query Perf
(Foundation)                (Security)         (Correctness)    (Performance)
   |                           |                  |                |
   ├─ error-codes.ts           ├─ @Roles() audit  ├─ FSM tests    ├─ N+1 detection
   ├─ AllExceptionsFilter      ├─ DataScope verify ├─ Integration  ├─ select projections
   ├─ requestId correlation    ├─ RBAC test suite  │  tests        ├─ indexes migration
   ├─ FE error mapping         │                   ├─ MHH gate     ├─ cache verify
   └─ ErrorBoundary+Sentry     │                   │  verify       └─ perf test suite
                               │                   └─ metrics
                               │
                               └─ (may trigger Phase 3 re-verification
                                   if RBAC reveals FSM bypass paths)
```

## Scaling Considerations

| Concern | Current (50-70 users) | At 200 users | At 1000 users |
|---------|----------------------|-------------|---------------|
| Query performance | Adequate with includes | Select projections needed | Read replicas + materialized views |
| Error logging volume | ~100 errors/day | ~500/day, Sentry quota | Sampling + aggregation |
| Audit log size | ~50K rows/month | ~200K rows/month | Partitioning required (script exists) |
| RBAC checks | Negligible overhead | Negligible | Consider caching role permissions |
| FSM transitions | Synchronous, fast | Add async event emission | Queue-based with saga pattern |

### First Bottleneck: Database Queries

The order list endpoint with full `include` will be the first performance bottleneck. The `OrderReadService` already separates reads from writes (good), but still loads full relation trees. Fix with select projections in Phase 4.

### Second Bottleneck: Audit Log Table Size

The `AuditLog` table grows linearly with every CUD operation across all 60+ modules. At scale, queries on this table will slow down. Partitioning migration already exists (`scripts/partition-audit-log.sql`) but needs to be applied.

## Sources

- Codebase analysis: Direct file reads of all referenced source files (HIGH confidence)
- NestJS exception filter ordering: NestJS applies filters in reverse registration order -- last registered runs first (HIGH confidence, from official docs)
- Prisma query event monitoring: Prisma `$on('query')` API for per-query instrumentation (HIGH confidence, verified in `prisma.service.ts`)
- AsyncLocalStorage for request-scoped context: Node.js built-in API, zero-dependency (HIGH confidence)
- RBAC coverage gap: 91 controllers found, 67 have `@Roles()` decorators -- 24 controllers need audit (HIGH confidence, from codebase grep)

---
*Architecture research for: TBS ERP Hardening*
*Researched: 2026-03-18*
