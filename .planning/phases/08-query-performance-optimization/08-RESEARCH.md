# Phase 8: Query Performance Optimization - Research

**Researched:** 2026-03-19
**Domain:** Prisma query optimization, PostgreSQL indexing, NestJS structured logging
**Confidence:** HIGH

## Summary

Phase 8 is a well-scoped hardening phase with four distinct tasks: (1) replace `include` with `select` projections on 3 list endpoints, (2) add missing database indexes, (3) replace all `console.log` with NestJS Logger, and (4) verify/fix slow query logging at the 500ms threshold. The codebase is already well-structured for these changes -- OrderReadService already uses `select` projections, ContainerRepository and CrmRepository still use `include` in their list endpoints and need conversion.

The console.log audit reveals only ~5 occurrences in production service code (ElkLoggerService uses console intentionally as its fallback output mechanism, so those are correct). The existing QueryAnalyzerService provides development-time EXPLAIN ANALYZE but does NOT implement runtime 500ms threshold logging. The PrismaService already logs slow queries at 200ms threshold -- the requirement is to adjust this to 500ms and add EXPLAIN ANALYZE output. The prisma-performance.extension.ts also logs at 200ms but at the Prisma operation level (not raw SQL), so it cannot provide EXPLAIN ANALYZE.

**Primary recommendation:** Focus changes on (a) converting container.repository.ts `findAll` and crm.repository.ts `findMany` from `include` to `select`, (b) adding composite indexes via Prisma migration, (c) a small console.log cleanup pass, and (d) adjusting the PrismaService slow query threshold from 200ms to 500ms with EXPLAIN ANALYZE integration.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Focus on the 3 list endpoints: order list, container list, CRM customer list
- Replace `include` with `select` projections -- only fetch fields needed for list view
- Keep `include` for detail/single-record endpoints
- Audit `order-read.service.ts`, `container.repository.ts`, `crm.repository.ts` for N+1 patterns
- Add indexes via Prisma `@@index()` declarations
- Must index: order status, customer ID, created date, container status, orderItem.orderId, subOrder.orderId, auditLog.entityId+entityType, complaint.status+customerId
- Replace all `console.log` with injected NestJS Logger (only 23 occurrences across 5 files)
- Scripts (like verify-setup.ts) can keep console.log
- Use existing per-class Logger pattern: `private readonly logger = new Logger(ClassName.name)`
- Verify/fix QueryAnalyzerService and prisma-performance.extension.ts for 500ms threshold
- Wire slow query output into ElkLoggerService for structured logging

### Claude's Discretion
- Exact select projection fields per list endpoint
- Additional indexes beyond the specified ones
- Whether QueryAnalyzerService needs fixes or just verification
- How to handle console.log in test files (leave as-is)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERF-01 | List endpoints use `select` projections instead of `include` for all relations | Container `findAll` and CRM `findMany` use `include` -- need conversion; OrderReadService already uses `select` |
| PERF-02 | Missing database indexes identified and added for frequently filtered/sorted columns | Most critical indexes already exist; CONTEXT.md specifies additional ones to add |
| PERF-03 | All modules use injected NestJS logger instead of `console.log` | Only ~5 production code occurrences need replacement; scripts and ELK fallback mechanism excluded |
| PERF-04 | Slow query logging enabled -- queries exceeding 500ms are logged with EXPLAIN ANALYZE | Current threshold is 200ms in PrismaService; EXPLAIN ANALYZE not currently wired for runtime logging |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma ORM | (project version) | Database ORM with `select`/`include` query builder | Already in stack; `select` projections are Prisma's built-in optimization path |
| @nestjs/common Logger | (project version) | Structured per-class logging | Already established pattern throughout codebase |
| PostgreSQL | (project version) | Database with EXPLAIN ANALYZE support | Already in stack; native query analysis |

### Supporting
No additional libraries needed. This phase uses only existing stack components.

## Architecture Patterns

### Pattern 1: Select Projections for List Endpoints
**What:** Replace `include: { relatedModel: true }` with `select: { field1: true, field2: true, relatedModel: { select: { id: true, name: true } } }` in list (findMany) queries.
**When to use:** Any endpoint that returns lists/tables where the UI only needs a subset of fields.
**Why:** `include` fetches ALL columns of the related model. `select` fetches only the specified columns, reducing data transfer and PostgreSQL work.

**Current state of the 3 target endpoints:**

1. **OrderReadService.getOrderList()** -- ALREADY uses `select` projections (lines 71-81). No changes needed.
2. **ContainerRepository.findAll()** -- Uses `include: { _count: { select: { packages: true, orders: true } } }`. This is acceptable for counts but fetches all Container scalar columns. Should convert to `select` to limit scalar fields.
3. **CrmRepository.findMany()** -- Uses `include: { contacts: true, wallet: true }`. This fetches ALL contact rows and wallet for every customer in the list. Must convert to `select` with only list-view fields.

**Example (CRM list conversion):**
```typescript
// BEFORE (current):
this.prisma.customer.findMany({
  where,
  include: {
    contacts: true,   // Fetches ALL contact columns for ALL contacts
    wallet: true,      // Fetches full wallet data
  },
  orderBy: query.orderBy,
  skip: query.skip,
  take: query.limit,
});

// AFTER (optimized):
this.prisma.customer.findMany({
  where,
  select: {
    id: true,
    code: true,
    fullName: true,
    companyName: true,
    phone: true,
    email: true,
    tier: true,
    branch: true,
    saleId: true,
    isActive: true,
    isBlocked: true,
    totalOrders: true,
    totalRevenue: true,
    currentDebt: true,
    createdAt: true,
    // Only count contacts, don't load them
    _count: { select: { contacts: true } },
  },
  orderBy: query.orderBy,
  skip: query.skip,
  take: query.limit,
});
```

### Pattern 2: Index Declarations in Prisma Schema
**What:** Use `@@index([column])` or `@@index([col1, col2])` in Prisma schema files.
**When to use:** When queries filter or sort by specific columns frequently.

**Composite index rule of thumb:** Column order matters. Put the most selective (highest cardinality) column first, or the column used in equality matches first.

### Pattern 3: Slow Query Logging with EXPLAIN ANALYZE
**What:** PrismaService `$on('query')` event handler that triggers EXPLAIN ANALYZE for queries exceeding threshold.
**Key constraint:** Prisma's query event gives us the SQL and duration AFTER execution. Running EXPLAIN ANALYZE requires re-executing the query with EXPLAIN prefix, which has a performance cost. For production, we should only do this for queries significantly over the threshold (e.g., >500ms), and we should run EXPLAIN (not EXPLAIN ANALYZE to avoid re-execution) or log only the SQL for later manual analysis.

**Safer approach:** Log the SQL, params, and duration for queries >500ms. Running EXPLAIN ANALYZE in production on every slow query would double the load. Instead, log enough info for a DBA to investigate offline.

### Anti-Patterns to Avoid
- **Running EXPLAIN ANALYZE on every slow query in production:** This re-executes the query. Instead, log the SQL statement and duration, and use EXPLAIN (without ANALYZE) which only plans without executing.
- **Over-indexing:** Each index slows writes. Only add indexes for columns actually used in WHERE/ORDER BY clauses.
- **Changing `include` to `select` on detail endpoints:** Detail views need full data. Only optimize list endpoints.
- **Removing console.log from ElkLoggerService's `logToConsole()`:** This is the logger's fallback output mechanism -- it MUST use console directly since it IS the logger implementation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Query timing | Custom middleware | Prisma `$on('query')` event | Built-in, captures all queries with duration |
| Index suggestions | Manual EXPLAIN runs | QueryAnalyzerService.suggestIndexes() | Already exists, uses pg_stat_user_tables |
| Structured logging | Custom JSON formatter | ElkLoggerService + NestJS Logger | Already exists in codebase |

## Common Pitfalls

### Pitfall 1: Breaking the Return Type When Converting include to select
**What goes wrong:** The TypeScript return type changes from `Customer` to a partial type when using `select`. Callers expecting full `Customer` objects will get type errors.
**Why it happens:** Prisma `select` returns only selected fields, changing the inferred type.
**How to avoid:** Update the repository method's return type to match the new shape, or use a DTO/interface for list items. For the `findMany` method, change the return type from `Customer[]` to a narrower interface.
**Warning signs:** TypeScript compilation errors after the change.

### Pitfall 2: Forgetting to Update Frontend Expectations
**What goes wrong:** Frontend accesses fields that are no longer returned by the list endpoint.
**Why it happens:** `select` projection means some fields disappear from list responses.
**How to avoid:** Check what fields the frontend list views actually use before choosing the select projection. The CONTEXT.md explicitly says this is a backend-only change within this hardening scope, but verify the API contract is maintained.
**Warning signs:** Frontend console errors accessing undefined properties.

### Pitfall 3: EXPLAIN ANALYZE Double-Execution
**What goes wrong:** Running EXPLAIN ANALYZE on every slow query doubles database load.
**Why it happens:** EXPLAIN ANALYZE actually executes the query to measure real performance.
**How to avoid:** Use EXPLAIN (without ANALYZE) for production, or simply log the SQL + duration for manual investigation. Only use EXPLAIN ANALYZE in dev/staging.
**Warning signs:** Increased database CPU/latency after deploying slow query logging.

### Pitfall 4: Index Migration on Production Tables
**What goes wrong:** CREATE INDEX on large tables locks the table, blocking reads/writes.
**Why it happens:** Default CREATE INDEX is blocking.
**How to avoid:** Prisma generates standard CREATE INDEX. For production deployment, ensure `CREATE INDEX CONCURRENTLY` is used. Prisma migrations don't use CONCURRENTLY by default, so the generated migration SQL may need manual adjustment for production deployment.
**Warning signs:** The STATE.md already flags: "Index creation on production tables needs staging validation before production deployment."

### Pitfall 5: ElkLoggerService console.log Is Intentional
**What goes wrong:** Replacing ElkLoggerService's `logToConsole()` method's console.log/error/warn/debug calls with NestJS Logger would create infinite recursion since ElkLoggerService IS the NestJS logger.
**Why it happens:** ElkLoggerService implements LoggerService -- it IS the logger backend. It must use console.* as its final output.
**How to avoid:** Leave ALL console.* calls inside `logToConsole()` untouched. Also leave the `connect()` and `sendToLogstash()` console.log/warn calls -- these are bootstrap/infrastructure logging before the logger itself is fully connected.
**Warning signs:** Stack overflow or missing log output.

## Code Examples

### Existing Select Projection Pattern (OrderReadService -- already correct)
```typescript
// Source: tbs-erp-backend/src/modules/order/order-read.service.ts lines 69-87
this.prisma.order.findMany({
  where,
  select: {
    id: true,
    code: true,
    status: true,
    serviceType: true,
    branch: true,
    totalAmount: true,
    currency: true,
    createdAt: true,
    customer: { select: { id: true, fullName: true, code: true } },
  },
  orderBy: { createdAt: 'desc' },
  skip: (page - 1) * limit,
  take: limit,
});
```

### Container List Conversion (needs change)
```typescript
// BEFORE: container.repository.ts findAll() lines 46-58
// Uses include with _count -- fetches all scalar columns
this.prisma.container.findMany({
  where,
  skip,
  take,
  orderBy,
  include: {
    _count: { select: { packages: true, orders: true } },
  },
});

// AFTER: select only fields needed for list view
this.prisma.container.findMany({
  where,
  skip,
  take,
  orderBy,
  select: {
    id: true,
    code: true,
    status: true,
    shippingRoute: true,
    carrier: true,
    totalPackages: true,
    totalWeight: true,
    fillRate: true,
    estimatedDepartureAt: true,
    estimatedArrivalAt: true,
    actualDepartureAt: true,
    actualArrivalAt: true,
    createdAt: true,
    _count: { select: { packages: true, orders: true } },
  },
});
```

### NestJS Logger Pattern (established)
```typescript
// Already used throughout codebase:
private readonly logger = new Logger(ClassName.name);
this.logger.log('Message');
this.logger.warn('Warning message');
this.logger.error('Error message', error.stack);
```

### Slow Query Logging Enhancement
```typescript
// Current: PrismaService constructor, line 89-96
// Logs at 200ms warn, 2000ms error -- no EXPLAIN output
this.$on('query', (event: Prisma.QueryEvent) => {
  if (event.duration > 2000) {
    this.logger.error(`CRITICAL slow query (${event.duration}ms): ${event.query.substring(0, 200)}`);
  } else if (event.duration > 200) {
    this.logger.warn(`Slow query (${event.duration}ms): ${event.query.substring(0, 200)}`);
  }
});

// Target: Change threshold to 500ms, log full SQL + params
// EXPLAIN ANALYZE should be optional/dev-only to avoid production overhead
this.$on('query', (event: Prisma.QueryEvent) => {
  if (event.duration > 2000) {
    this.logger.error(
      `CRITICAL slow query (${event.duration}ms) | SQL: ${event.query} | Params: ${event.params}`,
    );
  } else if (event.duration > 500) {
    this.logger.warn(
      `Slow query (${event.duration}ms) | SQL: ${event.query} | Params: ${event.params}`,
    );
  }
});
```

## Detailed Audit Findings

### Console.log Inventory (Backend src/)

| File | Line | Type | Action |
|------|------|------|--------|
| `core/logger/elk-logger.service.ts:155` | `console.error(formattedMsg, ...)` | ELK fallback output | KEEP -- is the logger itself |
| `core/logger/elk-logger.service.ts:158` | `console.warn(formattedMsg)` | ELK fallback output | KEEP -- is the logger itself |
| `core/logger/elk-logger.service.ts:161` | `console.debug(formattedMsg)` | ELK fallback output | KEEP -- is the logger itself |
| `core/logger/elk-logger.service.ts:164` | `console.log(formattedMsg)` | ELK fallback output | KEEP -- is the logger itself |
| `core/logger/elk-logger.service.ts:182` | `console.warn('[ELK] Buffer full...')` | ELK infra warning | KEEP -- pre-logger bootstrap |
| `core/logger/elk-logger.service.ts:207` | `console.log('[ElkLogger] Connected...')` | ELK connection log | KEEP -- pre-logger bootstrap |
| `core/logger/elk-logger.service.ts:213` | `console.warn('[ElkLogger] error...')` | ELK error | KEEP -- pre-logger bootstrap |
| `core/auth/auth.service.ts:103` | String literal in error message | Not actual console.log call | NO ACTION -- just a string mentioning console.log in an error message |
| `core/encryption/encryption.service.ts:45` | String literal in error message | Not actual console.log call | NO ACTION -- just a string mentioning console.log in a help message |
| `main.ts.monitoring:94` | `console.log(...)` | Monitoring script | KEEP -- standalone script |
| `modules/commission/scripts/verify-setup.ts` | 15+ occurrences | CLI verification script | KEEP -- runs outside NestJS context |
| `modules/migration/migrate-legacy-ar.script.ts:430` | `console.error(...)` | Migration script | KEEP -- runs outside NestJS context |

**Conclusion:** After careful audit, there are ZERO `console.log` calls in production NestJS service code that need replacement. The CONTEXT.md mentioned "23 occurrences across 5 files" but the actual grep shows:
- ElkLoggerService uses console.* intentionally (7 occurrences) -- it IS the logger
- auth.service.ts and encryption.service.ts have string literals mentioning `console.log` in help text -- not actual calls
- Scripts (verify-setup.ts, migrate-legacy-ar.script.ts) run outside NestJS -- excluded per CONTEXT.md decision
- main.ts.monitoring is a standalone monitoring config -- not a NestJS service

**This means PERF-03 may already be satisfied**, or the scope reduces to verifying there are no console.log calls in service code and documenting this finding.

### Index Audit

**Already indexed (from schema files):**

| Table | Indexed Columns | Status |
|-------|----------------|--------|
| orders | status, customerId, createdAt, saleId, containerId, status+createdAt, customerId+status, saleId+status | DONE |
| containers | status, createdAt, status+createdAt, shippingRoute+status | DONE |
| customers | saleId, tier, saleId+isActive, tier+isActive, phone, isActive+createdAt | DONE |
| order_items | orderId, orderId+deletedAt | DONE |
| audit_logs | entity+entityId, userId+createdAt, userId, action, createdAt | DONE |
| complaints | customerId+status, status+severity, status+createdAt, handlerId+status | DONE |
| packages | orderId, containerId, warehouseCNStatus, warehouseVNStatus | DONE |

**CONTEXT.md requested indexes vs. existing:**

| Requested | Current State | Action Needed |
|-----------|---------------|---------------|
| Order status | `@@index([status])` exists | NONE |
| Customer ID (on orders) | `@@index([customerId])` exists | NONE |
| Created date (on orders) | `@@index([createdAt])` exists | NONE |
| Container status | `@@index([status])` exists | NONE |
| orderItem.orderId | `@@index([orderId])` exists | NONE |
| subOrder.orderId | No SubOrder model exists | N/A -- SubOrder does not exist in schema |
| auditLog.entityId+entityType | `@@index([entity, entityId])` exists | NONE |
| complaint.status+customerId | `@@index([customerId, status])` exists | NONE (order reversed but composite covers both queries) |

**Finding: All requested indexes already exist.** The CONTEXT.md indexes are already present in the Prisma schema files. Any additional indexes should come from Claude's discretion analysis of query patterns.

**Potential additional indexes (Claude's discretion):**
- AccountReceivable: `customerId + status` -- used in CrmRepository.getCustomerDebts() with `groupBy` on customerId WHERE status IN [...]. Check if exists.
- PaymentVoucher: `supplierOrderId` -- used in OrderReadService 360 view. Check if exists.

### Slow Query Logging Audit

| Component | Current Threshold | Logs SQL? | Logs EXPLAIN? | Action |
|-----------|------------------|-----------|---------------|--------|
| PrismaService `$on('query')` | warn: 200ms, error: 2000ms | First 200 chars only | No | Adjust to 500ms, log full SQL |
| prisma-performance.extension.ts | warn: 200ms, error: 2000ms | No (logs model.operation + args) | No | Adjust to 500ms to match |
| DatabaseMonitorService | Polls pg_stat_activity for >5s queries | Yes (200 chars) | No | No change needed -- different purpose |
| QueryAnalyzerService | N/A (on-demand, dev only) | Yes | Yes | No change needed -- dev tool |

**Finding:** The 500ms threshold requirement is NOT met. Current threshold is 200ms. Need to:
1. Change PrismaService threshold from 200ms to 500ms (warn) and 2000ms to 5000ms or keep 2000ms (error)
2. Change prisma-performance.extension.ts thresholds to match
3. Log full SQL + params (not truncated to 200 chars) for queries >500ms
4. For EXPLAIN ANALYZE: log only in non-production, or use EXPLAIN (no ANALYZE) in production

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest |
| Config file | `tbs-erp-backend/jest.config.js` |
| Quick run command | `cd tbs-erp-backend && npx jest --testPathPattern="<pattern>" --no-coverage` |
| Full suite command | `cd tbs-erp-backend && npx jest --no-coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | List endpoints use select projections | manual-only | Visual code review -- verify `select` keyword present in findAll/findMany | N/A |
| PERF-02 | Database indexes declared in schema | unit | `cd tbs-erp-backend && npx jest --testPathPattern="index" --no-coverage` | No -- Wave 0 |
| PERF-03 | No console.log in production service code | unit | `grep -r "console\.\(log\|warn\|error\|debug\)" src/ --include="*.ts" \| grep -v scripts/ \| grep -v elk-logger` | N/A -- grep verification |
| PERF-04 | Slow query logging at 500ms threshold | manual-only | Review PrismaService constructor code for 500ms threshold | N/A |

### Sampling Rate
- **Per task commit:** Verify changed files compile: `cd tbs-erp-backend && npx tsc --noEmit`
- **Per wave merge:** Full test suite: `cd tbs-erp-backend && npx jest --no-coverage`
- **Phase gate:** All unit tests pass + grep confirms no console.log in service code

### Wave 0 Gaps
None -- this phase's requirements are primarily code changes verifiable through code review and grep. No new test files needed. Existing tests should continue passing after the changes (the select projection changes don't affect test mocks since tests mock at the service/repository level).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `include: { relation: true }` for all queries | `select` projections for list views, `include` for detail views | Prisma best practice since v3 | Significant query performance improvement |
| `console.log` for debugging | NestJS Logger with context | NestJS v7+ | Structured logging, ELK-compatible |
| Manual slow query detection | Prisma query events + pg_stat_activity monitoring | Already implemented | Automated detection and alerting |

## Open Questions

1. **SubOrder model does not exist**
   - What we know: CONTEXT.md mentions "subOrder.orderId" as needing an index
   - What's unclear: There is no `SubOrder` model in the Prisma schema. The `Order` model has a `masterOrderId` field linking to `MasterOrder`, but no separate SubOrder table.
   - Recommendation: Skip this index. The Order model already has `@@index([masterOrderId])` which serves the same purpose.

2. **Console.log count discrepancy**
   - What we know: CONTEXT.md states "23 occurrences across 5 files" but audit shows zero production console.log calls needing replacement
   - What's unclear: The count may have included script files, string literals, and ElkLoggerService's intentional console usage
   - Recommendation: Document the audit finding. PERF-03 may already be satisfied. Verify during implementation.

3. **EXPLAIN ANALYZE in production**
   - What we know: Requirement says "logged with EXPLAIN ANALYZE output"
   - What's unclear: Running EXPLAIN ANALYZE re-executes queries, doubling load on slow queries
   - Recommendation: Use EXPLAIN (without ANALYZE) in production for the plan, or simply log SQL + duration for DBA review. EXPLAIN ANALYZE only in dev/staging.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all canonical reference files listed in CONTEXT.md
- Prisma schema files: order.prisma, container.prisma, crm.prisma, auth.prisma, warehouse.prisma, complaint.prisma
- Service files: order-read.service.ts, container.repository.ts, crm.repository.ts
- Infrastructure files: prisma.service.ts, query-analyzer.service.ts, prisma-performance.extension.ts, elk-logger.service.ts, db-monitor.service.ts

### Secondary (MEDIUM confidence)
- Prisma documentation on select vs include performance characteristics
- NestJS Logger documentation on per-class pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed, all existing stack
- Architecture: HIGH -- patterns already established in codebase, direct code analysis
- Pitfalls: HIGH -- identified from actual code analysis, known PostgreSQL behavior
- Console.log audit: HIGH -- exhaustive grep of entire src/ directory
- Index audit: HIGH -- direct comparison of schema files against CONTEXT.md requirements

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain, no fast-moving dependencies)
