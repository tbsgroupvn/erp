# Domain Pitfalls: NestJS + Prisma ERP Hardening

**Domain:** Hardening an existing production ERP system (NestJS 11 + Prisma 6 + PostgreSQL 15)
**Researched:** 2026-03-18
**Confidence:** HIGH (based on codebase analysis + verified patterns from official docs and community)

---

## Critical Pitfalls

Mistakes that cause regressions, data corruption, or production outages during hardening.

### Pitfall 1: Silent Event Listener Failures Mask Data Inconsistency

**What goes wrong:** During hardening, you discover that event listeners (134 files, 325+ `@OnEvent`/`EventEmitter2` usages in this codebase) swallow errors with try-catch-log patterns. You "fix" this by removing the try-catch or re-throwing -- but NestJS EventEmitter2 does not propagate async listener errors back to the emitter. The listener crashes, the event is lost, and the HTTP request that emitted it still returns 200 OK. Worse: some listeners perform critical state transitions (e.g., `WarehouseUpdatedListener.handleAllDelivered` auto-transitions orders to SETTLEMENT, `OrderCompletedListener` creates commission records).

**Why it happens:** The existing pattern of catch-and-log in listeners (seen in `warehouse-updated.listener.ts`, `order-completed.listener.ts`, `container-customs.listener.ts`) looks like something to "fix" during error handling standardization. The instinct is to let errors propagate. But EventEmitter2 in NestJS is fire-and-forget by design -- there is no caller to propagate to.

**Consequences:**
- Orders stuck in incorrect states (DELIVERING never transitions to SETTLEMENT)
- Commission records never created for completed orders
- Customs declarations not generated when containers hit CUSTOMS status
- No user-visible error -- the failure is completely silent to the operator

**Prevention:**
1. Keep try-catch in every async listener -- this is the CORRECT pattern for fire-and-forget events
2. Add a dead letter queue (the codebase already has `dead-letter-queue.service.ts`) -- route failed events there for retry
3. Add monitoring: emit a metric on listener failure so Prometheus/Grafana alerts fire
4. For critical state transitions (order status, commission, customs), add idempotent retry with exponential backoff via BullMQ instead of relying on EventEmitter2
5. Write integration tests that simulate listener failures and verify the system recovers

**Detection:** Search for `@OnEvent` handlers that lack try-catch blocks, or that re-throw errors. Either pattern is a data loss risk.

**Phase mapping:** Error Handling Standardization phase. Do NOT "standardize" listeners the same way you standardize controllers. Listeners need a different error handling strategy.

---

### Pitfall 2: RBAC Audit Creates False Security by Missing the Default-Allow Gap

**What goes wrong:** The RolesGuard (line 23 in `roles.guard.ts`) explicitly returns `true` when no `@Roles()` decorator is present -- any authenticated user can access the endpoint. During RBAC audit, you find ~23 controllers without `@Roles()` on some/all endpoints (94 controllers total, only 71 files reference `@Roles`). You start adding `@Roles()` everywhere. But you add the wrong roles (e.g., restricting a dashboard endpoint to ACCOUNTANT when SALE also needs it), and you break production for an entire role group with zero test coverage to catch it.

**Why it happens:** The codebase has 22 roles with deeply domain-specific permissions (CEO sees all, SALE sees own customers, WAREHOUSE_CN_AGENT sees only CN warehouse). There is no single source of truth mapping roles to endpoints. The guard comment says "endpoints that need restriction MUST use @Roles()" but enforcement is voluntary. When you add restrictions during audit, you are guessing which roles need access based on code reading alone -- no specification document exists.

**Consequences:**
- Entire role groups locked out of endpoints they need daily (e.g., SALE locked out of order creation)
- Escalation tickets from production users
- Pressure to revert the RBAC changes, erasing hardening work
- False confidence: "all endpoints have @Roles() now" but the role lists are wrong

**Prevention:**
1. Before adding any `@Roles()`, create a role-endpoint matrix document mapping every controller method to its required roles. Get sign-off from business stakeholders
2. Add `@Roles()` incrementally by module, not all at once. Deploy each module's RBAC changes separately
3. Create automated tests per role: for each of the 22 roles, test that their expected endpoints return 200 and forbidden endpoints return 403
4. Log all 403 responses with the user's role and the endpoint -- monitor in production for unexpected 403 spikes after deployment
5. Consider implementing deny-by-default ONLY after comprehensive testing is in place

**Detection:** Grep for controllers missing `@Roles()`. Cross-reference with `@UseGuards(JwtAuthGuard, RolesGuard)` -- if the guard is applied but no roles are specified, it is effectively unprotected.

**Phase mapping:** RBAC Verification phase. Requires business stakeholder input -- this is NOT a pure engineering task.

---

### Pitfall 3: Error Handling Refactoring Changes API Response Shape and Breaks Frontend

**What goes wrong:** You standardize error handling by adding or modifying exception filters. The `PrismaExceptionFilter` returns `{ success, statusCode, message, error, timestamp, path }`. The `HttpExceptionFilter` returns `{ success, statusCode, message, error, timestamp, path }`. They look identical, but during refactoring you change a field name, add a field, or change `message` from `string` to `string[]` (validation pipe already does this for DTO errors). The frontend `api/client.ts` and all 50+ `use-*.ts` hooks parse error responses with specific expectations. One shape change breaks all error handling in the frontend.

**Why it happens:** The PROJECT.md constraint says "no API contract changes" but developers treat error responses as "not really the API contract." Error response shapes are rarely typed or documented. The frontend has evolved to handle the current error shape through pattern matching (checking `error.response.data.message`), not through a typed contract.

**Consequences:**
- Frontend toast notifications show "[object Object]" or "undefined" instead of error messages
- Form validation errors display as blank or generic "Something went wrong"
- Error boundaries catch unexpected shapes and show full-page error instead of inline feedback
- Users see broken error UX across the entire application

**Prevention:**
1. Type the error response shape in a shared DTO (`HttpExceptionResponse` already exists) and import it in both backend and frontend
2. Write a contract test: serialize a known error through each filter, assert the exact JSON shape
3. Before modifying any filter, audit every frontend `catch` block and error handler to understand what shape they expect
4. Add an integration test that sends invalid data to a real endpoint and asserts the full response body matches the expected contract
5. If you must change the shape, update frontend error handling in the same PR -- never deploy backend error changes without corresponding frontend changes

**Detection:** Run frontend E2E tests after any backend exception filter change. Grep frontend code for `.message`, `.error`, `.statusCode` property access on error responses.

**Phase mapping:** Error Handling Standardization phase. Must coordinate backend and frontend changes as a single atomic deployment.

---

### Pitfall 4: Query Optimization Introduces Stale Cache Bugs Via Missed Invalidation Paths

**What goes wrong:** You optimize slow queries by adding caching (the codebase already uses Redis caching with TTLs of 30s-5min). You add a new cache for a previously-uncached query, but forget to add the corresponding cache invalidation in `CacheInvalidationService`. Or you split a large query into two smaller ones (e.g., separating `findByIdWithAllRelations()` into `findByIdForList()` and `findByIdForDetail()`) and only invalidate the old cache key pattern, not the new ones.

**Why it happens:** Cache invalidation is event-driven via `CacheInvalidationService` with 20+ `@OnEvent` handlers. Each handler invalidates specific key prefixes (e.g., `orders:list:`, `order:detail:${id}`). When you add a new cache key pattern during optimization, you must also add invalidation to EVERY event handler that could affect that data. With 20+ events and growing, it is easy to miss one. The codebase uses prefix-based invalidation (keys ending with `:` trigger `delByPrefix()`), which helps but does not eliminate the problem for new key patterns.

**Consequences:**
- Users see stale data after updates (e.g., order status changed but list still shows old status)
- Data appears inconsistent between list view and detail view (one cached, other not)
- Intermittent bugs that resolve themselves after TTL expiry (30s-5min), making them hard to reproduce

**Prevention:**
1. For every new cache key, add a comment in the service documenting which events invalidate it
2. Create a cache key registry: a single file listing all cache key patterns and their invalidation triggers
3. Write an integration test per cached query: update the underlying data, then assert the cache is invalidated within the same test
4. Use the `invalidate()` helper's prefix-matching consistently -- design new keys to fall under existing prefixes where possible
5. During PR review, require that any new `cacheService.set()` call is accompanied by a corresponding invalidation in `CacheInvalidationService`

**Detection:** Search for `cacheService.set(` or `cacheService.getOrSet(` calls and cross-reference each cache key pattern with `CacheInvalidationService` event handlers. Any key pattern not covered by at least one invalidation handler is a bug.

**Phase mapping:** Query Optimization phase. Cache additions must be paired with invalidation logic. Never optimize queries by adding cache without simultaneously adding invalidation.

---

### Pitfall 5: FSM Test Coverage Gaps Create False Confidence in State Machine Correctness

**What goes wrong:** You write tests for all 9 FSMs covering the happy path transitions (CONSULTING -> QUOTATION -> PENDING_DEPOSIT -> ... -> COMPLETED). Tests pass. You declare the FSMs "verified." But you missed testing: (a) transitions that should be BLOCKED (e.g., MHH orders skipping PENDING_DEPOSIT), (b) concurrent status transitions on the same order, (c) service-type-specific rules that diverge between MHH and VCT, (d) the interaction between `OrderStatusMachine.validateTransition()` and `DepositGateService` which duplicate the MHH deposit rule.

**Why it happens:** FSM tests naturally gravitate toward "can I go from A to B?" (positive paths). The critical bugs hide in "can I go from A to C when I shouldn't be able to?" (negative paths) and "what happens when two transitions fire simultaneously?" (race conditions). The `OrderStatusMachine` delegates to external transition maps in `@common/constants` and applies service-type overrides on top -- testing the machine alone does not test the integration.

**Consequences:**
- Orders skip mandatory states (e.g., MHH order goes QUOTATION -> SOURCING without deposit)
- Terminal states escape: order in COMPLETED transitions to an unexpected state
- Race condition: two concurrent `changeStatus()` calls both read the same current status and both succeed, leaving audit trail inconsistent
- Duplicate MHH deposit rule diverges between `OrderStatusMachine` and `DepositGateService`, allowing bypass through one path

**Prevention:**
1. For each FSM, write explicit NEGATIVE tests: assert that every invalid transition throws `BadRequestException`. Test ALL `from`/`to` combinations in a matrix
2. Test service-type variations: for Order FSM, test both MHH and VCT service types for every transition
3. Write integration tests that exercise the full `orderStatusService.changeStatus()` path (not just the machine) including database writes, event emission, and cache invalidation
4. Add a concurrency test: two parallel `changeStatus()` calls on the same order -- verify exactly one succeeds via database-level optimistic locking or row-level locks
5. Verify `DepositGateService` and `OrderStatusMachine` agree on MHH rules by testing both with the same inputs and asserting identical results

**Detection:** Count the number of test cases vs. the number of possible transitions. For 17 statuses, there are 17*16 = 272 possible transitions. Most should be invalid. If your test suite has <50 assertions per FSM, you are likely missing negative paths.

**Phase mapping:** FSM Testing phase. Negative path tests are MORE important than positive path tests for state machines.

---

## Moderate Pitfalls

### Pitfall 6: N+1 Query "Fixes" That Introduce Over-Fetching

**What goes wrong:** You find N+1 patterns in `order-read.service.ts` (890 lines) where service always includes all relations. You "fix" by splitting into `findByIdForList()` (minimal fields) and `findByIdForDetail()` (full relations). But controllers that previously called the single method now need to be updated to call the correct variant. Some controllers call the wrong variant and either: (a) over-fetch in list endpoints, wasting bandwidth and database resources, or (b) under-fetch in detail endpoints, causing `undefined` errors when the frontend accesses missing relations.

**Prevention:**
1. Map every controller method to the data it actually needs before splitting queries
2. Use TypeScript's type system: make `findByIdForList()` return `OrderListItem` (subset type) and `findByIdForDetail()` return `OrderDetail` (full type). Compile-time errors catch mismatches
3. Add Prisma query logging middleware to integration tests and assert query count per endpoint

**Phase mapping:** Query Optimization phase.

---

### Pitfall 7: Adding Database Indexes on Production Tables Causes Lock Contention

**What goes wrong:** You identify missing indexes on high-traffic tables (Order, Package, AuditLog). You create a migration with `CREATE INDEX`. On a table with millions of rows, this takes a `ACCESS EXCLUSIVE` lock by default, blocking all reads and writes for seconds to minutes. Production halts during migration.

**Prevention:**
1. Always use `CREATE INDEX CONCURRENTLY` for production tables (Prisma does NOT support this natively -- use raw SQL migrations)
2. The codebase already has migration files using performance indexes (`20260317_performance_indexes/`). Verify they use `CONCURRENTLY`
3. Run index creation during low-traffic hours with `SET statement_timeout = '30s'` to abort if it takes too long
4. Test index creation time on a production-size dataset in staging before deploying

**Phase mapping:** Query Optimization phase. Database operations require ops coordination, not just code changes.

---

### Pitfall 8: Decimal/Currency Precision Loss During Error Handling Refactoring

**What goes wrong:** During error handling standardization, you serialize `Decimal` values (from `@prisma/client/runtime/library`) in error messages or logging. `JSON.stringify()` on a Prisma `Decimal` produces `"0.1"` (string), not `0.1` (number). If you change error serialization to convert Decimal to Number for logging, you introduce floating-point precision loss on financial calculations. Or you add error context that accidentally rounds a `totalAmount` in the log message.

**Prevention:**
1. Never convert `Decimal` to `number` -- use `.toString()` or `.toFixed()` for display
2. Keep `Decimal` types through the entire pipeline; only convert at the API response boundary
3. Add a linting rule or code review checklist item for `Number()` or `parseFloat()` calls on Decimal values in financial modules

**Phase mapping:** Error Handling Standardization phase. Financial modules (order, cash, commission, accounts-receivable) need special care.

---

### Pitfall 9: Transaction Boundary Mismatch Between Service and Listener

**What goes wrong:** An `OrderService.updateStatus()` method runs in a Prisma `$transaction` (63 files use `$transaction`). It updates the order status, writes to audit log, then emits an event. The listener receives the event and reads the order -- but the transaction has not committed yet. The listener reads the OLD status. Or: the transaction rolls back AFTER the event was emitted, and the listener has already acted on stale data (e.g., created a commission record for an order that was never actually completed).

**Prevention:**
1. Emit events AFTER the transaction commits, not inside it. Use a pattern like: `const result = await this.prisma.$transaction(...); this.eventEmitter.emit('order.status.changed', result);`
2. The codebase has an `outbox.service.ts` -- consider using the transactional outbox pattern where events are written to a database table inside the transaction and processed by a separate worker after commit
3. Make all listeners idempotent -- if they receive the same event twice (or an event for a rolled-back transaction), they should be harmless

**Phase mapping:** Error Handling Standardization phase. This is the most insidious transaction bug because it works 99% of the time (transactions commit fast) and fails under load.

---

### Pitfall 10: Data Scope Guard Bypass During RBAC Hardening

**What goes wrong:** The codebase has `DataScopeGuard` and `DataScopeFilter` that restrict data by role (e.g., SALE sees only their own customers' orders). During RBAC hardening, you verify `@Roles()` coverage but forget to verify `@DataScope()` coverage. Result: a SALE user has the right role to access the orders endpoint, but the data scope filter is missing, so they see ALL orders -- not just their customers' orders.

**Prevention:**
1. Audit `@DataScope()` separately from `@Roles()` -- they serve different purposes (action permission vs. data visibility)
2. Write role-specific integration tests that verify a SALE user query returns ONLY orders where `saleId = currentUser.id`
3. Add a startup check that warns if a controller has `@Roles([UserRole.SALE])` but no `@DataScope()` decorator

**Phase mapping:** RBAC Verification phase. Data scoping is the second half of authorization -- role checks alone are insufficient.

---

## Minor Pitfalls

### Pitfall 11: TypeScript `any` Types Survive Error Handling Refactoring

**What goes wrong:** You standardize error handling and add typed error responses. But the `where: any = {}` pattern in `order-read.service.ts` (lines 43, 91) and similar dynamic query builders means type safety is already compromised. During refactoring, you trust the types but the runtime values are untyped, leading to Prisma validation errors that your new exception filter catches differently than before.

**Prevention:**
1. Replace `any` with `Prisma.OrderWhereInput` in query builders
2. Add DTO-level validation (`class-validator`) before values reach the repository layer
3. Run existing E2E tests (the codebase has Playwright E2E tests) after every error handling change

**Phase mapping:** Error Handling Standardization phase.

---

### Pitfall 12: Removing console.log Stubs Breaks Expected Error Paths

**What goes wrong:** Notification services use `console.log` as placeholders for email/SMS (documented in CONCERNS.md). During hardening, you "clean up" by removing these console.log calls or replacing them with proper Logger calls. But some code paths depend on the notification "succeeding" (the console.log never throws). If you replace with a real implementation or a throw-on-not-implemented pattern, upstream callers that do not handle the error will break.

**Prevention:**
1. Notification stubs should remain as stubs with proper logging until the integration milestone
2. If you must change them, replace `console.log` with `this.logger.warn('Notification channel not implemented')` -- same behavior, proper logging framework
3. Never add `throw new NotImplementedException()` to a notification path that is called from event listeners -- the listener will fail silently (see Pitfall 1)

**Phase mapping:** Error Handling Standardization phase. Stubs are explicitly out of scope for this milestone per PROJECT.md.

---

### Pitfall 13: Test Fixtures Become Tightly Coupled to Database State

**What goes wrong:** You write FSM integration tests that create orders in the database with specific statuses. Tests pass in isolation but fail when run together because test A leaves an order in COMPLETED status that interferes with test B's assertions. The `cleanDatabase()` method in PrismaService exists but deleting all data between tests is slow with 95+ models.

**Prevention:**
1. Use unique IDs per test (UUIDs) and filter assertions by those IDs
2. Use Prisma's `$transaction` with rollback for test isolation instead of `cleanDatabase()`
3. Create test factories (the codebase has test factories from recent FSM test commits) that generate unique, isolated test data
4. Run tests with `--runInBand` for integration tests to avoid parallel state conflicts

**Phase mapping:** FSM Testing phase.

---

### Pitfall 14: Materialized View Refresh Blocking Production Queries

**What goes wrong:** The codebase has migrations for materialized views (`20260317_performance_materialized_views/`, `20260317_add_reporting_materialized_views/`). During query optimization, you add `REFRESH MATERIALIZED VIEW` calls on a schedule. But `REFRESH MATERIALIZED VIEW` takes an exclusive lock, blocking all reads of that view until refresh completes. On large datasets, this can take 10+ seconds, causing dashboard timeouts.

**Prevention:**
1. Use `REFRESH MATERIALIZED VIEW CONCURRENTLY` (requires a unique index on the materialized view)
2. Schedule refreshes during off-peak hours
3. Add a timeout to the refresh query: `SET statement_timeout = '10s'` before the refresh
4. Monitor refresh duration and alert if it exceeds 5 seconds

**Phase mapping:** Query Optimization phase.

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Severity | Mitigation |
|-------|---------------|----------|------------|
| Error Handling Standardization | P1: Removing try-catch from event listeners | Critical | Keep catch-and-log, add DLQ retry + metrics |
| Error Handling Standardization | P3: Changing error response shape | Critical | Type the response contract, test frontend integration |
| Error Handling Standardization | P8: Decimal serialization in error context | Moderate | Never convert Decimal to Number for logging |
| Error Handling Standardization | P9: Emitting events inside uncommitted transactions | Moderate | Emit after commit, use outbox pattern |
| Error Handling Standardization | P12: Replacing console.log stubs with throws | Minor | Keep stubs as-is, change to Logger.warn only |
| Query Optimization | P4: Adding cache without invalidation | Critical | Cache key registry, pair every set with invalidation |
| Query Optimization | P6: Splitting queries without updating callers | Moderate | Use distinct return types per query variant |
| Query Optimization | P7: Index creation locking production tables | Moderate | CREATE INDEX CONCURRENTLY, test on staging |
| Query Optimization | P14: Materialized view refresh blocking reads | Minor | REFRESH CONCURRENTLY with unique index |
| RBAC Verification | P2: Adding wrong roles to endpoints | Critical | Role-endpoint matrix with business sign-off |
| RBAC Verification | P10: Missing DataScope after adding Roles | Moderate | Audit @DataScope separately from @Roles |
| FSM Testing | P5: Positive-only test coverage | Critical | Negative path matrix, concurrency tests |
| FSM Testing | P13: Test fixture state pollution | Minor | Unique IDs per test, transaction rollback isolation |

---

## Cross-Cutting Warning: The "Big Bang" Hardening Anti-Pattern

The single most dangerous pattern across all phases is attempting to harden everything at once. Each pitfall above is manageable in isolation. Combined, they create a compounding risk:

1. Error handling refactoring changes how listeners behave (P1, P3)
2. RBAC changes lock out users who report bugs as "the system is broken" (P2)
3. Query optimizations introduce stale data that makes the FSM bugs harder to reproduce (P4, P5)
4. All of these deploy simultaneously, making it impossible to identify which change caused which regression

**Prevention:** Deploy hardening changes in small, independent batches. Each batch should be deployable and rollbackable independently. Never combine error handling changes with RBAC changes with query optimizations in a single release.

---

## Sources

- Codebase analysis: `tbs-erp-backend/src/core/rbac/guards/roles.guard.ts` (default-allow pattern, line 23)
- Codebase analysis: `tbs-erp-backend/src/core/cache/cache-invalidation.service.ts` (20+ event handlers, prefix-based invalidation)
- Codebase analysis: `tbs-erp-backend/src/modules/order/listeners/warehouse-updated.listener.ts` (catch-and-log pattern)
- Codebase analysis: `tbs-erp-backend/src/modules/order/domain/order-status.machine.ts` (MHH rule duplication with DepositGateService)
- Codebase analysis: `tbs-erp-backend/src/common/filters/prisma-exception.filter.ts` (error response shape)
- Codebase analysis: `tbs-erp-backend/src/common/filters/http-exception.filter.ts` (error response shape)
- Codebase analysis: `tbs-erp-backend/src/core/database/prisma.service.ts` (transaction retry, connection pooling)
- [NestJS Exception Filters Official Docs](https://docs.nestjs.com/exception-filters)
- [NestJS Events Official Docs](https://docs.nestjs.com/techniques/events)
- [Prisma Query Optimization Docs](https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance)
- [Prisma Performance Best Practices](https://www.prisma.io/docs/orm/more/best-practices)
- [NestJS Error Handling Patterns - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/error-handling-nestjs/)
- [Prisma + NestJS Error Handling](https://www.ivanstepanian.com/en/blog/prisma-and-nestjs-error-handling-made-easy)
- [nestjs-prisma Exception Filter](https://nestjs-prisma.dev/docs/exception-filter/)
- [NestJS Event Emitter Event Loss Issue #1063](https://github.com/nestjs/event-emitter/issues/1063)
- [NestJS RBAC Authorization Guide - Permit.io](https://www.permit.io/blog/how-to-protect-a-url-inside-a-nestjs-app-using-rbac-authorization)
- [Prisma Race Condition Discussion #10709](https://github.com/prisma/prisma/discussions/10709)

---

*Pitfalls audit: 2026-03-18*
