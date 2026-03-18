# Phase 1: Backend Error Standardization - Research

**Researched:** 2026-03-18
**Domain:** NestJS error handling, exception filters, structured error responses, correlation IDs
**Confidence:** HIGH

## Summary

This phase standardizes all backend error responses across HTTP, WebSocket, and BullMQ layers in a NestJS 11 application. The codebase already has solid infrastructure: three exception filters (HttpExceptionFilter, PrismaExceptionFilter, SentryExceptionFilter), a RequestIdMiddleware generating UUIDs, domain events with correlationId metadata, and an ELK logger with requestId support. The gap is that these pieces are not connected -- error responses lack `errorCode` and `requestId` fields, ~40 files throw raw `new Error()` instead of NestJS HttpException subclasses, WebSocket errors are raw strings, and BullMQ processor failures lack structured error logging.

The existing error response shape (`{success, statusCode, message, error, timestamp, path}`) is consumed by the frontend. The approach is to **extend** this shape with `errorCode` and `requestId` fields (backward-compatible). No frontend changes needed -- the frontend can ignore new fields until Phase 2.

**Primary recommendation:** Create a domain exception hierarchy extending NestJS HttpException, a central error code registry using string constants, and unified error formatting across all three transport layers (HTTP, WS, BullMQ) using the existing requestId from RequestIdMiddleware.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Extend existing response shape (backward-compatible) -- add `errorCode` and `requestId` fields alongside existing `success`, `statusCode`, `message`, `error`, `timestamp`, `path`
- `errorCode`: string type (e.g., `'ORDER_NOT_FOUND'`, `'INSUFFICIENT_DEPOSIT'`) -- self-documenting, easy for frontend to switch/match
- `requestId`: inject from existing `RequestIdMiddleware` (`req.requestId`) into all error responses and log entries
- All 20 files with raw `throw new Error()` must be converted to NestJS HttpException subclasses (actual count is ~40 files)
- Socket.IO error events must be structured, not raw strings
- requestId must propagate through job.data for correlation
- Failed jobs must log structured error with same fields as HTTP errors
- Integration with existing DlqMonitorService
- Must be backward-compatible with existing frontend
- Must cover HTTP, WebSocket, and BullMQ error paths
- Error codes must be string constants, not magic strings -- importable by frontend

### Claude's Discretion
- Error response shape design (extend vs restructure) -- must be backward-compatible with existing frontend
- Error code taxonomy and registry structure
- Domain exception class hierarchy and granularity
- Catch-all filter implementation approach
- WebSocket error format adaptation
- BullMQ error propagation approach
- Sentry integration details (requestId as tag, breadcrumb format)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ERR-01 | All backend API errors return standardized JSON with errorCode, message, requestId | Extend HttpExceptionFilter + PrismaExceptionFilter to include `errorCode` + `requestId` from `req.requestId`. Create DomainException base class that carries errorCode. |
| ERR-02 | All service-layer exceptions use domain-specific NestJS exceptions (not raw `throw new Error()`) | ~40 files have raw `throw new Error()`. Create module-scoped DomainException subclasses. Config boot errors (6 files) can remain as startup-time errors. |
| ERR-03 | WebSocket and BullMQ worker errors caught and logged with same structured format | WsGateway emits raw `{ message: string }` objects. BullMQ processors have no structured error handling. Add WsExceptionFilter and BullMQ error handler utility. |
| ERR-06 | Every HTTP request has correlation ID propagating through logs, Sentry breadcrumbs, BullMQ job metadata | RequestIdMiddleware exists, domain events have `correlationId` field. Need: filters to read `req.requestId`, Sentry filter to set requestId as tag, EventPublisherService to accept requestId from HTTP context. |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @nestjs/common | ^11.1.15 | Exception classes (HttpException, BadRequestException, etc.) | NestJS built-in, provides exception hierarchy |
| @nestjs/core | ^11.1.15 | APP_FILTER provider, ExceptionFilter interface | NestJS core DI for global filter registration |
| @nestjs/bullmq | ^11.0.4 | BullMQ integration with NestJS DI | Processor decorators, WorkerHost base class |
| bullmq | ^5.13.0 | Job queue with built-in retry, DLQ support | Already used for all async processing |
| socket.io | ^4.8.0 | WebSocket server | Already used via @nestjs/platform-socket.io |
| uuid | ^10.0.0 | UUID generation for requestId | Already used by RequestIdMiddleware |

### Not Needed
| Library | Reason |
|---------|--------|
| nestjs-cls | Could provide AsyncLocalStorage-based requestId propagation, but adds complexity. The existing approach (req.requestId + passing correlationId through job.data) is sufficient for this phase. |
| cls-hooked | Legacy approach, superseded by nestjs-cls. Not needed. |

**No new packages need to be installed.** All required functionality is available through NestJS built-in features and already-installed dependencies.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── common/
│   ├── exceptions/
│   │   ├── index.ts                       # Barrel export
│   │   ├── domain.exception.ts            # Base DomainException extends HttpException
│   │   ├── error-codes.ts                 # Central error code registry (string constants)
│   │   └── error-response.interface.ts    # StandardErrorResponse interface
│   ├── filters/
│   │   ├── http-exception.filter.ts       # MODIFY: add errorCode + requestId
│   │   ├── prisma-exception.filter.ts     # MODIFY: add errorCode + requestId
│   │   ├── sentry-exception.filter.ts     # MODIFY: add requestId as Sentry tag
│   │   ├── ws-exception.filter.ts         # NEW: WebSocket error filter
│   │   └── index.ts                       # UPDATE barrel export
│   └── middleware/
│       └── request-id.middleware.ts        # EXISTS: no changes needed
├── core/
│   ├── events/
│   │   ├── processors/
│   │   │   └── *.processor.ts             # MODIFY: add structured error handling
│   │   └── event-publisher.service.ts     # MODIFY: accept requestId parameter
│   └── websocket/
│       └── ws.gateway.ts                  # MODIFY: use structured error objects
└── modules/
    └── {mod}/
        └── {mod}.service.ts               # MODIFY: replace throw new Error() with DomainException
```

### Pattern 1: DomainException Base Class
**What:** A base exception class that extends NestJS HttpException and carries an `errorCode` string constant.
**When to use:** All service-layer exceptions that represent business logic errors.
**Example:**
```typescript
// src/common/exceptions/domain.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';

export class DomainException extends HttpException {
  constructor(
    public readonly errorCode: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ message, errorCode }, status);
  }
}

// Usage in services:
export class OrderNotFoundException extends DomainException {
  constructor(orderId: string) {
    super('ORDER_NOT_FOUND', `Order ${orderId} not found`, HttpStatus.NOT_FOUND);
  }
}
```

### Pattern 2: Error Code Registry (Central Enum/Constants)
**What:** All error codes defined as string constants in a single file, organized by module prefix.
**When to use:** Every throw site references a constant from this file.
**Example:**
```typescript
// src/common/exceptions/error-codes.ts
export const ErrorCode = {
  // Common
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',

  // Prisma-mapped
  DB_UNIQUE_VIOLATION: 'DB_UNIQUE_VIOLATION',
  DB_FK_VIOLATION: 'DB_FK_VIOLATION',
  DB_RECORD_NOT_FOUND: 'DB_RECORD_NOT_FOUND',
  DB_RELATION_VIOLATION: 'DB_RELATION_VIOLATION',
  DB_TABLE_NOT_FOUND: 'DB_TABLE_NOT_FOUND',
  DB_TIMEOUT: 'DB_TIMEOUT',
  DB_VALIDATION_ERROR: 'DB_VALIDATION_ERROR',

  // Order
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_INVALID_TRANSITION: 'ORDER_INVALID_TRANSITION',
  ORDER_ALREADY_COMPLETED: 'ORDER_ALREADY_COMPLETED',
  ORDER_ALREADY_CANCELLED: 'ORDER_ALREADY_CANCELLED',
  ORDER_CREATION_FAILED: 'ORDER_CREATION_FAILED',
  INSUFFICIENT_DEPOSIT: 'INSUFFICIENT_DEPOSIT',

  // Auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_2FA_CODE: 'INVALID_2FA_CODE',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',

  // ... more per module
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];
```

### Pattern 3: Standardized Error Response Shape
**What:** Extended error response that adds `errorCode` and `requestId` while keeping existing fields.
**When to use:** All error responses across HTTP, WS, BullMQ.
**Example:**
```typescript
// src/common/exceptions/error-response.interface.ts
export interface StandardErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;       // NEW: machine-readable error code
  message: string | string[];
  error?: string;
  requestId: string;       // NEW: correlation ID from RequestIdMiddleware
  timestamp: string;
  path: string;
}
```

### Pattern 4: HttpExceptionFilter with requestId + errorCode
**What:** Modified global HTTP filter that reads `req.requestId` and extracts `errorCode` from the exception.
**When to use:** Automatically applied to all HTTP error responses.
**Example:**
```typescript
// Modified HttpExceptionFilter.catch()
catch(exception: HttpException, host: ArgumentsHost): void {
  const ctx = host.switchToHttp();
  const request = ctx.getRequest<Request>();
  const response = ctx.getResponse<Response>();
  const status = exception.getStatus();
  const exceptionResponse = exception.getResponse();
  const requestId = (request as any).requestId || 'unknown';

  let message: string | string[];
  let error: string | undefined;
  let errorCode = 'UNKNOWN_ERROR';

  if (typeof exceptionResponse === 'object') {
    const resp = exceptionResponse as Record<string, unknown>;
    message = (resp.message as string | string[]) || exception.message;
    error = resp.error as string | undefined;
    errorCode = (resp.errorCode as string) || this.deriveErrorCode(status);
  } else {
    message = typeof exceptionResponse === 'string' ? exceptionResponse : exception.message;
    errorCode = this.deriveErrorCode(status);
  }

  const errorResponse: StandardErrorResponse = {
    success: false,
    statusCode: status,
    errorCode,
    message,
    error,
    requestId,
    timestamp: new Date().toISOString(),
    path: request.url,
  };

  // Log with requestId for correlation
  if (status >= 500) {
    this.logger.error(
      `[${requestId}] ${request.method} ${request.url} ${status} - ${errorCode} - ${JSON.stringify(message)}`,
      exception.stack,
    );
  } else {
    this.logger.warn(
      `[${requestId}] ${request.method} ${request.url} ${status} - ${errorCode} - ${JSON.stringify(message)}`,
    );
  }

  response.status(status).json(errorResponse);
}

private deriveErrorCode(status: number): string {
  switch (status) {
    case 400: return ErrorCode.VALIDATION_ERROR;
    case 401: return ErrorCode.UNAUTHORIZED;
    case 403: return ErrorCode.FORBIDDEN;
    case 404: return ErrorCode.NOT_FOUND;
    case 409: return ErrorCode.CONFLICT;
    case 408: return ErrorCode.REQUEST_TIMEOUT;
    default: return ErrorCode.INTERNAL_ERROR;
  }
}
```

### Pattern 5: WebSocket Structured Error Emission
**What:** Replace raw `{ message: string }` error emissions with structured error objects.
**When to use:** All `client.emit('error', ...)` calls in WsGateway.
**Example:**
```typescript
// Utility function for WS errors
function wsError(errorCode: string, message: string, requestId?: string) {
  return {
    errorCode,
    message,
    requestId: requestId || 'ws-' + randomUUID().slice(0, 8),
    timestamp: new Date().toISOString(),
  };
}

// Usage in ws.gateway.ts
client.emit('error', wsError('WS_AUTH_REQUIRED', 'Authentication required'));
client.emit('error', wsError('WS_INVALID_CHANNEL', 'Invalid channel format'));
```

### Pattern 6: BullMQ Structured Error Handling
**What:** Wrap processor error handling to log structured errors with correlationId.
**When to use:** All BullMQ processor `process()` methods.
**Example:**
```typescript
// In processor base or utility
async process(job: Job<DomainEvent>): Promise<void> {
  const correlationId = job.data?.metadata?.correlationId || job.id || 'unknown';

  try {
    await this.handleEvent(job);
  } catch (error) {
    this.logger.error(
      JSON.stringify({
        errorCode: error instanceof DomainException ? error.errorCode : 'JOB_PROCESSING_FAILED',
        message: error.message,
        requestId: correlationId,
        jobId: job.id,
        queue: job.queueName,
        eventType: job.data?.type,
        attemptsMade: job.attemptsMade,
      }),
      error.stack,
    );
    throw error; // Let BullMQ retry
  }
}
```

### Pattern 7: Sentry requestId Tag
**What:** Add requestId as a Sentry tag for every captured exception.
**When to use:** In SentryExceptionFilter before captureException.
**Example:**
```typescript
// In SentryExceptionFilter.captureToSentry()
const requestId = (request as any).requestId;
if (requestId) {
  scope.setTag('requestId', requestId);
}
```

### Anti-Patterns to Avoid
- **Raw `throw new Error()`:** Never throw a bare Error in service code. Always use a DomainException or NestJS HttpException subclass. Bare Errors bypass the type system and produce unhelpful 500s without error codes.
- **Magic string error codes:** Never use `throw new DomainException('some_error', ...)` with inline strings. Always import from the ErrorCode registry so codes are discoverable and consistent.
- **Double filter registration:** NestJS has two filter registration mechanisms -- `app.useGlobalFilters()` in main.ts and `APP_FILTER` providers in AppModule. The current codebase uses BOTH which causes filters to run twice. Must consolidate to one approach.
- **Config startup errors as DomainException:** The ~6 `throw new Error()` calls in config files (database.config.ts, jwt.config.ts, redis.config.ts, etc.) happen at module initialization, BEFORE the HTTP server starts. These should NOT be converted to HttpException -- they should remain as startup errors or use a dedicated ConfigValidationError that extends Error (not HttpException).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request ID generation | Custom ID middleware | Existing `RequestIdMiddleware` | Already generates UUID, sets header, attaches to req |
| Correlation ID in events | Custom correlation tracking | Existing `DomainEvent.metadata.correlationId` | Already part of the event schema, used by all processors |
| Exception-to-HTTP mapping | Custom status code logic | NestJS built-in `HttpException.getStatus()` | NestJS handles status code extraction from all exception types |
| Prisma error mapping | Manual Prisma error handler | Existing `PrismaExceptionFilter` | Already maps P2002/P2003/P2025/etc. to HTTP status codes |
| Structured logging | Custom log formatter | Existing `ElkLoggerService.logWithContext()` | Already supports requestId, userId, traceId fields |
| Job retry/DLQ | Custom retry logic | BullMQ built-in retry + existing `DlqMonitorService` | 3 retries with exponential backoff already configured |

## Common Pitfalls

### Pitfall 1: Double Filter Execution
**What goes wrong:** Filters run twice -- once from `app.useGlobalFilters()` in main.ts and once from `APP_FILTER` providers in app.module.ts.
**Why it happens:** The current codebase registers HttpExceptionFilter and PrismaExceptionFilter in main.ts via `app.useGlobalFilters()` AND registers PrismaExceptionFilter and SentryExceptionFilter in app.module.ts via `APP_FILTER`. This means PrismaExceptionFilter runs twice.
**How to avoid:** Consolidate ALL filter registration to `APP_FILTER` in app.module.ts (preferred because it supports DI) OR to `app.useGlobalFilters()` in main.ts. Not both.
**Warning signs:** Duplicate log entries for the same error, duplicate Sentry captures.

**Current state in code:**
- `main.ts` line 75: `app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());`
- `app.module.ts` lines 160-166: APP_FILTER providers for PrismaExceptionFilter and SentryExceptionFilter
- Result: PrismaExceptionFilter is registered in BOTH places.

**Recommendation:** Move ALL filters to APP_FILTER providers in app.module.ts. Remove `app.useGlobalFilters()` from main.ts. This approach:
1. Supports dependency injection (needed if filters need services)
2. Is the NestJS recommended pattern for global filters
3. Avoids dual registration bugs

### Pitfall 2: SentryExceptionFilter Re-throws Then No Response
**What goes wrong:** The SentryExceptionFilter catches ALL exceptions (`@Catch()`), captures to Sentry, then re-throws. If registered with APP_FILTER, NestJS catches the re-thrown exception and passes it to the next filter in the chain. The filter execution order with APP_FILTER is: last registered runs first.
**Why it happens:** NestJS APP_FILTER providers run in reverse registration order. If SentryExceptionFilter is registered AFTER PrismaExceptionFilter, it runs FIRST.
**How to avoid:** Ensure registration order is: SentryExceptionFilter (catch-all, capture + re-throw) registered LAST so it runs FIRST. Then PrismaExceptionFilter. Then HttpExceptionFilter. Current order in app.module.ts has SentryExceptionFilter registered last (correct).
**Warning signs:** Unformatted error responses, 500s without proper JSON body.

**Important note:** The existing SentryExceptionFilter re-throws to let other filters handle the response. This is the correct pattern -- it acts as a capture-only filter. However, when ALSO using `app.useGlobalFilters()`, the re-thrown exception may not reach the main.ts-registered filters, causing unformatted responses.

### Pitfall 3: WebSocket Errors Don't Have Request Context
**What goes wrong:** WebSocket connections don't go through HTTP middleware pipeline, so `req.requestId` is not available.
**Why it happens:** Socket.IO connections use their own handshake mechanism, not Express middleware.
**How to avoid:** Generate a session-level requestId when the WebSocket connection is established (in handleConnection). Use `client.id` or generate a new UUID. Store it alongside the client metadata. Pass it in all error emissions.
**Warning signs:** WebSocket errors with `requestId: undefined` or missing correlation.

### Pitfall 4: Config Boot Errors vs Runtime Errors
**What goes wrong:** Converting config file `throw new Error()` to `throw new HttpException()` causes NestJS to try to send an HTTP response during module initialization, which crashes the application differently.
**Why it happens:** Config files run during NestJS bootstrap, before the HTTP server is listening. HttpException is meaningless at this stage.
**How to avoid:** Leave config file errors as plain `Error` throws (or use Joi/class-validator schema validation which the project already uses via `envValidationSchema`). Only convert service-layer errors to DomainException.
**Warning signs:** Application fails to start with confusing HttpException errors instead of clear "missing env var" messages.

**Files to leave as-is (config boot errors):**
- `src/config/database.config.ts` (2 errors)
- `src/config/storage.config.ts` (1 error)
- `src/config/sentry.config.ts` (1 error)
- `src/config/jwt.config.ts` (2 errors)
- `src/config/redis.config.ts` (2 errors)

### Pitfall 5: ValidationPipe Errors Lack errorCode
**What goes wrong:** NestJS ValidationPipe throws BadRequestException with `{ message: string[], error: 'Bad Request' }`. These pass through HttpExceptionFilter but have no errorCode.
**Why it happens:** ValidationPipe is a built-in NestJS pipe that creates standard BadRequestException without custom errorCode.
**How to avoid:** The modified HttpExceptionFilter should detect when no errorCode is present in the exception response and fall back to `deriveErrorCode(status)` which maps 400 to `'VALIDATION_ERROR'`. This handles ValidationPipe errors automatically.
**Warning signs:** Error responses with `errorCode: undefined`.

### Pitfall 6: BullMQ Job Data Serialization
**What goes wrong:** Error objects with circular references or non-serializable properties cause BullMQ job.data serialization to fail.
**Why it happens:** BullMQ serializes job data to JSON for Redis storage. Error stacks and some NestJS exception properties may not serialize cleanly.
**How to avoid:** Only log structured error info (errorCode, message, requestId), never try to store the full Error object in job results or data. Use `error.message` and `error.stack` as separate string fields.
**Warning signs:** Redis serialization errors, jobs stuck in active state.

## Code Examples

### Current Error Response (before this phase)
```json
{
  "success": false,
  "statusCode": 404,
  "message": "The requested record was not found.",
  "error": "Prisma Error P2025",
  "timestamp": "2026-03-18T07:00:00.000Z",
  "path": "/api/v1/orders/abc123"
}
```

### Target Error Response (after this phase)
```json
{
  "success": false,
  "statusCode": 404,
  "errorCode": "ORDER_NOT_FOUND",
  "message": "The requested record was not found.",
  "error": "Prisma Error P2025",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-03-18T07:00:00.000Z",
  "path": "/api/v1/orders/abc123"
}
```

### WebSocket Error (before)
```javascript
client.emit('error', { message: 'Authentication required' });
```

### WebSocket Error (after)
```javascript
client.emit('error', {
  errorCode: 'WS_AUTH_REQUIRED',
  message: 'Authentication required',
  requestId: 'ws-a1b2c3d4',
  timestamp: '2026-03-18T07:00:00.000Z'
});
```

### BullMQ Error Log (before)
```
[FinanceEventProcessor] Cost allocation failed for container CN-001: Division by zero
```

### BullMQ Error Log (after)
```json
{
  "errorCode": "JOB_PROCESSING_FAILED",
  "message": "Cost allocation failed for container CN-001: Division by zero",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "jobId": "finance.payment.allocated-550e8400",
  "queue": "finance-events",
  "eventType": "finance.payment.allocated",
  "attemptsMade": 1
}
```

### Raw Error Categorization

The ~40 files with `throw new Error()` break down into categories:

**Category A: Config/boot errors (8 occurrences in 5 files) -- DO NOT CONVERT**
- `config/database.config.ts`, `config/jwt.config.ts`, `config/redis.config.ts`, `config/storage.config.ts`, `config/sentry.config.ts`
- These run during module initialization, before HTTP server starts

**Category B: Service logic errors (30+ occurrences in ~30 files) -- CONVERT to DomainException**
- `modules/order/order.service.ts` -- "Failed to create order after 3 attempts"
- `modules/order/sagas/order-completion.saga.ts` -- "Order not found", "Already completed"
- `modules/cash/cash.service.ts` -- "Failed to create voucher after multiple attempts"
- `modules/complaint/complaint.service.ts` -- "Failed to create complaint after multiple attempts"
- `modules/cost-adjustment/cost-adjustment.controller.ts` -- "Rejection note is required"
- `core/auth/auth.service.ts` -- Various auth errors
- `core/auth/api-key-rotation.service.ts` -- "API key not found"
- `modules/approval/domain/condition-evaluator.ts` -- Parse errors
- `modules/approval/domain/approval-graph-engine.ts` -- "Failed to create approval record"
- `modules/integration/sync/sync-engine.service.ts` -- "Missing id or externalId"
- `modules/integration/batch/batch-job.service.ts` -- "No handler registered"
- `modules/integration/accounting/accounting.service.ts` -- Various accounting errors
- And others

**Category C: Utility/infrastructure errors (5 occurrences in 4 files) -- CASE-BY-CASE**
- `common/utils/retry.util.ts` -- "Unreachable" (defensive, leave as-is)
- `common/utils/business-hours.ts` -- "workEnd must be greater than workStart" (convert to BadRequestException)
- `core/database/query-analyzer.service.ts` -- Multiple validation errors (convert to BadRequestException)
- `core/database/prisma.service.ts` -- Transaction error (convert to InternalServerErrorException)
- `core/encryption/encryption.service.ts` -- Crypto errors (convert to InternalServerErrorException)
- `core/vault/vault.service.ts` -- Vault errors (convert to InternalServerErrorException)
- `core/encryption/key-rotation.service.ts` -- Key rotation errors (convert to InternalServerErrorException)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `app.useGlobalFilters()` in main.ts | APP_FILTER providers in module | NestJS v8+ | Supports DI, single registration point |
| Custom error classes extending Error | Extending HttpException with errorCode | Standard NestJS pattern | Type-safe, filter-compatible |
| `cls-hooked` for async context | `nestjs-cls` or manual passing | 2023+ | nestjs-cls uses Node.js native AsyncLocalStorage |
| Console.log for errors | Structured JSON logging | ELK adoption | Machine-parseable, searchable, correlatable |

**Not using nestjs-cls rationale:** While nestjs-cls provides elegant AsyncLocalStorage-based requestId propagation, the codebase already has a working pattern: RequestIdMiddleware sets `req.requestId`, and domain events carry `metadata.correlationId`. Adding nestjs-cls would require changing how all services access requestId. For this phase, the existing pattern is sufficient.

## Filter Registration Analysis

**Current state (PROBLEMATIC):**
```
main.ts:           app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter())
app.module.ts:     APP_FILTER → PrismaExceptionFilter, APP_FILTER → SentryExceptionFilter
```

**Execution order for a Prisma error:**
1. SentryExceptionFilter (APP_FILTER, registered last = runs first) -- captures if 5xx, re-throws
2. PrismaExceptionFilter (APP_FILTER) -- catches PrismaClientKnownRequestError, sends response
3. PrismaExceptionFilter (main.ts) -- tries to catch again but exception already handled
4. HttpExceptionFilter (main.ts) -- does not match PrismaClientKnownRequestError

**Recommended state (CLEAN):**
```
app.module.ts:     APP_FILTER → HttpExceptionFilter (1st registered = runs last = fallback)
                   APP_FILTER → PrismaExceptionFilter (2nd = catches Prisma before Http)
                   APP_FILTER → SentryExceptionFilter (3rd registered = runs first = capture + re-throw)
main.ts:           NO useGlobalFilters() call
```

**Execution order for a Prisma error (fixed):**
1. SentryExceptionFilter runs first -- captures if 5xx, re-throws
2. PrismaExceptionFilter catches -- formats response with errorCode + requestId
3. HttpExceptionFilter does NOT run (Prisma filter already sent response)

**Execution order for an HttpException (fixed):**
1. SentryExceptionFilter runs first -- captures if 5xx, re-throws
2. PrismaExceptionFilter does NOT catch (not a Prisma error)
3. HttpExceptionFilter catches -- formats response with errorCode + requestId

**Execution order for unknown Error (fixed):**
1. SentryExceptionFilter runs first -- captures to Sentry, re-throws
2. PrismaExceptionFilter does NOT catch
3. HttpExceptionFilter does NOT catch (not HttpException)
4. NestJS default handler sends 500 -- BUT this produces unformatted response

**Solution for unknown errors:** Modify SentryExceptionFilter to ALSO format the response for non-HttpException, non-Prisma errors (true catch-all). Or add an AllExceptionsFilter that catches everything and formats it.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest |
| Config file | `tbs-erp-backend/jest.config.js` |
| Quick run command | `cd tbs-erp-backend && npx jest --testPathPattern="<pattern>" --no-coverage` |
| Full suite command | `cd tbs-erp-backend && npx jest --no-coverage` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ERR-01 | HTTP errors include errorCode + requestId | unit | `npx jest --testPathPattern="http-exception.filter.spec" -x` | Wave 0 |
| ERR-01 | Prisma errors include errorCode + requestId | unit | `npx jest --testPathPattern="prisma-exception.filter.spec" -x` | Wave 0 |
| ERR-01 | DomainException carries errorCode through filter | unit | `npx jest --testPathPattern="domain.exception.spec" -x` | Wave 0 |
| ERR-02 | DomainException subclasses produce correct status + errorCode | unit | `npx jest --testPathPattern="domain.exception.spec" -x` | Wave 0 |
| ERR-03 | WS errors are structured with errorCode + requestId | unit | `npx jest --testPathPattern="ws-exception.filter.spec" -x` | Wave 0 |
| ERR-03 | BullMQ processor errors are logged in structured format | unit | `npx jest --testPathPattern="processor.error-handling.spec" -x` | Wave 0 |
| ERR-06 | requestId propagates from middleware to filter to response | unit | `npx jest --testPathPattern="http-exception.filter.spec" -x` | Wave 0 |
| ERR-06 | Sentry captures requestId as tag | unit | `npx jest --testPathPattern="sentry-exception.filter.spec" -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd tbs-erp-backend && npx jest --testPathPattern="(exception|filter|error)" --no-coverage -x`
- **Per wave merge:** `cd tbs-erp-backend && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/common/filters/http-exception.filter.spec.ts` -- covers ERR-01, ERR-06
- [ ] `src/common/filters/prisma-exception.filter.spec.ts` -- covers ERR-01
- [ ] `src/common/filters/sentry-exception.filter.spec.ts` -- covers ERR-06
- [ ] `src/common/exceptions/domain.exception.spec.ts` -- covers ERR-01, ERR-02
- [ ] `src/core/websocket/ws-exception.filter.spec.ts` -- covers ERR-03
- [ ] Framework and test setup already exist (`jest.config.js`, `test/setup.ts`)

## Open Questions

1. **Should the catch-all filter return a formatted 500 response or let NestJS handle it?**
   - What we know: SentryExceptionFilter re-throws non-HttpException errors. NestJS default handler sends an unformatted response for these.
   - What's unclear: Whether SentryExceptionFilter should be modified to also format the response, or if a separate AllExceptionsFilter should be created.
   - Recommendation: Modify SentryExceptionFilter to format a standardized 500 response (with errorCode=INTERNAL_ERROR and requestId) for any exception it cannot re-throw to another filter. This keeps the filter count minimal.

2. **How many module-specific error codes are needed?**
   - What we know: The codebase has 9 FSMs across 20+ modules, each with domain-specific error scenarios.
   - What's unclear: Whether to define ALL possible error codes upfront or grow organically as raw errors are converted.
   - Recommendation: Define common/cross-cutting error codes immediately (VALIDATION_ERROR, NOT_FOUND, etc.) plus error codes for the ~40 files being converted. Additional codes can be added in future phases.

3. **Should error codes be importable by the frontend?**
   - What we know: CONTEXT.md says "error codes must be string constants, not magic strings -- importable by frontend."
   - What's unclear: Whether to create a shared package or just export as a TypeScript module.
   - Recommendation: Create the error codes file in the backend. For Phase 2 (frontend error handling), the frontend can import the same constants via a shared types package or simple copy. Don't build shared package infrastructure in Phase 1.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- All canonical files from CONTEXT.md read directly
  - `src/common/filters/http-exception.filter.ts` -- current error response shape
  - `src/common/filters/prisma-exception.filter.ts` -- Prisma error mapping
  - `src/common/filters/sentry-exception.filter.ts` -- catch-all + Sentry
  - `src/common/middleware/request-id.middleware.ts` -- UUID generation
  - `src/core/websocket/ws.gateway.ts` -- WS error patterns
  - `src/core/events/processors/*.processor.ts` -- BullMQ error handling
  - `src/core/events/event-publisher.service.ts` -- correlationId in events
  - `src/core/logger/elk-logger.service.ts` -- structured logging
  - `src/main.ts` -- filter registration
  - `src/app.module.ts` -- APP_FILTER providers
- **NestJS 11 built-in** -- HttpException hierarchy, ExceptionFilter interface, APP_FILTER token (NestJS official patterns)

### Secondary (MEDIUM confidence)
- **NestJS exception filter documentation** -- Filter execution order is reverse registration order for APP_FILTER providers. Verified against actual codebase behavior.

### Tertiary (LOW confidence)
- None -- all findings verified against actual codebase code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed, no new dependencies needed
- Architecture: HIGH -- patterns based on direct codebase analysis, NestJS built-in features
- Pitfalls: HIGH -- double filter registration bug confirmed by reading both main.ts and app.module.ts
- Error categorization: HIGH -- all ~40 `throw new Error()` sites examined and categorized

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable -- NestJS exception handling is mature, codebase patterns are established)
