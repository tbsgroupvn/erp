# Phase 8: Query Performance Optimization - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Optimize list endpoint queries with select projections, add missing database indexes, replace all console.log with NestJS Logger, and enable slow query logging (500ms threshold). This phase does NOT change business logic, add new endpoints, or modify schemas beyond adding indexes.

</domain>

<decisions>
## Implementation Decisions

### Select Projections (PERF-01)
- Focus on the 3 list endpoints specified in requirements: order list, container list, CRM customer list
- Replace `include` with `select` projections — only fetch fields needed for the list view
- Keep `include` for detail/single-record endpoints (those need full nested data)
- Audit `order-read.service.ts`, `container.repository.ts`, `crm.repository.ts` for N+1 patterns
- Claude has discretion on exactly which fields to select (based on what the frontend list views actually use)

### Database Indexes (PERF-02)
- Add indexes for frequently filtered/sorted columns as specified: order status, customer ID, created date, container status
- Use Prisma `@@index()` declarations in schema files
- Also index: `orderItem.orderId`, `subOrder.orderId`, `auditLog.entityId+entityType`, `complaint.status+customerId`
- Claude has discretion on additional indexes based on codebase audit of common query patterns
- Generate a Prisma migration for the new indexes

### Console.log Replacement (PERF-03)
- Replace all `console.log` with injected NestJS `Logger` service
- Only 23 occurrences across 5 files — small scope
- Key targets: notification service stubs, email service stubs, SMS service stubs, auth service, encryption service
- Scripts (like `verify-setup.ts`) can keep console.log — they run outside NestJS context
- Use existing per-class Logger pattern: `private readonly logger = new Logger(ClassName.name)`

### Slow Query Logging (PERF-04)
- `QueryAnalyzerService` and `prisma-performance.extension.ts` already exist — verify they implement 500ms threshold logging
- If threshold is different or missing, fix it
- Ensure slow queries log: SQL statement, duration, and EXPLAIN ANALYZE output
- Wire into `ElkLoggerService` for structured logging
- Claude has discretion on whether existing implementation is complete or needs fixes

### Claude's Discretion
- Exact select projection fields per list endpoint
- Additional indexes beyond the specified ones
- Whether QueryAnalyzerService needs fixes or just verification
- How to handle console.log in test files (leave as-is)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Query optimization targets
- `tbs-erp-backend/src/modules/order/order-read.service.ts` — Order list queries with includes
- `tbs-erp-backend/src/modules/container/container.repository.ts` — Container list queries
- `tbs-erp-backend/src/modules/crm/crm.repository.ts` — CRM customer list queries

### Database infrastructure
- `tbs-erp-backend/src/core/database/query-analyzer.service.ts` — Existing query analyzer
- `tbs-erp-backend/src/core/database/prisma-performance.extension.ts` — Prisma performance extension
- `tbs-erp-backend/src/core/database/prisma.service.ts` — PrismaService
- `tbs-erp-backend/src/core/database/db-monitor.service.ts` — DB monitoring

### Schema files (for indexes)
- `tbs-erp-backend/prisma/schema/order.prisma` — Order model
- `tbs-erp-backend/prisma/schema/container.prisma` — Container model
- `tbs-erp-backend/prisma/schema/crm.prisma` — CRM models
- `tbs-erp-backend/prisma/schema/schema.prisma` — Main schema

### Logger
- `tbs-erp-backend/src/core/logger/elk-logger.service.ts` — ELK structured logging

### Console.log targets
- `tbs-erp-backend/src/core/auth/auth.service.ts` — Has console.log
- `tbs-erp-backend/src/core/encryption/encryption.service.ts` — Has console.log
- `tbs-erp-backend/src/core/logger/elk-logger.service.ts` — Has console.log (meta)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `QueryAnalyzerService`: Existing slow query analysis — needs verification against 500ms threshold
- `prisma-performance.extension.ts`: Prisma extension for performance monitoring
- `ElkLoggerService`: Structured logging — wire slow query output here
- `Logger`: NestJS built-in logger — per-class pattern already established

### Established Patterns
- Per-class logger: `private readonly logger = new Logger(ClassName.name)`
- Prisma queries: `findMany({ where, include, orderBy, take, skip })`
- Schema indexes: `@@index([field1, field2])` in .prisma files

### Integration Points
- Order, container, CRM repositories — select projection targets
- Prisma schema files — index additions
- 5 files with console.log — replacement targets
- QueryAnalyzerService — slow query threshold verification

</code_context>

<specifics>
## Specific Ideas

- User delegated all decisions to Claude
- Only 23 console.log occurrences — small cleanup
- QueryAnalyzerService already exists — may only need verification
- Focus on the 3 specified list endpoints first

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-query-performance-optimization*
*Context gathered: 2026-03-19*
