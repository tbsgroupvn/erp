# TBS ORDER ERP - Test Strategy

> Version 1.0 | 2026-03-17 | Senior QA Engineer

---

## 1. HIEN TRANG (Current State)

### 1.1 Test Inventory

| Layer | Files | Suites | Cases (est.) |
|-------|-------|--------|-------------|
| Backend Unit (*.spec.ts) | 4 | 4 | ~40 |
| Backend E2E (*.e2e-spec.ts) | 5 | 5 | ~120 |
| Frontend Unit (*.test.ts/tsx) | 8 | 8 | ~50 |
| Frontend E2E (Playwright) | 5 | 5 | ~30 |
| CMS Hook Tests | 6 | 6 | ~25 |
| **Total** | **28** | **28** | **~265** |

### 1.2 Coverage Estimate

- **Backend:** ~5% (4 unit test files / ~855 source files)
- **Frontend:** ~3% (8 test files / ~680 source files)
- **Overall estimate:** ~4% - **Target: 80%+**

### 1.3 Tested vs Untested

**Co test:**
- Auth (login, 2FA, RBAC, JWT)
- Credit check guard
- Commission calculator
- Order flow (E2E basic)
- Finance flow (E2E basic)
- Frontend auth, dashboard, orders (Playwright)

**CHUA co test (critical gaps):**
- 9/9 FSM state machines (0 unit tests)
- Approval engine (9 flows)
- Warehouse CN/VN operations
- Customs declaration + tax calculation
- Container consolidation
- Supplier order lifecycle
- Event bus processors (5 processors)
- Cache invalidation/warming
- WebSocket gateway authorization
- All domain services (deposit gate, 3-way matching, weight variance)

---

## 2. TEST PYRAMID

```
                    /\
                   /  \          E2E (Playwright)
                  / 10% \        ~50 test suites
                 /________\      Critical user journeys
                /          \
               /    20%     \    Integration
              /   (Supertest) \  ~120 test suites
             /________________\  API + DB + Redis
            /                  \
           /       70%          \ Unit (Jest)
          /    (Pure logic)      \ ~350 test suites
         /________________________\ FSM, calculators, validators, guards
```

### 2.1 Unit Tests (70%) - Target: ~350 suites

**Scope:** Pure logic, no I/O, no DB, mocked dependencies.

| Priority | Module | Files to Test | Est. Suites |
|----------|--------|---------------|-------------|
| P0 | 9 FSM State Machines | domain/*-status.machine.ts | 9 |
| P0 | Order Constants | order-status.enum.ts | 1 |
| P0 | Deposit Gate | order/domain/deposit-gate.service.ts | 1 |
| P0 | 3-Way Matching | order/domain/three-way-matching.service.ts | 1 |
| P0 | MHH Price Calculator | order/domain/mhh-price-calculator.service.ts | 1 |
| P0 | Extra Charge Service | order/domain/extra-charge.service.ts | 1 |
| P0 | Payment Priority | order/domain/payment-priority.service.ts | 1 |
| P0 | Credit Overdraft | crm/domain/credit-overdraft.service.ts | 1 |
| P0 | Wallet Service | crm/domain/wallet.service.ts | 1 |
| P1 | Approval Graph Engine | approval/domain/approval-graph-engine.ts | 1 |
| P1 | Condition Evaluator | approval/domain/condition-evaluator.ts | 1 |
| P1 | Approver Resolver | approval/domain/approver-resolver.ts | 1 |
| P1 | Duty Calculator | customs/domain/duty-calculator.service.ts | 1 |
| P1 | Tax Allocation | customs/domain/tax-allocation.service.ts | 1 |
| P1 | HS Code Suggestion | customs/domain/hs-code-suggestion.service.ts | 1 |
| P1 | Compliance Checker | customs/domain/compliance-checker.service.ts | 1 |
| P1 | Cost Allocation | operation-cost/domain/cost-allocation.service.ts | 1 |
| P1 | Consolidation | container/domain/consolidation.service.ts | 1 |
| P1 | Chargeable Weight | common/utils/chargeable-weight.util.ts | 1 |
| P1 | Currency Utils | common/utils/currency.util.ts | 1 |
| P1 | Date Utils | common/utils/date.util.ts | 1 |
| P1 | Circuit Breaker | common/utils/circuit-breaker.util.ts | 1 |
| P2 | Payment Voucher Validator | cash/domain/payment-voucher.validator.ts | 1 |
| P2 | Pre-alert Matching | warehouse-cn/domain/pre-alert-matching.service.ts | 1 |
| P2 | Barcode Validator | warehouse-cn/domain/barcode-validator.service.ts | 1 |
| P2 | Delivery Dispatch | warehouse-vn/domain/delivery-dispatch.service.ts | 1 |
| P2 | ECUS Export | customs/domain/ecus-export.service.ts | 1 |
| P2 | Grouping Service | customs/domain/grouping.service.ts | 1 |
| P2 | Grace Period | crm/domain/grace-period.service.ts | 1 |
| P2 | Tracking Provider | tracking/domain/tracking-provider.service.ts | 1 |
| P2 | Guards (CSRF, API Key) | common/guards/*.ts | 3 |
| P2 | Pipes (ParseOrderStatus) | common/pipes/*.ts | 1 |
| P2 | Interceptors (audit, logging, transform) | common/interceptors/*.ts | 5 |
| P2 | Filters (http, prisma, sentry) | common/filters/*.ts | 3 |
| P3 | SLA Monitor | common/services/sla-monitor.service.ts | 1 |
| P3 | Encryption Service | core/encryption/encryption.service.ts | 1 |
| P3 | Key Rotation | core/encryption/key-rotation.service.ts | 1 |
| P3 | CASL Ability Factory | core/rbac/casl-ability.factory.ts | 1 |
| P3 | Data Scope Service | core/rbac/data-scope.service.ts | 1 |
| P3 | Sanitize HTML Decorator | common/decorators/sanitize-html.decorator.ts | 1 |
| P3 | Domain Events | common/patterns/domain-events.ts | 1 |

### 2.2 Integration Tests (20%) - Target: ~120 suites

**Scope:** API endpoints + real DB (test instance) + real Redis. Use Supertest + TestingModule.

| Priority | Module | Scope | Est. Suites |
|----------|--------|-------|-------------|
| P0 | Order CRUD | Create/Read/Update + status transitions | 8 |
| P0 | Order Lifecycle | Full flow CONSULTING → COMPLETED | 3 |
| P0 | CRM Customer | CRUD + credit limit + wallet topup | 5 |
| P0 | Container | CRUD + consolidation + status flow | 5 |
| P0 | Finance AR | Create/allocate/aging + payment | 5 |
| P0 | Finance AP | Create/approve/pay | 3 |
| P1 | Approval Engine | Submit/approve/reject + delegation | 6 |
| P1 | Invoice | Generate/send/credit-note | 4 |
| P1 | Customs Declaration | Create/submit/channel/clear | 5 |
| P1 | Supplier Order | CRUD + status lifecycle | 4 |
| P1 | Warehouse CN | Receive/inspect/pack/ship | 4 |
| P1 | Warehouse VN | Receive/sort/ready/deliver | 4 |
| P1 | Cash Voucher | Create/approve/reject | 3 |
| P1 | Quotation | CRUD + approve/convert/expire | 4 |
| P2 | Commission | Calculate/approve/pay | 3 |
| P2 | Complaint | CRUD + status lifecycle | 3 |
| P2 | Exchange Rate | Set/convert/history | 2 |
| P2 | Employee/Payroll | CRUD + payroll run | 3 |
| P2 | Notification | Send/read/subscribe | 3 |
| P2 | Document Upload | Upload/download/delete | 2 |
| P2 | Debt Netting | Create/match/execute | 2 |
| P2 | COD | Collect/reconcile | 2 |
| P3 | General Ledger | Journal entry/trial balance | 3 |
| P3 | Blog/CMS | CRUD posts/categories/comments | 3 |
| P3 | Public Endpoints | Pages/FAQ/Newsletter/Contact | 3 |
| P3 | Integration APIs | Banking/Customs/Shipping sync | 3 |

### 2.3 E2E Tests (10%) - Target: ~50 suites

**Scope:** Playwright, real browser, full stack running.

| Priority | Journey | Steps | Est. Suites |
|----------|---------|-------|-------------|
| P0 | Login → Dashboard | Auth + role-based dashboard | 3 |
| P0 | Order Creation (VCT) | Login → New order → Fill form → Submit | 3 |
| P0 | Order Creation (MHH) | Login → New → Deposit → Source → Complete | 3 |
| P0 | Order Status Update | View order → Change status → Verify FSM | 2 |
| P0 | Customer Management | List → Create → Edit → View credit | 2 |
| P1 | Container Management | Create → Load → Ship → Arrive → Clear | 2 |
| P1 | Approval Workflow | Submit → Notify → Approve/Reject | 2 |
| P1 | Invoice Generation | Order → Generate invoice → Download | 2 |
| P1 | Quotation Flow | Create → Send → Customer approve → Convert | 2 |
| P1 | Warehouse CN Receive | Scan → Measure → Photo → Confirm | 2 |
| P1 | Warehouse VN Deliver | Receive → Sort → Dispatch → Confirm | 2 |
| P2 | Finance Dashboard | AR aging → Payment → Reconcile | 2 |
| P2 | Complaint Lifecycle | Create → Investigate → Resolve → Close | 1 |
| P2 | Employee Management | List → Create → Attendance → Payroll | 2 |
| P2 | Report Export | Select report → Filter → Export PDF/Excel | 2 |
| P3 | CMS Blog Admin | Create post → Edit → Publish → View public | 1 |
| P3 | Settings & Config | Approval flow config → Save → Verify | 1 |
| P3 | Multi-role Access | Test same page with different roles | 2 |

---

## 3. CRITICAL PATH: ORDER LIFECYCLE (17 Statuses)

### 3.1 Order Status Map

```
CONSULTING → QUOTATION → PENDING_DEPOSIT → SOURCING → WAREHOUSE_CN →
PACKING → CONSOLIDATION → IN_TRANSIT → CUSTOMS → WAREHOUSE_VN →
DELIVERING → SETTLEMENT → COMPLETED

Special: ON_HOLD (freeze/unfreeze), CANCELLED, RETURNED, ISSUE (can resume)
```

### 3.2 Test Cases - Order FSM

#### TC-ORD-001: Happy Path - VCT Order (skip deposit)
```
CONSULTING → QUOTATION → SOURCING → WAREHOUSE_CN → PACKING →
CONSOLIDATION → IN_TRANSIT → CUSTOMS → WAREHOUSE_VN →
DELIVERING → SETTLEMENT → COMPLETED
```
- Assert: each transition succeeds
- Assert: COMPLETED is terminal (no further transitions)
- Assert: audit log created for each transition

#### TC-ORD-002: Happy Path - MHH Order (deposit required)
```
CONSULTING → QUOTATION → PENDING_DEPOSIT → SOURCING → ... → COMPLETED
```
- Assert: MHH QUOTATION → SOURCING blocked (deposit gate)
- Assert: MHH QUOTATION → PENDING_DEPOSIT allowed
- Assert: PENDING_DEPOSIT → SOURCING allowed after deposit confirmed

#### TC-ORD-003: Cancellation - Early Stage
```
CONSULTING → QUOTATION → CANCELLED
```
- Assert: CANCELLED from CONSULTING, QUOTATION, PENDING_DEPOSIT, SOURCING, WAREHOUSE_CN, PACKING, CONSOLIDATION
- Assert: CANCELLED is terminal

#### TC-ORD-004: Cancellation - Blocked After In-Transit
```
IN_TRANSIT → CANCELLED  (should FAIL)
```
- Assert: NON_CANCELLABLE_STATUSES block cancellation
- Assert: IN_TRANSIT, CUSTOMS, WAREHOUSE_VN, DELIVERING, SETTLEMENT, COMPLETED, CANCELLED cannot cancel

#### TC-ORD-005: Return Flow (Late Cancel)
```
IN_TRANSIT → RETURNED
CUSTOMS → RETURNED
WAREHOUSE_VN → RETURNED
DELIVERING → RETURNED
SETTLEMENT → RETURNED
```
- Assert: RETURNED only from RETURN_REQUESTABLE_STATUSES
- Assert: RETURNED is terminal

#### TC-ORD-006: ON_HOLD Freeze/Unfreeze
```
SOURCING → ON_HOLD → SOURCING (resume)
WAREHOUSE_CN → ON_HOLD → WAREHOUSE_CN (resume)
ON_HOLD → CANCELLED (cancel while held)
```
- Assert: ON_HOLD can return to any lifecycle status
- Assert: ON_HOLD can transition to CANCELLED or ISSUE

#### TC-ORD-007: ISSUE Resolution
```
WAREHOUSE_CN → ISSUE → WAREHOUSE_CN (resolved, resume)
CUSTOMS → ISSUE → CUSTOMS (resolved, resume)
ISSUE → CANCELLED (unresolvable)
```
- Assert: ISSUE can return to any lifecycle status
- Assert: ISSUE can transition to ON_HOLD or CANCELLED

#### TC-ORD-008: Invalid Transitions
```
CONSULTING → COMPLETED (skip all stages)  → FAIL
QUOTATION → CUSTOMS (skip middle)         → FAIL
COMPLETED → CONSULTING (reverse)          → FAIL
CANCELLED → CONSULTING (reverse)          → FAIL
```
- Assert: BadRequestException thrown
- Assert: error message contains from/to status

#### TC-ORD-009: MHH Deposit Gate
```
MHH + QUOTATION → SOURCING        → FAIL (blocked)
MHH + QUOTATION → PENDING_DEPOSIT → PASS
VCT + QUOTATION → SOURCING        → PASS (allowed)
VCT + QUOTATION → PENDING_DEPOSIT → PASS (optional)
```

#### TC-ORD-010: getNextStatuses()
- Assert: CONSULTING returns [QUOTATION, ON_HOLD, CANCELLED, ISSUE]
- Assert: COMPLETED returns []
- Assert: CANCELLED returns []
- Assert: MHH + QUOTATION excludes SOURCING from candidates
- Assert: VCT + QUOTATION includes SOURCING in candidates
- Assert: ON_HOLD returns all lifecycle + CANCELLED + ISSUE

#### TC-ORD-011: canCancel()
- Assert: true for CONSULTING through CONSOLIDATION
- Assert: false for IN_TRANSIT through COMPLETED
- Assert: false for CANCELLED

#### TC-ORD-012: getLifecycleStageIndex()
- Assert: CONSULTING = 1, COMPLETED = 13
- Assert: ON_HOLD = -1 (special status)
- Assert: CANCELLED = -1

### 3.3 Integration Test Cases - Order Service

| ID | Test | Method | Assertions |
|-----|------|--------|------------|
| IT-ORD-001 | Create VCT order | POST /orders | Order created, status=CONSULTING, AR record created |
| IT-ORD-002 | Create MHH order | POST /orders | Order created, deposit requirement flagged |
| IT-ORD-003 | Advance status | PATCH /orders/:id/status | Status updated, event emitted, audit log |
| IT-ORD-004 | Credit check pass | POST /orders (within limit) | Order allowed |
| IT-ORD-005 | Credit check fail | POST /orders (over limit) | 400 error, order blocked |
| IT-ORD-006 | Assign to container | POST /orders/:id/container | Package linked, weight recorded |
| IT-ORD-007 | Complete order saga | PATCH (all steps) | Finance events, commission calc, notifications |
| IT-ORD-008 | Cancel with refund | PATCH /orders/:id/cancel | Status=CANCELLED, AR credited, wallet refunded |
| IT-ORD-009 | Master order create | POST /master-orders | Multiple sub-orders grouped |
| IT-ORD-010 | Order search/filter | GET /orders?status=X&customer=Y | Filtered results, data scope per role |

---

## 4. TEST DATA MANAGEMENT

### 4.1 Strategy: Seeded Test DB + Factories

```
Test Execution
    |
    v
[Docker PostgreSQL (test)] ← prisma migrate deploy
    |
    v
[Seed: roles + base data] ← prisma/seed/roles.seed.ts
    |
    v
[Factory: per-test entities] ← test/factories/*.factory.ts
    |
    v
[Test runs with real DB]
    |
    v
[Cleanup: transaction rollback OR truncate]
```

### 4.2 Test Database Setup

```typescript
// test/setup-db.ts
import { execSync } from 'child_process';

export async function setupTestDb() {
  // Use separate test database
  process.env.DATABASE_URL =
    'postgresql://tbs_user:tbs_password@localhost:5433/tbs_erp_test';

  // Run migrations
  execSync('npx prisma migrate deploy', { stdio: 'pipe' });

  // Seed base data (roles, permissions)
  execSync('npx prisma db seed', { stdio: 'pipe' });
}
```

### 4.3 Factory Pattern

```typescript
// test/factories/order.factory.ts
import { PrismaService } from '@core/database/prisma.service';
import { OrderStatus, ServiceType } from '@prisma/client';

export class OrderFactory {
  constructor(private prisma: PrismaService) {}

  async create(overrides: Partial<CreateOrderInput> = {}) {
    const customer = await this.prisma.customer.create({
      data: {
        code: `CUST-${Date.now()}`,
        name: 'Test Customer',
        phone: '0901234567',
        creditLimit: 100_000_000,
        ...overrides.customer,
      },
    });

    return this.prisma.order.create({
      data: {
        orderCode: `ORD-TEST-${Date.now()}`,
        customerId: customer.id,
        serviceType: ServiceType.VCT,
        status: OrderStatus.CONSULTING,
        saleId: overrides.saleId ?? 'test-sale-user-id',
        ...overrides,
      },
    });
  }

  async createWithStatus(status: OrderStatus, serviceType = ServiceType.VCT) {
    const order = await this.create({ serviceType });
    if (status !== OrderStatus.CONSULTING) {
      return this.prisma.order.update({
        where: { id: order.id },
        data: { status },
      });
    }
    return order;
  }
}

// test/factories/index.ts
export class TestFactories {
  order: OrderFactory;
  customer: CustomerFactory;
  container: ContainerFactory;
  user: UserFactory;

  constructor(prisma: PrismaService) {
    this.order = new OrderFactory(prisma);
    this.customer = new CustomerFactory(prisma);
    this.container = new ContainerFactory(prisma);
    this.user = new UserFactory(prisma);
  }
}
```

### 4.4 Cleanup Strategy

```typescript
// test/helpers/db-cleanup.ts
export async function cleanupTestData(prisma: PrismaService) {
  // Truncate in dependency order (child → parent)
  const tables = [
    'AuditLog', 'Notification', 'ApprovalStep',
    'Approval', 'InvoiceItem', 'Invoice',
    'AccountsReceivable', 'Package', 'Order',
    'Container', 'Customer', 'Session', 'User',
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "${table}" CASCADE`
    );
  }
}
```

### 4.5 Test Data Principles

| Rule | Description |
|------|-------------|
| **Isolated** | Each test creates its own data, no shared state between tests |
| **Deterministic** | Fixed seeds for randomized data (faker with seed) |
| **Minimal** | Create only what the test needs, nothing more |
| **Self-cleaning** | afterEach/afterAll cleans up created data |
| **No production data** | Never use real customer PII in tests |

---

## 5. CI INTEGRATION PLAN

### 5.1 Pipeline Architecture

```yaml
# .github/workflows/test.yml
name: Test Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # ========== Stage 1: Lint + Type Check (30s) ==========
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd tbs-erp-backend && npm ci && npm run lint
      - run: cd tbs-erp-frontend && npm ci && npm run lint

  # ========== Stage 2: Unit Tests (2-3 min) ==========
  unit-tests:
    runs-on: ubuntu-latest
    needs: lint
    strategy:
      matrix:
        project: [tbs-erp-backend, tbs-erp-frontend]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd ${{ matrix.project }} && npm ci
      - run: cd ${{ matrix.project }} && npm test -- --coverage --maxWorkers=2
      - uses: codecov/codecov-action@v4
        with:
          directory: ${{ matrix.project }}/coverage
          flags: ${{ matrix.project }}-unit

  # ========== Stage 3: Integration Tests (5-8 min) ==========
  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: tbs_user
          POSTGRES_PASSWORD: tbs_password
          POSTGRES_DB: tbs_erp_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd tbs-erp-backend && npm ci
      - run: cd tbs-erp-backend && npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://tbs_user:tbs_password@localhost:5432/tbs_erp_test
      - run: cd tbs-erp-backend && npm run test:e2e -- --maxWorkers=1
        env:
          DATABASE_URL: postgresql://tbs_user:tbs_password@localhost:5432/tbs_erp_test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          JWT_SECRET: test-jwt-secret-ci
          JWT_REFRESH_SECRET: test-refresh-secret-ci
          NODE_ENV: test

  # ========== Stage 4: E2E Tests (10-15 min) ==========
  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npx playwright install --with-deps chromium
      - run: docker compose -f docker-compose.dev.yml up -d
      - run: sleep 30 # Wait for services
      - run: cd tbs-erp-frontend && npx playwright test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: tbs-erp-frontend/playwright-report/
```

### 5.2 Coverage Gates

```javascript
// jest.config.js - Backend
coverageThreshold: {
  global: {
    branches: 70,
    functions: 75,
    lines: 80,
    statements: 80,
  },
  // Critical modules: higher threshold
  './src/modules/order/domain/': {
    branches: 90,
    functions: 95,
    lines: 95,
  },
  './src/common/constants/order-status.enum.ts': {
    branches: 100,
    functions: 100,
    lines: 100,
  },
}
```

### 5.3 Test Reporting

| Tool | Purpose | Output |
|------|---------|--------|
| Jest | Unit/Integration coverage | LCOV + JSON → Codecov |
| Playwright | E2E results | HTML report → Artifacts |
| Codecov | Coverage tracking | PR comments + badges |
| GitHub Actions | Fail gate | Block merge if coverage drops |

---

## 6. PERFORMANCE TESTING PLAN

### 6.1 Tool: k6

```javascript
// test/load/order-lifecycle.k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    // Normal load
    steady_state: {
      executor: 'constant-vus',
      vus: 50,
      duration: '10m',
    },
    // Peak season simulation
    peak_season: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '2m', target: 100 },   // ramp up
        { duration: '5m', target: 200 },   // peak
        { duration: '2m', target: 50 },    // cool down
      ],
    },
    // Spike test
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 },  // sudden spike
        { duration: '1m', target: 500 },   // hold
        { duration: '10s', target: 0 },    // drop
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],      // < 1% error rate
    http_reqs: ['rate>100'],              // > 100 req/s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export function setup() {
  // Login and get token
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    email: 'loadtest@tbs.com',
    password: 'LoadTest2026!',
  }), { headers: { 'Content-Type': 'application/json' } });

  return { token: JSON.parse(loginRes.body).accessToken };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // GET /orders (list - most frequent operation)
  const listRes = http.get(`${BASE_URL}/api/v1/orders?page=1&limit=20`, { headers });
  check(listRes, { 'list orders 200': (r) => r.status === 200 });

  // GET /dashboard (heavy aggregation query)
  const dashRes = http.get(`${BASE_URL}/api/v1/dashboard`, { headers });
  check(dashRes, { 'dashboard 200': (r) => r.status === 200 });

  // POST /orders (create - write operation)
  if (__ITER % 10 === 0) {
    const createRes = http.post(`${BASE_URL}/api/v1/orders`, JSON.stringify({
      customerId: 'perf-test-customer-id',
      serviceType: 'VCT',
      goodsDescription: `Load test order ${__ITER}`,
    }), { headers });
    check(createRes, { 'create order 201': (r) => r.status === 201 });
  }

  sleep(1);
}
```

### 6.2 Performance Test Scenarios

| Scenario | VUs | Duration | Target | Endpoint Focus |
|----------|-----|----------|--------|---------------|
| **Baseline** | 20 | 5m | p95 < 200ms | GET /orders, GET /dashboard |
| **Normal Load** | 50 | 10m | p95 < 500ms | All CRUD operations |
| **Peak Season** | 200 | 10m | p95 < 1s, 0 errors | Order creation burst |
| **Spike** | 500 | 2m | < 1% error rate | Login + order list |
| **Soak** | 30 | 60m | No memory leak, stable latency | Mixed workload |
| **DB Stress** | 100 | 10m | p95 < 2s | Dashboard aggregation, reports |

### 6.3 Key Metrics & Thresholds

| Metric | Normal | Peak | Alert |
|--------|--------|------|-------|
| **Response time p95** | < 200ms | < 500ms | > 1s |
| **Response time p99** | < 500ms | < 1s | > 2s |
| **Error rate** | < 0.1% | < 1% | > 2% |
| **Throughput** | > 200 req/s | > 100 req/s | < 50 req/s |
| **CPU usage** | < 50% | < 80% | > 90% |
| **Memory usage** | < 60% | < 80% | > 90% |
| **DB connections** | < 30 | < 80 | > 90 (pool: 100) |
| **Redis latency** | < 5ms | < 20ms | > 50ms |

### 6.4 CI Integration for Load Tests

```yaml
# .github/workflows/load-test.yml (weekly or pre-release)
name: Load Test
on:
  schedule:
    - cron: '0 2 * * 1'  # Every Monday 2AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/k6-action@v0.3.1
        with:
          filename: test/load/order-lifecycle.k6.js
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
      - uses: actions/upload-artifact@v4
        with:
          name: k6-results
          path: summary.json
```

---

## 7. IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1-2)
- [ ] Setup test DB in Docker (docker-compose.test.yml)
- [ ] Create factory pattern (test/factories/)
- [ ] Create db cleanup utility (test/helpers/)
- [ ] Unit test all 9 FSM state machines
- [ ] Unit test order-status.enum.ts (100% coverage)
- [ ] Unit test chargeable-weight, currency, date utils
- **Target: +30 test suites, coverage ~15%**

### Phase 2: Core Business Logic (Week 3-4)
- [ ] Unit test all domain services (deposit gate, 3-way matching, etc.)
- [ ] Unit test approval engine (graph engine, condition evaluator)
- [ ] Unit test customs (duty calculator, tax allocation)
- [ ] Integration tests for Order CRUD + lifecycle
- [ ] Integration tests for CRM + credit check
- **Target: +60 test suites, coverage ~35%**

### Phase 3: Secondary Modules (Week 5-6)
- [ ] Integration tests for Container, Warehouse CN/VN
- [ ] Integration tests for Finance (AR, AP, Invoice, Cash)
- [ ] Integration tests for Approval flows
- [ ] Unit tests for guards, interceptors, filters
- [ ] Frontend component tests for critical forms
- **Target: +80 test suites, coverage ~55%**

### Phase 4: Hardening (Week 7-8)
- [ ] E2E tests for 15 critical user journeys (Playwright)
- [ ] Integration tests for remaining modules
- [ ] Performance tests with k6
- [ ] Coverage gates in CI pipeline
- [ ] Fix flaky tests, optimize test runtime
- **Target: +50 test suites, coverage ~80%**

### Phase 5: Maintenance (Ongoing)
- [ ] Every new feature requires tests (PR gate)
- [ ] Weekly load test on staging
- [ ] Monthly coverage review
- [ ] Quarterly E2E test update

---

## 8. KPI & SUCCESS CRITERIA

| KPI | Current | Phase 1 | Phase 2 | Phase 4 (Final) |
|-----|---------|---------|---------|-----------------|
| Test suites | 28 | 58 | 118 | 248+ |
| Code coverage | ~4% | 15% | 35% | 80%+ |
| FSM coverage | 0/9 | 9/9 | 9/9 | 9/9 |
| Domain services tested | 1/30+ | 5/30+ | 20/30+ | 30/30+ |
| CI test time | ~3min | ~5min | ~10min | ~15min |
| E2E journeys | 5 | 5 | 10 | 20+ |
| Load test | None | None | Baseline | Weekly |
| Flaky test rate | Unknown | < 5% | < 2% | < 1% |
