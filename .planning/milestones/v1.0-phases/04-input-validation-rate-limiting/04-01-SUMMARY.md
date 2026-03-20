---
phase: 04-input-validation-rate-limiting
plan: 01
subsystem: api
tags: [nestjs, throttler, rate-limiting, file-validation, security]

# Dependency graph
requires:
  - phase: 01-backend-error-standardization
    provides: ErrorCode registry, DomainException base class
provides:
  - CustomThrottlerGuard with userId-based tracking and Retry-After header
  - FileValidationPipe with configurable MIME/size validation
  - FILE_UPLOAD_LIMITS constants for 5 upload categories
  - RATE_LIMIT_EXCEEDED, FILE_TOO_LARGE, FILE_TYPE_NOT_ALLOWED error codes
  - Global rate limiting activated (all existing @Throttle decorators now enforced)
affects: [04-02, 04-03, 05-rbac-permission-audit]

# Tech tracking
tech-stack:
  added: []
  patterns: [global-guard-registration, defense-in-depth-throttle-skip, per-user-rate-tracking]

key-files:
  created:
    - tbs-erp-backend/src/common/guards/custom-throttler.guard.ts
    - tbs-erp-backend/src/common/pipes/file-validation.pipe.ts
    - tbs-erp-backend/src/common/constants/file-upload.constants.ts
  modified:
    - tbs-erp-backend/src/common/exceptions/error-codes.ts
    - tbs-erp-backend/src/app.module.ts
    - tbs-erp-backend/src/config/business.config.ts
    - tbs-erp-backend/src/core/websocket/ws.gateway.ts
    - tbs-erp-backend/src/core/health/health.controller.ts
    - tbs-erp-backend/src/core/metrics/metrics.controller.ts

key-decisions:
  - "CustomThrottlerGuard uses canActivate context type check AND @SkipThrottle for defense-in-depth"
  - "Global rate limit lowered from 100 to 60 req/min as specified in CONTEXT.md"
  - "Pre-existing TS errors in prisma.service.ts and batch-job.service.ts left untouched (out of scope)"

patterns-established:
  - "Global guard pattern: register via APP_GUARD in app.module.ts providers array"
  - "Non-HTTP skip: guard checks context.getType() !== 'http' for WS/RPC bypass"
  - "@SkipThrottle() on health/metrics controllers for monitoring exemption"
  - "FileValidationPipe instantiated with FILE_UPLOAD_LIMITS category constant"

requirements-completed: [SEC-04, SEC-06]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 4 Plan 1: Rate Limiting & File Validation Infrastructure Summary

**Global CustomThrottlerGuard with userId tracking, Retry-After header, FileValidationPipe with 5-category MIME/size constants, and 3 new error codes**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T01:48:19Z
- **Completed:** 2026-03-19T01:53:44Z
- **Tasks:** 2
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments
- Activated global rate limiting via CustomThrottlerGuard -- all existing @Throttle() decorators across the codebase are now enforced (previously inert metadata)
- Created FileValidationPipe with configurable size/MIME validation using DomainException error format
- Established FILE_UPLOAD_LIMITS constants with 5 categories (IMAGE 5MB, DOCUMENT 10MB, CMS_MEDIA 50MB, DRIVE 25MB, BATCH_IMPORT 10MB)
- Exempted WebSocket, health, and metrics endpoints from throttling via @SkipThrottle() and canActivate type check

## Task Commits

Each task was committed atomically:

1. **Task 1: Create error codes, file upload constants, CustomThrottlerGuard, and FileValidationPipe** - `5a712c9` (feat)
2. **Task 2: Register global ThrottlerGuard, update rate limit config, exempt non-HTTP endpoints** - `404cadb` (feat)

## Files Created/Modified
- `src/common/guards/custom-throttler.guard.ts` - CustomThrottlerGuard with userId tracking, Retry-After header, non-HTTP skip
- `src/common/pipes/file-validation.pipe.ts` - FileValidationPipe with configurable maxSizeBytes and allowedMimeTypes
- `src/common/constants/file-upload.constants.ts` - FILE_UPLOAD_LIMITS with 5 upload categories
- `src/common/exceptions/error-codes.ts` - Added RATE_LIMIT_EXCEEDED, FILE_TOO_LARGE, FILE_TYPE_NOT_ALLOWED
- `src/app.module.ts` - Registered CustomThrottlerGuard as APP_GUARD, changed limit 100->60
- `src/config/business.config.ts` - Added complaintPerHour, bulkImportPerHour, publicPerMinute config
- `src/core/websocket/ws.gateway.ts` - Added @SkipThrottle() decorator
- `src/core/health/health.controller.ts` - Added @SkipThrottle() decorator
- `src/core/metrics/metrics.controller.ts` - Added @SkipThrottle() decorator

## Decisions Made
- CustomThrottlerGuard uses both `canActivate` context type check (skip non-HTTP) AND `@SkipThrottle()` on WsGateway for defense-in-depth
- Global rate limit lowered from 100 to 60 req/min per CONTEXT.md specification
- Pre-existing TypeScript errors in prisma.service.ts (TS7023) and batch-job.service.ts (TS7053) left untouched as they are out of scope

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CustomThrottlerGuard is active globally -- Plan 04-02 can apply per-endpoint @Throttle() overrides
- FileValidationPipe and FILE_UPLOAD_LIMITS are ready for Plan 04-03 to apply to upload endpoints
- Error codes RATE_LIMIT_EXCEEDED, FILE_TOO_LARGE, FILE_TYPE_NOT_ALLOWED available for all modules

## Self-Check: PASSED

- All 3 created files exist on disk
- All 5 modified files verified
- Commit 5a712c9 (Task 1) found in git log
- Commit 404cadb (Task 2) found in git log

---
*Phase: 04-input-validation-rate-limiting*
*Completed: 2026-03-19*
