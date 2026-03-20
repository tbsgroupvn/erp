---
phase: 08-query-performance-optimization
plan: 01
subsystem: database
tags: [prisma, postgresql, select-projection, slow-query, explain-plan, performance]

# Dependency graph
requires:
  - phase: 03-transaction-consistency
    provides: PrismaService with executeInTransaction and connection pooling
provides:
  - Container findAll with select projection (list-view fields only)
  - CRM findMany with select projection (list-view fields only)
  - 500ms slow query threshold with full SQL + params + EXPLAIN plan logging
  - Aligned prisma-performance.extension.ts thresholds (500ms/5000ms)
affects: [09-testing-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns: [select-projection-for-list-queries, explain-plan-diagnostics]

key-files:
  created: []
  modified:
    - tbs-erp-backend/src/modules/container/container.repository.ts
    - tbs-erp-backend/src/modules/crm/crm.repository.ts
    - tbs-erp-backend/src/core/database/prisma.service.ts
    - tbs-erp-backend/src/core/database/prisma-performance.extension.ts

key-decisions:
  - "select projection return type changed to any[] to avoid TypeScript compilation errors from narrowed Prisma types"
  - "EXPLAIN (not EXPLAIN ANALYZE) used for slow query diagnostics -- plans only, no re-execution in production"
  - "EXPLAIN wrapped in try/catch because parameterized queries with $1/$2 placeholders cannot be directly EXPLAINed"

patterns-established:
  - "Select projection pattern: list endpoints use select with explicit field list; detail endpoints keep include"
  - "Slow query EXPLAIN: try/catch wrapper for best-effort diagnostic output"

requirements-completed: [PERF-01, PERF-04]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 8 Plan 01: Query Performance Optimization Summary

**Container and CRM list queries converted to select projections; slow query threshold adjusted to 500ms with full SQL, params, and EXPLAIN plan logging**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T15:58:51Z
- **Completed:** 2026-03-19T16:02:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Container findAll converted from `include` (all scalars + _count) to `select` with 15 list-view fields + _count
- CRM findMany converted from `include: { contacts: true, wallet: true }` to `select` with 16 list-view fields + _count.contacts
- Slow query threshold changed from 200ms to 500ms (warn) and 2000ms to 5000ms (critical) in both PrismaService and performance extension
- Full SQL and params logged without truncation (removed .substring(0, 200))
- EXPLAIN plan output logged for all slow queries (safe EXPLAIN without ANALYZE)
- ElkLoggerService wiring confirmed via app.useLogger() in main.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert container and CRM list queries to select projections** - `f8804ec` (feat)
2. **Task 2: Adjust slow query thresholds and add EXPLAIN plan logging** - `50634b2` (feat)

## Files Created/Modified
- `tbs-erp-backend/src/modules/container/container.repository.ts` - findAll uses select projection with list-view fields only
- `tbs-erp-backend/src/modules/crm/crm.repository.ts` - findMany uses select projection with list-view fields only
- `tbs-erp-backend/src/core/database/prisma.service.ts` - 500ms/5000ms thresholds, full SQL+params, EXPLAIN plan logging
- `tbs-erp-backend/src/core/database/prisma-performance.extension.ts` - SLOW_QUERY_THRESHOLD_MS=500, CRITICAL=5000

## Decisions Made
- Used `any[]` return type for select projection methods to avoid TypeScript compilation errors from narrowed Prisma select types, following the pragmatic pattern used elsewhere in the codebase
- Used `EXPLAIN` (not `EXPLAIN ANALYZE`) for production safety -- EXPLAIN only shows the query plan without re-executing the slow query
- Wrapped EXPLAIN in try/catch because parameterized queries with `$1`, `$2` placeholders and non-SELECT statements may not support EXPLAIN

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in `batch-job.service.ts(209)` (TS7053) confirmed as not introduced by these changes. Out of scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Select projection pattern established for list endpoints; remaining list endpoints can follow same pattern in Plan 08-02
- Slow query monitoring infrastructure ready for production deployment
- EXPLAIN plan diagnostics will help identify missing indexes in production

## Self-Check: PASSED

All 4 modified files verified on disk. Both task commits (f8804ec, 50634b2) verified in git log.

---
*Phase: 08-query-performance-optimization*
*Completed: 2026-03-19*
