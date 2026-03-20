---
phase: 01-backend-error-standardization
plan: 01
subsystem: api
tags: [nestjs, error-handling, exception-filter, sentry, prisma, domain-exception]

# Dependency graph
requires: []
provides:
  - DomainException base class extending HttpException with errorCode property
  - Central ErrorCode registry with 50+ string constants across all domains
  - StandardErrorResponse interface with errorCode and requestId fields
  - Updated HttpExceptionFilter with errorCode derivation and requestId
  - Updated PrismaExceptionFilter with DB_* error codes and requestId
  - Updated SentryExceptionFilter with requestId tag and catch-all 500 formatting
  - Consolidated APP_FILTER registration (no more double registration)
affects: [01-backend-error-standardization, error-handling, all-modules]

# Tech tracking
tech-stack:
  added: []
  patterns: [DomainException-for-domain-errors, ErrorCode-registry-constants, StandardErrorResponse-interface, requestId-in-all-error-responses]

key-files:
  created:
    - tbs-erp-backend/src/common/exceptions/domain.exception.ts
    - tbs-erp-backend/src/common/exceptions/error-codes.ts
    - tbs-erp-backend/src/common/exceptions/error-response.interface.ts
    - tbs-erp-backend/src/common/exceptions/index.ts
    - tbs-erp-backend/src/common/exceptions/domain.exception.spec.ts
    - tbs-erp-backend/src/common/filters/http-exception.filter.spec.ts
    - tbs-erp-backend/src/common/filters/prisma-exception.filter.spec.ts
    - tbs-erp-backend/src/common/filters/sentry-exception.filter.spec.ts
  modified:
    - tbs-erp-backend/src/common/filters/http-exception.filter.ts
    - tbs-erp-backend/src/common/filters/prisma-exception.filter.ts
    - tbs-erp-backend/src/common/filters/sentry-exception.filter.ts
    - tbs-erp-backend/src/app.module.ts
    - tbs-erp-backend/src/main.ts

key-decisions:
  - "ErrorCode as const object with string values (not enum) for runtime flexibility and tree-shaking"
  - "SentryExceptionFilter formats 500 response for unknown exceptions instead of re-throwing (no other filter catches raw Error)"
  - "Consolidated all filter registration to APP_FILTER providers in app.module.ts (removed useGlobalFilters from main.ts)"
  - "HttpExceptionFilter registered first in APP_FILTER array so it runs last as fallback"

patterns-established:
  - "DomainException pattern: all domain errors throw DomainException(ErrorCode.X, message, status) instead of raw HttpException"
  - "ErrorCode registry pattern: new error codes added to error-codes.ts constant object, not inline strings"
  - "StandardErrorResponse: all error responses include success, statusCode, errorCode, message, requestId, timestamp, path"
  - "RequestId correlation: all filters read (request as any).requestId and include it in responses and logs"

requirements-completed: [ERR-01, ERR-06]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Phase 1 Plan 1: Error Handling Infrastructure Summary

**DomainException base class with ErrorCode registry, StandardErrorResponse interface, and updated all 3 exception filters with errorCode + requestId in every error response**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T08:02:09Z
- **Completed:** 2026-03-18T08:08:35Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Created DomainException base class extending HttpException with typed errorCode property and 50+ error code constants
- Updated all three exception filters (HTTP, Prisma, Sentry) to include errorCode and requestId in every error response
- Fixed double filter registration bug: removed useGlobalFilters from main.ts, consolidated to APP_FILTER in app.module.ts
- 26 unit tests covering all exception and filter behaviors (TDD approach: RED -> GREEN for both tasks)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create exception infrastructure and error code registry** - `b9817a3` (feat)
2. **Task 2: Update exception filters with errorCode + requestId, fix double registration** - `a3948a5` (feat)

## Files Created/Modified
- `src/common/exceptions/domain.exception.ts` - DomainException base class with errorCode property
- `src/common/exceptions/error-codes.ts` - Central error code registry (50+ constants across 14 domains)
- `src/common/exceptions/error-response.interface.ts` - StandardErrorResponse interface
- `src/common/exceptions/index.ts` - Barrel export for clean imports
- `src/common/exceptions/domain.exception.spec.ts` - 9 unit tests for DomainException and ErrorCode
- `src/common/filters/http-exception.filter.ts` - Added errorCode derivation, requestId, StandardErrorResponse
- `src/common/filters/prisma-exception.filter.ts` - Added DB_* error codes, requestId
- `src/common/filters/sentry-exception.filter.ts` - Added requestId Sentry tag, catch-all 500 formatting
- `src/common/filters/http-exception.filter.spec.ts` - 6 tests for HttpExceptionFilter
- `src/common/filters/prisma-exception.filter.spec.ts` - 7 tests for PrismaExceptionFilter
- `src/common/filters/sentry-exception.filter.spec.ts` - 4 tests for SentryExceptionFilter
- `src/app.module.ts` - Added HttpExceptionFilter as APP_FILTER, 3 filters total
- `src/main.ts` - Removed useGlobalFilters and related imports

## Decisions Made
- ErrorCode as `const` object with string values (not TypeScript enum) for runtime flexibility, tree-shaking, and JSON serialization
- SentryExceptionFilter formats 500 response directly for unknown exceptions (Error, string, etc.) instead of re-throwing, since no other filter would catch them
- All filter registration consolidated to APP_FILTER providers in app.module.ts -- HttpExceptionFilter registered first (runs last as fallback), SentryExceptionFilter registered last (runs first as catch-all)
- RequestId fallback to 'unknown' when middleware hasn't set it (edge case: health checks, static assets)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Jest `-x` flag not recognized (plan had `--no-coverage -x`), resolved by using `--bail` instead. No impact on results.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Error handling infrastructure complete and tested
- DomainException and ErrorCode registry ready for adoption across all modules (Plan 01-02, 01-03, 01-04)
- StandardErrorResponse interface available for frontend error handling updates
- All filters produce consistent error shapes with errorCode and requestId

## Self-Check: PASSED

All 8 created files verified on disk. Both commit hashes (b9817a3, a3948a5) found in git log.

---
*Phase: 01-backend-error-standardization*
*Completed: 2026-03-18*
