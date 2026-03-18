---
phase: 01-backend-error-standardization
plan: 02
subsystem: api
tags: [nestjs, error-handling, domain-exception, error-codes, order, auth, encryption, vault, prisma]

# Dependency graph
requires:
  - phase: 01-backend-error-standardization (plan 01)
    provides: DomainException base class, ErrorCode registry, StandardErrorResponse interface
provides:
  - All core/auth/order/infra service files converted from raw throw new Error to DomainException or NestJS HttpException subclasses
  - Every runtime exception in order, auth, database, vault, encryption modules carries an errorCode
  - ErrorCode constants used consistently across 11 service files
affects: [01-backend-error-standardization, error-handling, all-modules]

# Tech tracking
tech-stack:
  added: []
  patterns: [DomainException-in-service-layer, ErrorCode-constant-per-throw, BadRequestException-for-validation, ForbiddenException-for-access-control]

key-files:
  created: []
  modified:
    - tbs-erp-backend/src/modules/order/order.service.ts
    - tbs-erp-backend/src/modules/order/order.repository.ts
    - tbs-erp-backend/src/modules/order/sagas/order-completion.saga.ts
    - tbs-erp-backend/src/core/auth/auth.service.ts
    - tbs-erp-backend/src/core/auth/api-key-rotation.service.ts
    - tbs-erp-backend/src/core/database/prisma.service.ts
    - tbs-erp-backend/src/core/database/query-analyzer.service.ts
    - tbs-erp-backend/src/core/vault/vault.service.ts
    - tbs-erp-backend/src/core/encryption/encryption.service.ts
    - tbs-erp-backend/src/core/encryption/key-rotation.service.ts
    - tbs-erp-backend/src/common/utils/business-hours.ts

key-decisions:
  - "auth.service.ts constructor TWO_FA_ENCRYPTION_KEY check converted to DomainException(INTERNAL_ERROR) since acceptance criteria requires zero raw throws in the file"
  - "query-analyzer.service.ts uses ForbiddenException for production block and BadRequestException for input validation (NestJS built-in HTTP exceptions)"
  - "Config boot files and retry.util left unchanged as specified in plan"

patterns-established:
  - "Service-layer errors always throw DomainException(ErrorCode.X, message, HttpStatus.Y) or NestJS HttpException subclass"
  - "Order domain: ORDER_NOT_FOUND (404), ORDER_ALREADY_COMPLETED (409), ORDER_ALREADY_CANCELLED (409), ORDER_CREATION_FAILED (500)"
  - "Auth domain: API_KEY_NOT_FOUND (404) for missing keys, INTERNAL_ERROR (500) for missing env config"
  - "Infrastructure: ENCRYPTION_ERROR (500), VAULT_ERROR (500), TRANSACTION_ERROR (500)"

requirements-completed: [ERR-02]

# Metrics
duration: 3min
completed: 2026-03-18
---

# Phase 1 Plan 2: Core/Auth/Order/Infra Error Conversion Summary

**Converted 11 service files from raw throw new Error to DomainException with ErrorCode constants, eliminating all untyped exceptions in order, auth, database, vault, and encryption modules**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T08:12:26Z
- **Completed:** 2026-03-18T08:16:13Z
- **Tasks:** 1
- **Files modified:** 11

## Accomplishments
- Eliminated all raw `throw new Error()` from 11 core/auth/order/infra service files
- Each converted throw now uses an ErrorCode constant from the registry with appropriate HTTP status
- Config boot errors (database.config, jwt.config, redis.config, storage.config, sentry.config) and retry.util defensive throw intentionally left as plain Error
- All 26 existing exception/filter tests from Plan 01 still pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert core and order module raw errors to DomainException** - `456db4c` (feat)

## Files Created/Modified
- `src/modules/order/order.service.ts` - ORDER_CREATION_FAILED for retry exhaustion after 3 attempts
- `src/modules/order/order.repository.ts` - ORDER_CREATION_FAILED for unreachable TypeScript guard
- `src/modules/order/sagas/order-completion.saga.ts` - ORDER_NOT_FOUND, ORDER_ALREADY_COMPLETED, ORDER_ALREADY_CANCELLED
- `src/core/auth/auth.service.ts` - INTERNAL_ERROR for missing TWO_FA_ENCRYPTION_KEY config
- `src/core/auth/api-key-rotation.service.ts` - API_KEY_NOT_FOUND for missing or inactive API keys
- `src/core/database/prisma.service.ts` - TRANSACTION_ERROR for database connection failure
- `src/core/database/query-analyzer.service.ts` - ForbiddenException for production block, BadRequestException for SQL validation
- `src/core/vault/vault.service.ts` - VAULT_ERROR for unhealthy vault state
- `src/core/encryption/encryption.service.ts` - ENCRYPTION_ERROR for missing key, unknown version, decrypt failure
- `src/core/encryption/key-rotation.service.ts` - ENCRYPTION_ERROR for disabled encryption
- `src/common/utils/business-hours.ts` - BadRequestException for invalid work hours config

## Decisions Made
- auth.service.ts constructor env validation (`TWO_FA_ENCRYPTION_KEY`) treated as runtime error (DomainException with INTERNAL_ERROR) rather than config boot error, because the acceptance criteria explicitly requires zero raw throws in this file
- query-analyzer.service.ts production guard uses ForbiddenException (403) since it's an access control decision, while SQL input validation uses BadRequestException (400) -- both are NestJS built-in HttpExceptions that will get proper errorCodes via deriveErrorCode in the filter
- Config boot files (database.config, redis.config, etc.) and retry.util kept as raw Error per plan specification

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Core/auth/order/infra service files fully converted to domain exceptions
- Ready for Plan 01-03 (remaining module conversions) and Plan 01-04 (integration tests)
- ErrorCode registry covers all error codes needed by these 11 files
- All filters produce consistent error shapes with errorCode and requestId for these modules

## Self-Check: PASSED

All 11 modified files verified on disk. Commit hash (456db4c) found in git log.

---
*Phase: 01-backend-error-standardization*
*Completed: 2026-03-18*
