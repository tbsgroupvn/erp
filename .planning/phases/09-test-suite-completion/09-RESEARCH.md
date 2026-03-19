# Phase 9: Test Suite Completion - Research

**Researched:** 2026-03-20
**Domain:** NestJS unit testing with Jest, service-layer test coverage, regression testing
**Confidence:** HIGH

## Summary

Phase 9 is a test-only phase that writes unit tests for 3 critical services (OrderService, AuthService, GeneralLedgerService) and verifies regression test coverage for all Phases 1-8 hardening fixes. No production code changes are made.

The project already has 26 spec files from Phases 1-8, establishing strong patterns for mocking Prisma, using `Test.createTestingModule()` or manual instantiation, and structuring test cases. Jest 29.7 with ts-jest 29.4 is fully configured with path aliases (`@core/`, `@common/`, `@modules/`). The existing `auth.service.spec.ts` covers login (valid/invalid/inactive/2FA), logout, 2FA setup, SMS OTP, and password reset -- but is missing token refresh and verifyLoginOtp tests. Three regression gaps exist: CustomThrottlerGuard (Phase 4), FileValidationPipe (Phase 4), and RolesGuard (Phase 5) have no spec files despite being key hardening deliverables.

**Primary recommendation:** Follow existing project patterns (NestJS TestingModule for complex DI, manual `new` for pure logic), mock all external dependencies (Prisma, EventEmitter, CacheService, TransactionalEmitter), and create 4 new spec files (order.service.spec.ts, order-status.service.spec.ts, general-ledger.service.spec.ts, plus a regression spec for Phase 4-5 guards/pipes).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- OrderService tests: Create `order.service.spec.ts` covering create, update status, cancel, reopen
- Each flow: at least 1 positive case + 1 negative case
- Mock Prisma, EventEmitter, DepositGateService, OrderStatusMachine
- Test that TransactionalEmitter (Phase 3) is used correctly -- events only after commit
- AuthService tests: `auth.service.spec.ts` already exists -- verify coverage and extend if needed
- Must cover: login (valid/invalid), 2FA TOTP verification (valid/expired), token refresh (valid/expired), logout
- Test error responses use DomainException (Phase 1 format)
- GeneralLedgerService tests: Create `general-ledger.service.spec.ts` covering journal entry creation, period close
- Verify double-entry balance (debits = credits)
- Test that closed period rejects new entries
- Regression tests: Audit all 26 existing spec files and fill gaps for Phases 1-8 fixes

### Claude's Discretion
- Exact test cases for each service beyond minimum requirements
- Whether auth.service.spec.ts needs extension or is already sufficient
- Which Phase 1-8 fixes need additional regression tests vs already covered
- Mock strategy (manual vs jest.mock vs NestJS testing module)
- Test file organization

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | Service-level unit tests for OrderService covering create, update status, cancel, reopen | OrderService/OrderStatusService/OrderCancellationService analyzed -- dependencies identified, mock patterns established from 26 existing specs |
| TEST-02 | Service-level unit tests for AuthService covering login, 2FA, token refresh, logout | Existing auth.service.spec.ts analyzed -- covers login+logout+2FA setup but MISSING verifyLoginOtp and refreshToken tests |
| TEST-03 | Service-level unit tests for GeneralLedgerService covering journal entry creation and period close | GL service analyzed -- 2 key methods (createJournalEntry, closePeriod), dependencies: PrismaService only |
| TEST-04 | All hardening changes include regression tests that verify the fix | Gap analysis complete: CustomThrottlerGuard, FileValidationPipe, RolesGuard have NO spec files; TransactionalEmitter not tested in any spec |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jest | 29.7.0 | Test runner + assertion library | Already configured in project |
| ts-jest | 29.4.6 | TypeScript transformer for Jest | Already configured in jest.config.js |
| @nestjs/testing | 11.1.15 | NestJS TestingModule builder | Standard for DI-based service testing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @prisma/client (mocked) | 6.3.0 | Database operations (mocked in tests) | Every service test |
| bcrypt | 5.1.1 | Password hashing (real in auth tests) | AuthService test setup |

### No New Dependencies Needed
All required testing infrastructure is already installed and configured. No new packages required.

**Existing configuration verified:**
- `jest.config.js` -- rootDir, testRegex, moduleNameMapper all correct
- `test/setup.ts` -- env vars, 30s timeout, console noise suppression
- Path aliases: `@core/`, `@common/`, `@modules/` all mapped
- `transformIgnorePatterns` handles ESM-only packages (otplib, dompurify)

## Architecture Patterns

### Test File Organization
```
tbs-erp-backend/
  src/
    modules/order/
      order.service.spec.ts               # NEW (TEST-01)
      order-status.service.spec.ts         # NEW (TEST-01)
      order-cancellation.service.spec.ts   # NEW (TEST-01)
    modules/general-ledger/
      general-ledger.service.spec.ts       # NEW (TEST-03)
    core/auth/
      auth.service.spec.ts                 # EXTEND (TEST-02)
    common/guards/
      custom-throttler.guard.spec.ts       # NEW (TEST-04)
    common/pipes/
      file-validation.pipe.spec.ts         # NEW (TEST-04)
    core/rbac/guards/
      roles.guard.spec.ts                  # NEW (TEST-04)
```

### Pattern 1: NestJS TestingModule (for services with complex DI)
**What:** Use `Test.createTestingModule()` to build a real NestJS DI container with mock providers.
**When to use:** Services with 3+ injected dependencies (OrderService, AuthService).
**Example:**
```typescript
// Source: Existing pattern from auth.service.spec.ts, deposit-gate.service.spec.ts
const module: TestingModule = await Test.createTestingModule({
  providers: [
    OrderService,
    { provide: PrismaService, useValue: mockPrisma },
    { provide: EventEmitter2, useValue: { emit: jest.fn() } },
    { provide: TransactionalEmitter, useValue: mockTxEmitter },
    { provide: DepositGateService, useValue: mockDepositGate },
    { provide: OrderRepository, useValue: mockOrderRepo },
    { provide: ExchangeRateService, useValue: mockExchangeRate },
    { provide: CacheService, useValue: mockCacheService },
  ],
}).compile();
service = module.get<OrderService>(OrderService);
```

### Pattern 2: Manual Instantiation (for simple services/guards/pipes)
**What:** Direct `new Service(mockDep)` without NestJS DI.
**When to use:** Services with 1-2 dependencies, guards, pipes.
**Example:**
```typescript
// Source: Established pattern from Phase 6-7 (order-status.machine.spec.ts)
const guard = new RolesGuard(mockReflector);
const pipe = new FileValidationPipe({ maxSizeBytes: 5_242_880, allowedMimeTypes: ['image/png'] });
```

### Pattern 3: TransactionalEmitter Mock
**What:** Mock that verifies events are buffered then flushed after commit.
**When to use:** Any test verifying Phase 3 deferred event emission.
**Example:**
```typescript
const mockCollector = {
  emit: jest.fn(),
  flush: jest.fn(),
  discard: jest.fn(),
};
const mockTxEmitter = {
  createCollector: jest.fn().mockReturnValue(mockCollector),
};

// In assertion:
expect(mockTxEmitter.createCollector).toHaveBeenCalled();
expect(mockCollector.emit).toHaveBeenCalledWith('order.reopened', expect.objectContaining({ orderId }));
expect(mockCollector.flush).toHaveBeenCalled();
```

### Pattern 4: Prisma Mock Structure
**What:** Mock Prisma with specific model methods as jest.fn().
**When to use:** Every service test.
**Example:**
```typescript
// Source: Established pattern from all 26 existing specs
const mockPrisma = {
  order: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  customer: { findUnique: jest.fn() },
  orderStatusHistory: { create: jest.fn() },
  chartOfAccount: { findMany: jest.fn() },
  closedPeriod: { findUnique: jest.fn(), create: jest.fn() },
  journalEntry: { create: jest.fn(), findFirst: jest.fn() },
  $transaction: jest.fn((cb) => cb(mockPrisma)),
  executeInTransaction: jest.fn((cb) => cb(mockPrisma)),
};
```

### Anti-Patterns to Avoid
- **Real database calls in unit tests:** Always mock PrismaService -- unit tests must run without DB.
- **Testing implementation details:** Test behavior (what the method returns/throws) not internal mechanics.
- **Overmocking TransactionalEmitter:** Don't mock flush/emit separately if the test doesn't verify Phase 3 patterns -- just let the mock pass through.
- **Sharing state between tests:** Always use `beforeEach` for mock setup and `afterEach` with `jest.clearAllMocks()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NestJS DI in tests | Manual dependency wiring | `@nestjs/testing` TestingModule | Handles constructor injection automatically |
| Test mocks | Complex proxy objects | `jest.fn()` + `jest.spyOn()` | Built-in assertion matchers |
| Decimal values | String comparisons | `new Decimal()` from `@prisma/client/runtime/library` | Matches production Prisma Decimal type |
| Test data | Random generators | Fixed mock constants at top of spec | Deterministic, readable test failures |

## Common Pitfalls

### Pitfall 1: TransactionalEmitter Flush Ordering
**What goes wrong:** Tests don't verify that `collector.flush()` is called AFTER the database write completes.
**Why it happens:** The flush is the whole point of Phase 3 -- events must not fire before commit.
**How to avoid:** Structure test assertions to verify: (1) createCollector called, (2) collector.emit called with event data, (3) collector.flush called. The ordering assertion is implicit -- flush is called after the awaited DB operation.
**Warning signs:** Tests pass but don't verify flush was called at all.

### Pitfall 2: Prisma $transaction Mock
**What goes wrong:** `$transaction` mock doesn't properly execute the callback, causing tests to hang or skip assertions.
**Why it happens:** Prisma `$transaction` takes a callback -- the mock must actually invoke it.
**How to avoid:** Use `jest.fn((cb) => cb(mockTx))` where `mockTx` has the same model methods as the main mock.
**Warning signs:** Tests pass vacuously (no assertions triggered inside transaction callback).

### Pitfall 3: bcrypt Timing in Auth Tests
**What goes wrong:** Auth tests are slow (2-3s per test) because bcrypt hashes are computed.
**Why it happens:** `bcrypt.hash()` with cost factor 10-12 is intentionally slow.
**How to avoid:** Hash password once in `beforeAll` (not `beforeEach`). The existing auth.service.spec.ts already does this correctly.
**Warning signs:** Test suite takes >30s for auth tests alone.

### Pitfall 4: Missing jest.clearAllMocks()
**What goes wrong:** Test B passes because of mock state left by test A.
**Why it happens:** jest.fn() instances accumulate call history across tests.
**How to avoid:** Always include `afterEach(() => { jest.clearAllMocks(); })` in every describe block.
**Warning signs:** Tests pass individually but fail when run together, or pass in one order but fail in another.

### Pitfall 5: OrderService Cancel Flow is in Separate Service
**What goes wrong:** Tests attempt to find `cancelOrder` method on OrderService.
**Why it happens:** The cancel flow lives in `OrderCancellationService`, not `OrderService`.
**How to avoid:** Create `order-cancellation.service.spec.ts` for cancel tests, not add them to order.service.spec.ts.
**Warning signs:** "cancelOrder is not a function" type errors.

### Pitfall 6: AuthService Constructor Requires TWO_FA_ENCRYPTION_KEY
**What goes wrong:** AuthService instantiation fails with DomainException.
**Why it happens:** Constructor validates TWO_FA_ENCRYPTION_KEY env var via ConfigService.
**How to avoid:** Mock ConfigService must return a non-empty string for 'TWO_FA_ENCRYPTION_KEY'. Existing spec already handles this.
**Warning signs:** "TWO_FA_ENCRYPTION_KEY environment variable is required" error in test output.

## Code Examples

### OrderService createOrder Test
```typescript
// Positive: successful order creation
it('should create an order with CONSULTING status', async () => {
  mockPrisma.customer.findUnique.mockResolvedValue({
    id: 'cust-1', code: 'KH001', fullName: 'Test', tier: 'NEW',
    depositRate: null, isActive: true, exchangeRateMode: 'FLOATING',
  });
  mockDepositGate.checkDepositRequirement.mockReturnValue({
    required: true, depositRate: 100, depositAmount: 1000000,
  });
  mockOrderRepo.generateOrderCode.mockResolvedValue('TBS-DH-001');
  // Mock $transaction to execute callback
  mockPrisma.$transaction.mockImplementation(async (cb) => {
    const result = await cb(mockPrisma);
    return result;
  });
  mockPrisma.order = {
    ...mockPrisma.order,
    create: jest.fn().mockResolvedValue({ id: 'order-1', code: 'TBS-DH-001', status: 'CONSULTING' }),
  };
  mockPrisma.orderStatusHistory.create.mockResolvedValue({});

  const result = await service.createOrder(createOrderDto, currentUser);

  expect(result.status).toBe('CONSULTING');
  expect(mockEventEmitter.emit).toHaveBeenCalledWith('order.created', expect.any(Object));
});

// Negative: inactive customer
it('should throw BadRequestException for inactive customer', async () => {
  mockPrisma.customer.findUnique.mockResolvedValue({
    id: 'cust-1', code: 'KH001', isActive: false,
  });

  await expect(service.createOrder(createOrderDto, currentUser))
    .rejects.toThrow(BadRequestException);
});
```

### GeneralLedgerService Closed Period Rejection Test
```typescript
it('should reject journal entry when period is closed', async () => {
  mockPrisma.chartOfAccount.findMany.mockResolvedValue([
    { code: '1111', isActive: true },
    { code: '5111', isActive: true },
  ]);
  mockPrisma.closedPeriod.findUnique.mockResolvedValue({
    year: 2026, month: 3, closedBy: 'admin-1',
  });

  const dto = {
    date: '2026-03-15',
    description: 'Test entry',
    entries: [
      { accountCode: '1111', debit: 1000000, credit: 0 },
      { accountCode: '5111', debit: 0, credit: 1000000 },
    ],
  };

  await expect(service.createJournalEntry(dto, 'user-1'))
    .rejects.toThrow(BadRequestException);
  await expect(service.createJournalEntry(dto, 'user-1'))
    .rejects.toThrow('is closed');
});
```

### RolesGuard DomainException Regression Test
```typescript
// Phase 5 regression: RolesGuard throws DomainException with FORBIDDEN errorCode
it('should throw DomainException with FORBIDDEN errorCode for unauthorized role', () => {
  mockReflector.getAllAndOverride.mockReturnValue([UserRole.CEO, UserRole.COO]);
  const context = createMockContext({ user: { id: 'u1', role: UserRole.SALE } });

  expect(() => guard.canActivate(context)).toThrow(DomainException);
  try {
    guard.canActivate(context);
  } catch (e) {
    expect(e.errorCode).toBe('FORBIDDEN');
    expect(e.getStatus()).toBe(HttpStatus.FORBIDDEN);
  }
});
```

### FileValidationPipe Regression Test
```typescript
// Phase 4 regression: oversized file throws DomainException with FILE_TOO_LARGE
it('should throw DomainException with FILE_TOO_LARGE for oversized file', () => {
  const pipe = new FileValidationPipe({
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/png', 'image/jpeg'],
  });
  const oversizedFile = { size: 10 * 1024 * 1024, mimetype: 'image/png' } as Express.Multer.File;

  expect(() => pipe.transform(oversizedFile, {} as any)).toThrow(DomainException);
});
```

## Regression Coverage Analysis (TEST-04)

### Already Covered by Existing Specs

| Phase | Fix | Existing Spec | Coverage |
|-------|-----|---------------|----------|
| Phase 1 | DomainException with errorCode + requestId | `domain.exception.spec.ts`, `http-exception.filter.spec.ts` | FULL |
| Phase 1 | Prisma exception mapping | `prisma-exception.filter.spec.ts` | FULL |
| Phase 1 | Sentry exception handling | `sentry-exception.filter.spec.ts` | FULL |
| Phase 1 | WebSocket error format | `ws-error.util.spec.ts` | FULL |
| Phase 1 | BullMQ processor error format | `processor-error.util.spec.ts` | FULL |
| Phase 2 | Frontend error utilities | No backend regression needed | N/A |
| Phase 3 | TransactionalEmitter | Covered by new OrderService tests (TEST-01) | COVERED IN TEST-01 |
| Phase 6 | FSM negative-path matrices (640 tests) | 9 machine spec files | FULL |
| Phase 6 | Order lifecycle integration | `order-lifecycle.integration.spec.ts` | FULL |
| Phase 6 | Container lifecycle integration | `container-lifecycle.integration.spec.ts` | FULL |
| Phase 7 | Deposit gate tier tests | `deposit-gate.service.spec.ts` (28 tests) | FULL |
| Phase 7 | Anti-fraud tests | `payment-voucher.validator.spec.ts` | FULL |
| Phase 7 | COD enforcement | `cod.service.spec.ts` | FULL |
| Phase 7 | Delivery dispatch | `delivery-dispatch.service.spec.ts` | FULL |
| Phase 7 | Approval escalation | `approval.service.spec.ts`, `sla-tracker.spec.ts` | FULL |
| Phase 7 | AR aging block | `accounts-receivable.service.spec.ts` | FULL |
| Phase 7 | Credit check guard | `credit-check.guard.spec.ts` | FULL |

### Gaps Needing New Regression Tests

| Phase | Fix | Missing Coverage | New Spec File |
|-------|-----|-----------------|---------------|
| Phase 4 | CustomThrottlerGuard (RATE_LIMIT_EXCEEDED, 429) | No spec file exists | `custom-throttler.guard.spec.ts` |
| Phase 4 | FileValidationPipe (FILE_TOO_LARGE, FILE_TYPE_NOT_ALLOWED) | No spec file exists | `file-validation.pipe.spec.ts` |
| Phase 5 | RolesGuard DomainException with FORBIDDEN errorCode | No spec file exists | `roles.guard.spec.ts` |
| Phase 8 | Select projections, slow query logging | Behavioral -- verified via code review in Phase 8 | No unit test feasible (DB query patterns) |

**Phase 8 note:** Select projections and EXPLAIN-based slow query logging are query-layer behaviors that cannot be meaningfully unit tested without a real database. The Phase 8 plan already verified these via code review and manual testing. No regression spec needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest 29.4.6 |
| Config file | `tbs-erp-backend/jest.config.js` |
| Quick run command | `cd tbs-erp-backend && npx jest --testPathPattern="<file>" --no-coverage` |
| Full suite command | `cd tbs-erp-backend && npx jest --no-coverage --forceExit` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | OrderService create, update status, cancel, reopen | unit | `npx jest --testPathPattern="order.service.spec\|order-status.service.spec\|order-cancellation.service.spec" --no-coverage` | Wave 0 |
| TEST-02 | AuthService login, 2FA, token refresh, logout | unit | `npx jest --testPathPattern="auth.service.spec" --no-coverage` | Partial (extend) |
| TEST-03 | GeneralLedgerService journal entry, period close | unit | `npx jest --testPathPattern="general-ledger.service.spec" --no-coverage` | Wave 0 |
| TEST-04 | Regression tests for Phases 1-8 fixes | unit | `npx jest --testPathPattern="custom-throttler.guard.spec\|file-validation.pipe.spec\|roles.guard.spec" --no-coverage` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern="<changed-spec>" --no-coverage`
- **Per wave merge:** `cd tbs-erp-backend && npx jest --no-coverage --forceExit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/modules/order/order.service.spec.ts` -- covers TEST-01 (create, update, reopen)
- [ ] `src/modules/order/order-status.service.spec.ts` -- covers TEST-01 (status transitions)
- [ ] `src/modules/order/order-cancellation.service.spec.ts` -- covers TEST-01 (cancel)
- [ ] `src/modules/general-ledger/general-ledger.service.spec.ts` -- covers TEST-03
- [ ] `src/common/guards/custom-throttler.guard.spec.ts` -- covers TEST-04 (Phase 4)
- [ ] `src/common/pipes/file-validation.pipe.spec.ts` -- covers TEST-04 (Phase 4)
- [ ] `src/core/rbac/guards/roles.guard.spec.ts` -- covers TEST-04 (Phase 5)
- [ ] Extend `src/core/auth/auth.service.spec.ts` with verifyLoginOtp + refreshToken tests -- covers TEST-02

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `new Service()` for all tests | NestJS TestingModule for complex DI | Project convention from Phase 5 | Both patterns coexist in this project |
| `jest.mock()` at module level | Per-test `jest.spyOn()` + `useValue` mock providers | Phase 7 | More explicit, less global state pollution |
| Testing only happy path | Positive + negative for each flow | Phase 6 FSM | 640 FSM tests established this pattern |

## Key Dependencies Per Service

### OrderService Dependencies (7)
| Dependency | Mock Strategy |
|------------|--------------|
| OrderRepository | `useValue` with jest.fn() methods: generateOrderCode, findById, create, update, replaceItems, updateStatus |
| PrismaService | `useValue` with customer.findUnique, order.create/update, orderStatusHistory.create, $transaction |
| DepositGateService | `useValue` with checkDepositRequirement, shouldBlockTransition |
| EventEmitter2 | `useValue` with emit: jest.fn() |
| TransactionalEmitter | `useValue` with createCollector returning mock collector |
| ExchangeRateService | `useValue` with getCurrentRate |
| CacheService | `useValue` with get/set/del/delByPrefix all as jest.fn() |

### OrderStatusService Dependencies (7)
| Dependency | Mock Strategy |
|------------|--------------|
| OrderRepository | `useValue` with findById, updateStatus |
| PrismaService | `useValue` with order.findUnique/update, package.count, orderItem.findMany |
| OrderStatusMachine | `useValue` with assertTransition, validateTransition |
| DepositGateService | `useValue` with shouldBlockTransition |
| EventEmitter2 | `useValue` with emit: jest.fn() |
| TransactionalEmitter | `useValue` with createCollector returning mock collector |
| CacheService | `useValue` with del: jest.fn() |

### AuthService Dependencies (7)
| Dependency | Mock Strategy |
|------------|--------------|
| PrismaService | `useValue` with user.findUnique/update/findFirst, session.create/delete/deleteMany/findUnique |
| JwtService | `useValue` with sign, verify |
| ConfigService | `useValue` with map-based get() returning jwt keys + TWO_FA_ENCRYPTION_KEY |
| EventEmitter2 | `useValue` with emit: jest.fn() |
| SmsService | `useValue` with sendSms: jest.fn() |
| CACHE_MANAGER | `useValue` with get/set/del |
| CacheService | `useValue` with get/set/del/delByPrefix |

### GeneralLedgerService Dependencies (1)
| Dependency | Mock Strategy |
|------------|--------------|
| PrismaService | `useValue` with chartOfAccount.findMany, closedPeriod.findUnique/create, journalEntry.create/findFirst |

## Auth Service Coverage Gap Analysis

### Currently Tested (in auth.service.spec.ts)
- Login with valid credentials (no 2FA) -- COVERED
- Login returns 2FA challenge when enabled -- COVERED
- Login with invalid email -- COVERED
- Login with invalid password -- COVERED
- Login with inactive user -- COVERED
- Update lastLoginAt on login -- COVERED
- Password reset (valid/invalid/expired token) -- COVERED
- Logout (session revocation + cache invalidation) -- COVERED
- 2FA secret generation -- COVERED
- Enable 2FA (no secret error, already enabled error) -- COVERED
- 2FA status check -- COVERED
- Backup code regeneration -- COVERED
- SMS OTP send (with/without phone number) -- COVERED

### Missing (must add for TEST-02)
- **verifyLoginOtp** with valid TOTP code -- NOT TESTED
- **verifyLoginOtp** with expired/invalid temp token -- NOT TESTED
- **verifyLoginOtp** with invalid OTP code -- NOT TESTED
- **refreshToken** with valid session -- NOT TESTED
- **refreshToken** with expired session -- NOT TESTED
- **refreshToken** with invalid/mismatched token -- NOT TESTED

**Recommendation:** Extend existing `auth.service.spec.ts` with 2 new `describe` blocks: `verifyLoginOtp` and `refreshToken`. Do NOT create a separate file.

## Open Questions

1. **OrderService.$transaction retry loop**
   - What we know: `createOrder` has a retry loop for P2002 (unique constraint violations on order code). Testing this path requires making $transaction.mockImplementation throw `{ code: 'P2002' }` on first call, succeed on second.
   - What's unclear: Whether this is worth testing since it's defensive code unlikely to trigger in unit tests.
   - Recommendation: Include one test for the retry path as it's a distinctive behavior.

2. **CacheService mock behavior**
   - What we know: Many methods wrap cache calls in try/catch, so cache failures are silently ignored.
   - What's unclear: Whether tests should verify cache interactions at all, since they're not functionally critical.
   - Recommendation: Mock CacheService to return undefined/resolve to verify the service works regardless of cache state. Don't test cache hit/miss paths in unit tests.

## Sources

### Primary (HIGH confidence)
- Project codebase analysis: 26 existing spec files, jest.config.js, test/setup.ts
- `auth.service.spec.ts` (462 lines) -- analyzed for coverage gaps
- `deposit-gate.service.spec.ts` (450 lines) -- reference pattern for NestJS TestingModule
- `order-status.machine.spec.ts` -- reference pattern for manual instantiation
- `http-exception.filter.spec.ts` -- reference for Phase 1 regression pattern

### Secondary (MEDIUM confidence)
- NestJS testing documentation patterns applied to project conventions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already installed and configured
- Architecture: HIGH -- 26 existing specs provide clear patterns to follow
- Pitfalls: HIGH -- patterns verified by reading actual service implementations
- Regression gaps: HIGH -- grep-based analysis of all spec files for guard/pipe/emitter coverage

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- testing patterns don't change rapidly)
