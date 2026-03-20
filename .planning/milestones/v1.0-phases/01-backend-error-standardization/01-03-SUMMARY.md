---
phase: 01-backend-error-standardization
plan: 03
subsystem: api, infra
tags: [websocket, bullmq, error-handling, dlq, correlation-id, structured-logging]

# Dependency graph
requires:
  - phase: 01-backend-error-standardization/01
    provides: ErrorCode const object, DomainException class, exception filters
provides:
  - wsError() utility for structured WebSocket error objects
  - logProcessorError() / buildProcessorErrorLog() for structured BullMQ error logging
  - EventPublisherService.emit() requestId parameter for HTTP-to-job correlation
  - Structured DLQ payload with errorCode and correlationId
affects: [01-backend-error-standardization/04, monitoring, admin-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [structured-ws-errors, structured-processor-errors, end-to-end-correlation]

key-files:
  created:
    - tbs-erp-backend/src/core/websocket/ws-error.util.ts
    - tbs-erp-backend/src/core/websocket/ws-error.util.spec.ts
    - tbs-erp-backend/src/core/events/processors/processor-error.util.ts
    - tbs-erp-backend/src/core/events/processors/processor-error.util.spec.ts
  modified:
    - tbs-erp-backend/src/core/websocket/ws.gateway.ts
    - tbs-erp-backend/src/core/events/processors/finance-event.processor.ts
    - tbs-erp-backend/src/core/events/processors/order-event.processor.ts
    - tbs-erp-backend/src/core/events/processors/notification-event.processor.ts
    - tbs-erp-backend/src/core/events/event-publisher.service.ts
    - tbs-erp-backend/src/core/queue/failed-job-capture.service.ts

key-decisions:
  - "wsError() auto-generates requestId with 'ws-' prefix + 8-char hex for WebSocket-originated errors"
  - "extractErrorCode() tries JSON parse, then string match against known ErrorCode values, fallback to JOB_PROCESSING_FAILED"
  - "FailedJobCaptureService retrieves full Job object on failure for metadata extraction (graceful fallback if removed)"

patterns-established:
  - "WS error pattern: wsError(ErrorCode.*, message, optionalRequestId) for all WebSocket error emissions"
  - "Processor error pattern: try/catch wrapping switch statement with logProcessorError + re-throw for BullMQ retry"
  - "Correlation propagation: requestId flows HTTP -> EventPublisher.emit() -> job.data.metadata.correlationId -> DLQ payload"

requirements-completed: [ERR-03, ERR-06]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Phase 1 Plan 3: Non-HTTP Error Standardization Summary

**Structured error objects for WebSocket errors, BullMQ processor failures, and DLQ records with end-to-end correlationId propagation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T08:19:05Z
- **Completed:** 2026-03-18T08:25:20Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- All 9 WebSocket error emissions in ws.gateway.ts converted from raw `{ message }` to structured `{ errorCode, message, requestId, timestamp }` using wsError() utility
- All 3 BullMQ processors (finance, order, notification) wrapped with try/catch using logProcessorError for structured JSON error logging
- EventPublisherService.emit() accepts optional requestId for HTTP-to-job correlation (correlationId propagation)
- FailedJobCaptureService writes structured payload to DeadLetterEvent including errorCode, correlationId, eventType, and attemptsMade
- 9 unit tests added and passing for ws-error.util and processor-error.util

## Task Commits

Each task was committed atomically:

1. **Task 1: Create WS error utility and processor error utility** - `251654e` (feat) - TDD: RED->GREEN
2. **Task 2: Add structured error handling to BullMQ processors and update EventPublisher** - `7ff736d` (feat)
3. **Task 3: Wire structured error data into FailedJobCaptureService for DLQ integration** - `873fa4b` (feat)

## Files Created/Modified
- `src/core/websocket/ws-error.util.ts` - wsError() utility producing structured WS error objects
- `src/core/websocket/ws-error.util.spec.ts` - Unit tests for wsError()
- `src/core/events/processors/processor-error.util.ts` - logProcessorError() and buildProcessorErrorLog() for BullMQ
- `src/core/events/processors/processor-error.util.spec.ts` - Unit tests for processor error utility
- `src/core/websocket/ws.gateway.ts` - All 9 error emissions converted to wsError(ErrorCode.*)
- `src/core/events/processors/finance-event.processor.ts` - try/catch with logProcessorError, handleCostAllocation updated
- `src/core/events/processors/order-event.processor.ts` - try/catch with logProcessorError
- `src/core/events/processors/notification-event.processor.ts` - try/catch with logProcessorError
- `src/core/events/event-publisher.service.ts` - Optional requestId parameter on emit()
- `src/core/queue/failed-job-capture.service.ts` - Structured DLQ payload with errorCode, correlationId, Job retrieval

## Decisions Made
- wsError() generates `ws-` prefixed requestId (8 hex chars) for WebSocket-originated errors that lack an HTTP request context
- extractErrorCode() in FailedJobCaptureService tries JSON parse first (for structured error messages from logProcessorError), then string-matches known ErrorCode values, defaults to JOB_PROCESSING_FAILED
- Full Job retrieval in FailedJobCaptureService uses graceful fallback (job may have been removed by Redis) -- proceeds with 'unknown' values if unavailable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All non-HTTP error paths (WebSocket, BullMQ, DLQ) now produce structured error objects
- End-to-end correlation complete: HTTP requestId -> EventPublisher -> job metadata -> processor error log -> DLQ record
- Ready for Plan 01-04 (final plan in phase 1) to complete error standardization

---
*Phase: 01-backend-error-standardization*
*Completed: 2026-03-18*
