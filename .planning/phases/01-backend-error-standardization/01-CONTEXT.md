# Phase 1: Backend Error Standardization - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Standardize all backend error responses across HTTP, WebSocket, and BullMQ layers. Every error returns a machine-readable, traceable JSON response with error codes and correlation IDs. This phase does NOT touch frontend error handling (Phase 2) or add new business logic.

</domain>

<decisions>
## Implementation Decisions

### Error Response Format
- Extend existing response shape (backward-compatible) — add `errorCode` and `requestId` fields alongside existing `success`, `statusCode`, `message`, `error`, `timestamp`, `path`
- `errorCode`: string type (e.g., `'ORDER_NOT_FOUND'`, `'INSUFFICIENT_DEPOSIT'`) — self-documenting, easy for frontend to switch/match
- `requestId`: inject from existing `RequestIdMiddleware` (`req.requestId`) into all error responses and log entries
- Claude has discretion on whether to restructure the response shape or purely extend it

### Error Code Taxonomy
- Claude's discretion on taxonomy organization (module-prefix vs category-prefix vs hybrid)
- Claude's discretion on registry location (central enum vs per-module)
- Constraint: error codes must be string constants, not magic strings — importable by frontend

### Domain Exceptions
- Claude's discretion on granularity (per-module base class vs per-error-type)
- All 20 files with raw `throw new Error()` must be converted to NestJS HttpException subclasses
- Claude's discretion on catch-all approach (extend SentryExceptionFilter vs new AllExceptionsFilter)
- Non-HTTP errors (unknown exceptions) must return standardized 500 response with errorCode + requestId

### WebSocket Error Handling
- Claude's discretion on WS error format (same as HTTP vs WS-adapted)
- Must include errorCode and requestId equivalent for traceability
- Socket.IO error events must be structured, not raw strings

### BullMQ Error Handling
- Claude's discretion on approach (job metadata vs DLQ enrichment)
- requestId must propagate through job.data for correlation
- Failed jobs must log structured error with same fields as HTTP errors
- Integration with existing DlqMonitorService

### Claude's Discretion
- Error response shape design (extend vs restructure) — must be backward-compatible with existing frontend
- Error code taxonomy and registry structure
- Domain exception class hierarchy and granularity
- Catch-all filter implementation approach
- WebSocket error format adaptation
- BullMQ error propagation approach
- Sentry integration details (requestId as tag, breadcrumb format)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Error handling infrastructure
- `tbs-erp-backend/src/common/filters/http-exception.filter.ts` — Current HTTP error response format, logging pattern
- `tbs-erp-backend/src/common/filters/prisma-exception.filter.ts` — Prisma error mapping to HTTP status codes
- `tbs-erp-backend/src/common/filters/sentry-exception.filter.ts` — Catch-all filter, Sentry capture logic, sensitive data stripping
- `tbs-erp-backend/src/common/filters/index.ts` — Filter barrel export and registration order

### Request correlation
- `tbs-erp-backend/src/common/middleware/request-id.middleware.ts` — UUID generation, X-Request-ID header, req.requestId property

### WebSocket
- `tbs-erp-backend/src/core/websocket/ws.gateway.ts` — Socket.IO gateway, room structure, event handling patterns

### BullMQ processors
- `tbs-erp-backend/src/core/events/processors/finance-event.processor.ts` — Finance event processing
- `tbs-erp-backend/src/core/events/processors/notification-event.processor.ts` — Notification processing
- `tbs-erp-backend/src/core/events/processors/order-event.processor.ts` — Order event processing
- `tbs-erp-backend/src/core/events/event-publisher.service.ts` — Event publishing with requestId

### Logger
- `tbs-erp-backend/src/core/logger/elk-logger.service.ts` — ELK structured logging service

### Business process reference
- `docs/TBS_QuyTrinh_NghiepVu_DayDu.md` — Full business process documentation (13 stages, approval matrix, SLA table)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RequestIdMiddleware`: Already generates UUID per request and sets `req.requestId` — just needs to be consumed by filters
- `HttpExceptionFilter`: Solid base pattern for response formatting — extend with errorCode + requestId
- `PrismaExceptionFilter`: Good Prisma-to-HTTP mapping — add errorCode field to each case
- `SentryExceptionFilter`: Catch-all with sensitive data stripping — extend or complement
- `ElkLoggerService`: ELK-structured logging — requestId can be added to log context
- `DlqMonitorService`: Existing DLQ monitoring with alert thresholds — integrate error details

### Established Patterns
- Filter registration order in `app.module.ts`: Sentry (catch-all) → Prisma → HTTP
- Response format: `{success: false, statusCode, message, error, timestamp, path}`
- Logger: per-class `new Logger(ClassName.name)` pattern
- Event emitter: `EventEmitter2` with `@OnEvent()` decorators

### Integration Points
- `main.ts`: Global filter registration via `app.useGlobalFilters()`
- `app.module.ts`: Filter providers and middleware configuration
- All 91+ controllers: Error responses pass through global filters
- BullMQ processors: `@Processor()` decorator classes in `src/core/events/processors/`
- WebSocket gateway: `ws.gateway.ts` in `src/core/websocket/`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User delegated most technical decisions to Claude, with these constraints:
- Error codes must be string type (not numeric)
- Must use existing RequestIdMiddleware requestId
- Must be backward-compatible with existing frontend
- Must cover HTTP, WebSocket, and BullMQ error paths

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-backend-error-standardization*
*Context gathered: 2026-03-18*
