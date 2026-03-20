---
phase: 01-backend-error-standardization
plan: 04
subsystem: api
tags: [nestjs, error-handling, domain-exception, error-codes, service-layer]

# Dependency graph
requires:
  - phase: 01-backend-error-standardization/01-01
    provides: DomainException base class, ErrorCode registry, exception filters
provides:
  - All remaining module service files converted from raw throw new Error to DomainException or NestJS HttpException
  - Two new ErrorCode constants (AUTOMATION_ACTION_FAILED, BATCH_IMPORT_VALIDATION_ERROR)
  - Full service-layer error standardization complete (zero raw Error throws in src/)
affects: [01-backend-error-standardization, error-handling, all-modules]

# Tech tracking
tech-stack:
  added: []
  patterns: [DomainException-across-all-modules, ErrorCode-registry-for-all-throw-sites]

key-files:
  created: []
  modified:
    - tbs-erp-backend/src/common/exceptions/error-codes.ts
    - tbs-erp-backend/src/modules/cash/cash.service.ts
    - tbs-erp-backend/src/modules/complaint/complaint.service.ts
    - tbs-erp-backend/src/modules/cost-adjustment/cost-adjustment.controller.ts
    - tbs-erp-backend/src/modules/approval/domain/condition-evaluator.ts
    - tbs-erp-backend/src/modules/approval/domain/approval-graph-engine.ts
    - tbs-erp-backend/src/modules/integration/sync/sync-engine.service.ts
    - tbs-erp-backend/src/modules/integration/accounting/accounting.service.ts
    - tbs-erp-backend/src/modules/integration/batch/batch-job.service.ts
    - tbs-erp-backend/src/modules/automation/automation-engine.service.ts
    - tbs-erp-backend/src/modules/batch/batch-job.processor.ts

key-decisions:
  - "accounting.service.ts provider API errors use HttpStatus.BAD_GATEWAY (502) since they represent upstream service failures"
  - "batch-job.service.ts cancellation signal converted to DomainException with getResponse() message check for flow control"
  - "Added AUTOMATION_ACTION_FAILED and BATCH_IMPORT_VALIDATION_ERROR to ErrorCode registry for domain-specific error tracking"

patterns-established:
  - "All service-layer throws use DomainException(ErrorCode.X, message, HttpStatus) or NestJS built-in exceptions"
  - "Integration errors use INTEGRATION_SYNC_ERROR or INTEGRATION_HANDLER_NOT_FOUND codes"
  - "Batch/automation errors use dedicated error codes for observability"

requirements-completed: [ERR-02]

# Metrics
duration: 5min
completed: 2026-03-18
---

# Phase 1 Plan 4: Remaining Module Error Conversion Summary

**Converted 10 remaining module service files (15 throw sites) from raw throw new Error to DomainException/NestJS exceptions with ErrorCode constants, completing full service-layer error standardization**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T08:28:00Z
- **Completed:** 2026-03-18T08:33:11Z
- **Tasks:** 1
- **Files modified:** 11

## Accomplishments
- Converted all 15 raw `throw new Error()` sites across 10 module service files to DomainException or NestJS HttpException subclasses
- Added 2 new ErrorCode constants to the registry: AUTOMATION_ACTION_FAILED, BATCH_IMPORT_VALIDATION_ERROR
- Full sweep of src/ (excluding config/) confirms zero remaining raw Error throws in service code
- All 26 existing exception/filter unit tests continue to pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert remaining module raw errors to DomainException** - `3cd83c4` (feat)

## Files Created/Modified
- `src/common/exceptions/error-codes.ts` - Added AUTOMATION_ACTION_FAILED and BATCH_IMPORT_VALIDATION_ERROR constants
- `src/modules/cash/cash.service.ts` - PAYMENT_FAILED for voucher creation retry exhaustion
- `src/modules/complaint/complaint.service.ts` - COMPLAINT_CREATION_FAILED for complaint creation retry
- `src/modules/cost-adjustment/cost-adjustment.controller.ts` - BadRequestException for missing rejection note
- `src/modules/approval/domain/condition-evaluator.ts` - APPROVAL_CONDITION_PARSE_ERROR for 4 parse error sites in ExpressionParser
- `src/modules/approval/domain/approval-graph-engine.ts` - APPROVAL_FAILED for failed approval record creation
- `src/modules/integration/sync/sync-engine.service.ts` - INTEGRATION_SYNC_ERROR for missing id/externalId
- `src/modules/integration/accounting/accounting.service.ts` - INTEGRATION_SYNC_ERROR for provider API errors (push + fetch)
- `src/modules/integration/batch/batch-job.service.ts` - INTEGRATION_HANDLER_NOT_FOUND for missing handler, JOB_PROCESSING_FAILED for cancel/cancellation signal
- `src/modules/automation/automation-engine.service.ts` - AUTOMATION_ACTION_FAILED for webhook call failures
- `src/modules/batch/batch-job.processor.ts` - BATCH_IMPORT_VALIDATION_ERROR for missing customer ID in import

## Decisions Made
- accounting.service.ts: Provider API errors throw with HttpStatus.BAD_GATEWAY (502) since they represent upstream service failures, not client errors
- batch-job.service.ts: Cancellation signal converted from `error.message === 'Job cancelled'` check to `error instanceof DomainException && error.getResponse()?.['message'] === 'Job cancelled'` for proper type-safe detection
- cost-adjustment.controller.ts: Used NestJS built-in BadRequestException (not DomainException) since this is a simple input validation in a controller, matching the plan's conversion rule
- Added two new error codes to the registry rather than using generic INTERNAL_ERROR, enabling domain-specific observability for automation and batch import failures

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added 2 new ErrorCode constants to registry**
- **Found during:** Task 1 (automation-engine.service.ts and batch-job.processor.ts conversion)
- **Issue:** No existing ErrorCode for automation webhook failures or batch import validation errors
- **Fix:** Added AUTOMATION_ACTION_FAILED and BATCH_IMPORT_VALIDATION_ERROR to error-codes.ts
- **Files modified:** tbs-erp-backend/src/common/exceptions/error-codes.ts
- **Verification:** All converted files reference valid ErrorCode constants
- **Committed in:** 3cd83c4 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed cancellation detection in batch-job.service.ts**
- **Found during:** Task 1 (batch-job.service.ts conversion)
- **Issue:** Converting `throw new Error('Job cancelled')` to DomainException would break the `error.message === 'Job cancelled'` catch check since HttpException stores message differently
- **Fix:** Updated catch to use `error instanceof DomainException && error.getResponse()?.['message'] === 'Job cancelled'`
- **Files modified:** tbs-erp-backend/src/modules/integration/batch/batch-job.service.ts
- **Verification:** Flow control logic preserved; cancellation signal properly detected
- **Committed in:** 3cd83c4 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug fix)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 (Backend Error Standardization) is now fully complete across all 4 plans
- All service-layer code uses DomainException or NestJS HttpException subclasses
- ErrorCode registry contains 50+ domain-specific constants covering all modules
- Full sweep confirms zero raw Error throws in src/ (excluding config boot files)
- Ready for Phase 2 (Input Validation Hardening)

## Self-Check: PASSED

All 11 modified files verified on disk. Commit hash (3cd83c4) found in git log.

---
*Phase: 01-backend-error-standardization*
*Completed: 2026-03-18*
