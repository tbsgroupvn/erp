# Phase 4: Input Validation & Rate Limiting - Research

**Researched:** 2026-03-19
**Domain:** NestJS input sanitization, @nestjs/throttler rate limiting, file upload validation
**Confidence:** HIGH

## Summary

Phase 4 hardens all user-supplied input across three vectors: HTML sanitization on text fields, MIME/size validation on file uploads, and rate limiting on abuse-prone endpoints. The existing codebase already has solid building blocks -- `@SanitizeHtml()` / `@SanitizeHtmlStrict()` decorators using isomorphic-dompurify, `@nestjs/throttler@6.5.0` module configured globally, and partial file validation in CMS media uploads. However, there are critical gaps:

1. **Rate limiting is NOT enforced.** `ThrottlerGuard` is never registered as `APP_GUARD` nor applied via `@UseGuards()` anywhere. All existing `@Throttle()` decorators (on auth, public, document controllers) are purely decorative metadata with zero enforcement.
2. **HTML sanitization covers only 5 DTO fields** (blog title, excerpt, content, FAQ question, FAQ answer). Over 200 DTOs with user-input text fields are unsanitized.
3. **File upload validation is inconsistent.** CMS media has multer fileFilter + magic number validation; batch imports have inline MIME checks; document uploads validate via DTO `@IsIn()` but trust client-declared MIME types. Drive uploads have no MIME/size validation beyond a very generous 500MB max.

**Primary recommendation:** Register `ThrottlerGuard` globally via `APP_GUARD`, audit all DTOs to add `@SanitizeHtmlStrict()` to non-CMS text fields, and create a reusable `FileValidationPipe` for consistent upload validation across all upload endpoints.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Apply `@SanitizeHtml()` decorator to all user-input text fields across ALL DTOs -- comments, notes, descriptions, complaint text, order notes, chat messages, etc.
- CMS content fields use relaxed sanitization (allow safe HTML tags for rich text)
- Non-CMS text fields use strict sanitization (strip all HTML tags)
- Complaint submission: 5/hour per user
- Bulk import endpoints: 3/hour per user
- Public-facing endpoints: 10/minute per IP
- Auth endpoints: verify existing limits are appropriate (already have throttling)
- AI assistant: leave as-is (custom rate limit guard)
- All other authenticated endpoints: global default 60 requests/minute per user
- Return 429 with errorCode `RATE_LIMIT_EXCEEDED` and `Retry-After` header
- Global max file size: 10MB for documents, 5MB for images
- Allowed MIME types for images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Allowed MIME types for documents: `application/pdf`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel`, `text/csv`
- CMS media uploads: allow image MIME types + `video/mp4` up to 50MB
- Drive uploads: allow all above MIME types up to 25MB
- Error responses must use Phase 1 error format (errorCode + requestId)

### Claude's Discretion
- Which specific DTO fields need `@SanitizeHtml()` (based on audit)
- Implementation approach for file validation (pipe vs decorator vs multer config)
- Exact rate limit values for unspecified endpoints
- Whether to create a centralized file validation pipe or per-controller configuration
- How to differentiate CMS relaxed sanitization from strict sanitization mode

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-04 | Rate limiting applied to complaint submission (5/hour), bulk import endpoints, and all public-facing endpoints | ThrottlerGuard must be registered globally via APP_GUARD; endpoint-specific `@Throttle()` overrides for complaint, batch, public controllers; custom complaint rate limit logic for per-user hourly tracking |
| SEC-05 | HTML sanitization decorator applied to all user-input text fields (comments, notes, descriptions) | Existing `@SanitizeHtmlStrict()` decorator strips all HTML; audit reveals 200+ DTOs with ~660 `@IsString()` fields needing review; `@SanitizeHtml()` (relaxed) for CMS content only |
| SEC-06 | File upload endpoints validate file size limits and allowed MIME types | Reusable `FileValidationPipe` with configurable MIME whitelist and size limits; apply to CMS media, document, drive, batch import controllers; magic number verification via `file-type` package already available |
</phase_requirements>

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @nestjs/throttler | 6.5.0 | Rate limiting with decorator-based config | Official NestJS module, already installed and configured |
| isomorphic-dompurify | 3.0.0 | HTML sanitization in backend DTOs | Already used by @SanitizeHtml decorator, works in Node.js |
| class-transformer | 0.5.1 | Transform decorators for DTO sanitization | Already used; `@Transform()` powers sanitization decorators |
| class-validator | 0.14.1 | DTO validation decorators | Already used globally via ValidationPipe |
| file-type | 21.3.0 | Magic number detection for file uploads | Already used in CMS media service for MIME spoofing prevention |
| multer | 2.1.0 | File upload middleware | Already used via @nestjs/platform-express |

### Potentially Needed

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nest-lab/throttler-storage-redis | 1.2.0 | Redis-backed rate limit storage | Multi-instance deployment -- WITHOUT this, rate limits are per-instance memory only |

**Note on Redis storage:** The current `ThrottlerModule.forRoot()` uses in-memory storage by default. For a Docker deployment with potentially multiple backend instances, Redis storage ensures consistent rate limiting. The project already has Redis infrastructure (`@keyv/redis`, `cache-manager`). Decision: recommend adding Redis storage but this is optional for single-instance deployment.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ThrottlerGuard (global) | Custom per-endpoint guards | More flexibility but much more code; NestJS throttler already supports per-endpoint overrides via `@Throttle()` |
| @SanitizeHtmlStrict via class-transformer | NestJS Pipe-based sanitization | Pipes run after transform; decorators are simpler and already established |
| FileValidationPipe | multer fileFilter per module | fileFilter rejects before NestJS pipeline; Pipe gives better error formatting using Phase 1 error codes |

**Installation (if Redis storage is added):**
```bash
cd tbs-erp-backend && npm install @nest-lab/throttler-storage-redis
```

## Architecture Patterns

### Critical Finding: ThrottlerGuard Not Registered

**CURRENT STATE (BROKEN):**
```typescript
// app.module.ts
ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]); // Module configured
// BUT: No APP_GUARD for ThrottlerGuard
// AND: No @UseGuards(ThrottlerGuard) anywhere in the codebase
// RESULT: All @Throttle() decorators are INERT -- zero rate limiting is enforced
```

**REQUIRED FIX:**
```typescript
// app.module.ts - providers array
{
  provide: APP_GUARD,
  useClass: ThrottlerGuard,
}
```

This single change activates ALL existing `@Throttle()` decorators throughout the codebase (auth, public, CMS, document controllers). The global default from `forRoot` (100 req/60s) applies to any endpoint without an explicit `@Throttle()` override.

### Pattern 1: Global ThrottlerGuard with Per-Endpoint Overrides

**What:** Register ThrottlerGuard as APP_GUARD; use `@Throttle()` for custom limits; use `@SkipThrottle()` to exempt endpoints.
**When to use:** Standard NestJS throttler pattern -- single global guard, decorator-based overrides.

```typescript
// app.module.ts
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  imports: [
    // Global default: 60 req/min per user (updated from 100)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
  ],
})

// complaint.controller.ts - endpoint-specific override
@Post()
@Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5/hour
async create(@Body() dto: CreateComplaintDto) { ... }

// health.controller.ts - skip throttling entirely
@SkipThrottle()
@Get('health')
async healthCheck() { ... }
```

### Pattern 2: Strict vs Relaxed HTML Sanitization

**What:** Two decorator variants already exist. `@SanitizeHtmlStrict()` strips ALL HTML (for comments, notes, descriptions). `@SanitizeHtml()` allows safe HTML subset (for CMS rich text content).
**When to use:** Every user-input text field in every DTO.

```typescript
// Non-CMS DTO (strict - strip all HTML)
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class CreateComplaintDto {
  @SanitizeHtmlStrict()  // Strips ALL HTML, keeps text content
  @IsString()
  @IsNotEmpty()
  description: string;

  @SanitizeHtmlStrict()
  @IsOptional()
  @IsString()
  note?: string;
}

// CMS DTO (relaxed - allow safe HTML)
import { SanitizeHtml } from '@common/decorators/sanitize-html.decorator';

export class CreateBlogPostDto {
  @SanitizeHtml()  // Allows p, strong, em, a, img, etc.
  @IsString()
  content: string;
}
```

### Pattern 3: Reusable File Validation Pipe

**What:** A NestJS `PipeTransform` that validates uploaded files against configurable MIME type whitelist and size limits, using DomainException with Phase 1 error codes.
**When to use:** Applied via `@UsePipes()` or as parameter pipe on `@UploadedFile()` in all upload endpoints.

```typescript
// Source: recommended pattern based on NestJS docs + project conventions
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode } from '@common/exceptions/error-codes';

export interface FileValidationOptions {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
}

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(private readonly options: FileValidationOptions) {}

  transform(file: Express.Multer.File, metadata: ArgumentMetadata) {
    if (!file) return file;

    if (file.size > this.options.maxSizeBytes) {
      throw new DomainException(
        `File quá lớn. Tối đa ${this.options.maxSizeBytes / (1024 * 1024)}MB`,
        ErrorCode.FILE_TOO_LARGE,
        400,
      );
    }

    if (!this.options.allowedMimeTypes.includes(file.mimetype)) {
      throw new DomainException(
        `Loại file không được phép: ${file.mimetype}`,
        ErrorCode.FILE_TYPE_NOT_ALLOWED,
        400,
      );
    }

    return file;
  }
}

// Usage in controller:
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
async upload(
  @UploadedFile(new FileValidationPipe({
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  }))
  file: Express.Multer.File,
) { ... }
```

### Pattern 4: Complaint Per-User Hourly Rate Limit

**What:** The `@Throttle({ default: { limit: 5, ttl: 3600000 } })` on the complaint creation endpoint enforces 5 requests per 3600 seconds (1 hour) per user. NestJS ThrottlerGuard uses the request's user identifier for authenticated endpoints.
**When to use:** Complaint `create` method specifically.

**Important:** By default, ThrottlerGuard tracks by IP. For authenticated user-based limiting, a custom `getTracker()` override is needed:

```typescript
// Source: @nestjs/throttler documentation for v6
import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable, ExecutionContext } from '@nestjs/common';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Use userId for authenticated requests, IP for anonymous
    return req.user?.id || req.ip;
  }

  protected getRequestResponse(context: ExecutionContext) {
    const ctx = context.switchToHttp();
    return { req: ctx.getRequest(), res: ctx.getResponse() };
  }
}
```

### Recommended Project Structure Changes

```
src/
├── common/
│   ├── decorators/
│   │   └── sanitize-html.decorator.ts  # EXISTING - no changes needed
│   ├── exceptions/
│   │   └── error-codes.ts             # ADD: FILE_TOO_LARGE, FILE_TYPE_NOT_ALLOWED, RATE_LIMIT_EXCEEDED
│   ├── guards/
│   │   └── custom-throttler.guard.ts  # NEW: extends ThrottlerGuard, userId tracking
│   └── pipes/
│       └── file-validation.pipe.ts    # NEW: reusable file validation pipe
│   └── constants/
│       └── file-upload.constants.ts   # NEW: centralized MIME type + size limit constants
```

### Anti-Patterns to Avoid

- **Inline file validation per controller:** Each controller implementing its own MIME check (as batch.controller.ts does currently) leads to inconsistency. Use the centralized FileValidationPipe.
- **Trusting client-declared MIME type only:** The document DTO uses `@IsIn(ALLOWED_MIME_TYPES)` on a client-declared `mimeType` field -- this is spoofable. For actual file uploads (multipart), use multer + file-type magic number validation.
- **Applying @SanitizeHtml (relaxed) to non-CMS fields:** Relaxed mode allows `<a>`, `<img>`, `<table>` -- only appropriate for CMS rich text. Everything else should use `@SanitizeHtmlStrict()`.
- **Rate limiting without Retry-After header:** Phase 1 error format requires `Retry-After`. The custom ThrottlerGuard should set this header on 429 responses.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom middleware counting requests in Redis | @nestjs/throttler v6.5.0 + ThrottlerGuard | Already configured, supports decorator overrides, handles TTL/sliding window |
| HTML sanitization | Regex-based tag stripping | isomorphic-dompurify via existing @SanitizeHtml decorator | DOMPurify handles 1000+ edge cases (mutation XSS, SVG attacks, CSS injection) |
| MIME type detection | Extension-based checking | file-type package (magic number detection) | Already installed, prevents MIME spoofing (renaming .exe to .jpg) |
| Sliding window rate limit | Manual Redis ZSET implementation | @nestjs/throttler built-in algorithm | Well-tested, configurable, handles edge cases |

**Key insight:** All three libraries are already installed and partially integrated. The work is extending existing patterns to full coverage, not building new infrastructure.

## Common Pitfalls

### Pitfall 1: ThrottlerGuard Not Applied Globally
**What goes wrong:** `@Throttle()` decorators are set on controllers but no guard checks them. Rate limiting appears configured but is not enforced.
**Why it happens:** `ThrottlerModule.forRoot()` sets up the module infrastructure but does NOT auto-register the guard. Developers assume importing the module is sufficient.
**How to avoid:** Register `ThrottlerGuard` (or custom subclass) as `APP_GUARD` in `app.module.ts` providers.
**Warning signs:** No 429 responses in logs despite heavy traffic; `APP_GUARD` section only has `CsrfGuard`.

### Pitfall 2: @SanitizeHtml Decorator Order
**What goes wrong:** `@SanitizeHtml()` is a `@Transform()` decorator from class-transformer. If placed after `@IsString()`, the validation runs on unsanitized input.
**Why it happens:** Decorator execution order in TypeScript is bottom-to-top for property decorators, but class-transformer runs transforms before validation in NestJS pipeline (because `transform: true` is set in global ValidationPipe).
**How to avoid:** Place `@SanitizeHtmlStrict()` BEFORE `@IsString()` in the decorator stack (top of the stack). This matches the existing blog DTO pattern.
**Warning signs:** Validated content still contains HTML tags.

### Pitfall 3: ThrottlerGuard vs WebSocket/BullMQ
**What goes wrong:** Global ThrottlerGuard throws on non-HTTP contexts (WebSocket, CRON, BullMQ).
**Why it happens:** `ThrottlerGuard.getRequestResponse()` expects HTTP request/response objects.
**How to avoid:** Override `canActivate()` to check execution context type, skip for WS/RPC contexts. Or use `@SkipThrottle()` on WS gateways.
**Warning signs:** WebSocket connections failing with throttler errors after global guard registration.

### Pitfall 4: File Size Validation at Wrong Layer
**What goes wrong:** Multer accepts the full upload (buffering to memory/disk) before the NestJS pipe rejects it.
**Why it happens:** Multer `limits.fileSize` rejects during streaming (efficient). NestJS pipes run AFTER multer completes (file already buffered).
**How to avoid:** Set multer `limits.fileSize` to the MAXIMUM allowed across all endpoints (e.g., 50MB for CMS). Use FileValidationPipe for endpoint-specific tighter limits. This way multer prevents truly oversized files from consuming memory, and the pipe enforces business rules.
**Warning signs:** Memory spikes from large uploads before rejection.

### Pitfall 5: Rate Limit Storage in Multi-Instance Deployment
**What goes wrong:** Each backend instance has its own in-memory rate limit counter. User can bypass limits by hitting different instances.
**Why it happens:** Default ThrottlerModule uses in-memory Map storage.
**How to avoid:** Use `@nest-lab/throttler-storage-redis` for shared state. Project already has Redis.
**Warning signs:** Rate limits are bypassed in production but work in dev (single instance).

### Pitfall 6: Drive Upload Uses Presigned URLs
**What goes wrong:** Attempting to add multer-based file validation to Drive upload endpoints.
**Why it happens:** Drive uses a 2-step presigned URL flow (requestUpload -> PUT to MinIO -> confirmUpload). Files never pass through NestJS.
**How to avoid:** For Drive, validate MIME type and size in the `requestUpload` DTO (declared values) AND verify in `confirmUpload` against MinIO object metadata. Cannot do magic number validation since the file doesn't pass through NestJS.
**Warning signs:** Drive upload pipeline is different from other file uploads.

## Code Examples

### Example 1: Error Codes to Add

```typescript
// Source: existing error-codes.ts pattern
// Add to ErrorCode const object:

// -- Rate Limiting --
RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

// -- File Upload --
FILE_TOO_LARGE: 'FILE_TOO_LARGE',
FILE_TYPE_NOT_ALLOWED: 'FILE_TYPE_NOT_ALLOWED',
```

### Example 2: Custom ThrottlerGuard with Retry-After Header

```typescript
// Source: @nestjs/throttler v6 docs + Phase 1 error format
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Injectable, ExecutionContext } from '@nestjs/common';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Authenticated: track by userId; Anonymous: track by IP
    return req.user?.id || req.ip;
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: any,
  ): Promise<void> {
    const res = context.switchToHttp().getResponse();
    const retryAfter = Math.ceil(throttlerLimitDetail.ttl / 1000);
    res.setHeader('Retry-After', retryAfter.toString());

    throw new DomainException(
      `Quá nhiều yêu cầu. Vui lòng thử lại sau ${retryAfter} giây.`,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      429,
    );
  }
}
```

### Example 3: File Upload Constants

```typescript
// Source: CONTEXT.md decisions
export const FILE_UPLOAD_LIMITS = {
  IMAGE: {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  },
  DOCUMENT: {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ],
  },
  CMS_MEDIA: {
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4',
    ],
  },
  DRIVE: {
    maxSizeBytes: 25 * 1024 * 1024, // 25MB
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ],
  },
  BATCH_IMPORT: {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ],
  },
} as const;
```

### Example 4: Rate Limit Config in business.config.ts

```typescript
// Source: CONTEXT.md decisions + existing business.config.ts pattern
rateLimit: {
  login: parseInt(process.env.LOGIN_RATE_LIMIT || '5', 10),
  api: parseInt(process.env.API_RATE_LIMIT || '60', 10),       // Updated: 60/min
  complaintPerHour: parseInt(process.env.COMPLAINT_RATE_LIMIT || '5', 10),
  bulkImportPerHour: parseInt(process.env.BULK_IMPORT_RATE_LIMIT || '3', 10),
  publicPerMinute: parseInt(process.env.PUBLIC_RATE_LIMIT || '10', 10),
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `nestjs-throttler-storage-redis` (kkoomen) | `@nest-lab/throttler-storage-redis` | 2024 - original deprecated | Use @nest-lab package for Redis storage |
| ThrottlerGuard v5 (synchronous) | ThrottlerGuard v6 (async, named throttlers) | @nestjs/throttler 6.x | v6 supports multiple named throttlers, async getTracker |
| DOMPurify string sanitization | DOMPurify with JSDOM (isomorphic-dompurify) | Already current | Works in Node.js without browser DOM |

**Currently in codebase:**
- ThrottlerModule v6.5.0 is current and correct
- isomorphic-dompurify v3.0.0 is current
- file-type v21.3.0 is current

## Existing Code Audit Summary

### Endpoints Needing Rate Limit Changes

| Endpoint | Current Throttle | Required | Status |
|----------|-----------------|----------|--------|
| `POST /complaints` | None | 5/hour per user | MISSING |
| `POST /batch/import/*` | None | 3/hour per user | MISSING |
| `POST /public/leads` | 60/min (class-level) | 10/min per IP | NEEDS TIGHTENING |
| `POST /public/cms/contact` | 5/min | 10/min per IP (or keep 5) | OK (stricter) |
| `POST /public/cms/newsletter/*` | 5/min | 10/min per IP (or keep 5) | OK (stricter) |
| `POST /auth/login` | 5/15min | 5/15min | OK - verify |
| `POST /auth/forgot-password` | 3/hour | 3/hour | OK |
| AI endpoints | Custom AiRateLimitGuard | Leave as-is | OK |
| All other authenticated | None (no guard!) | 60/min per user (via global) | FIXED BY GLOBAL GUARD |

### DTOs Needing @SanitizeHtmlStrict()

Based on audit of 200+ DTO files with 660+ `@IsString()` fields, the following categories need sanitization:

**High Priority (user-facing text input):**
- Complaint: description, note (create + update DTOs)
- Order: notes, reason, description fields (create, change-status, reopen, return-request, resolve-mhh-issue)
- Chat: message content (send-message, edit-message)
- Task: title, description, comment (create-task, add-comment)
- Company Feed: post content (if applicable)
- CRM: notes, interaction notes (create-interaction-note, create-lead, update-lead)
- Customer Portal: pre-alert description (submit-pre-alert)
- Support Ticket: description, message fields
- Approval: comment (approval-comment)

**Medium Priority (internal but still user-input):**
- Warehouse: notes fields (receive-package, measure-package, consolidate, unlock-weight)
- Container: notes (create-container, delivery-order)
- Vendor: notes, description (create-vendor, rate-vendor)
- Employee: notes, reason (create-employee, deactivate-employee)
- Finance: reason, notes (create-voucher, create-journal-entry, cost-adjustment)
- Calendar: title, description, location (create-event, create-room)
- Drive: description, changeNote (request-upload, confirm-upload, request-new-version)
- Document: name (upload-document)

**Excluded from sanitization (not user-input text):**
- IDs, codes, enum values, email addresses, phone numbers, passwords
- URLs, storage keys, file paths
- Query/filter DTOs (search terms, date ranges)
- Pagination parameters

### Upload Endpoints Needing File Validation

| Controller | Method | Current Validation | Required |
|------------|--------|-------------------|----------|
| `media.controller` | `upload`, `uploadMultiple` | multer fileFilter (MIME) + service magic number check | Update MIME list + size per CONTEXT.md |
| `batch.controller` | `importOrders` | Inline `allowedMimes` check | Replace with FileValidationPipe, add 10MB size limit |
| `document.controller` | `upload` | DTO-level `@IsIn(MIME)` + `@Max(size)` | Add FileValidationPipe for actual file uploads; DTO validates metadata |
| `drive.controller` | `requestUpload` | DTO `@Max(524288000)` (500MB!) | Tighten to 25MB in DTO, validate MIME in DTO |
| `blog.controller` | Cover image upload (if multipart) | None visible | Investigate, add if needed |
| `carrier-reconciliation.controller` | Reconciliation file upload | Unknown | Investigate, add if needed |

## Open Questions

1. **ThrottlerGuard and WebSocket Gateway**
   - What we know: WsGateway at `src/core/websocket/ws.gateway.ts` handles Socket.IO connections
   - What's unclear: Whether global ThrottlerGuard will interfere with WebSocket handshake/events
   - Recommendation: Add `@SkipThrottle()` to WsGateway class. ThrottlerGuard v6 has HTTP context checks but better safe than explicit.

2. **Health/Metrics Endpoints**
   - What we know: HealthModule and MetricsModule expose endpoints for monitoring
   - What's unclear: Whether they already have `@Public()` or need `@SkipThrottle()`
   - Recommendation: Add `@SkipThrottle()` to health and metrics controllers to prevent monitoring false positives.

3. **Redis Storage for Throttler**
   - What we know: In-memory storage works for single instance; project uses Docker
   - What's unclear: Whether production runs multiple backend instances
   - Recommendation: Add Redis storage for correctness, since the Redis infrastructure already exists. But this is optional for the hardening milestone.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | `tbs-erp-backend/jest.config.js` |
| Quick run command | `cd tbs-erp-backend && npx jest --testPathPattern="test_name" --forceExit` |
| Full suite command | `cd tbs-erp-backend && npx jest --forceExit` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-04 | Complaint 5/hr rate limit returns 429 | unit | `npx jest --testPathPattern="throttler" --forceExit` | No - Wave 0 |
| SEC-04 | Bulk import 3/hr rate limit returns 429 | unit | `npx jest --testPathPattern="throttler" --forceExit` | No - Wave 0 |
| SEC-04 | Public endpoint 10/min rate limit | unit | `npx jest --testPathPattern="throttler" --forceExit` | No - Wave 0 |
| SEC-05 | Script tags stripped from complaint description | unit | `npx jest --testPathPattern="sanitize" --forceExit` | No - Wave 0 |
| SEC-05 | CMS content preserves safe HTML tags | unit | `npx jest --testPathPattern="sanitize" --forceExit` | No - Wave 0 |
| SEC-06 | Oversized file returns FILE_TOO_LARGE error | unit | `npx jest --testPathPattern="file-validation" --forceExit` | No - Wave 0 |
| SEC-06 | Disallowed MIME type returns FILE_TYPE_NOT_ALLOWED | unit | `npx jest --testPathPattern="file-validation" --forceExit` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd tbs-erp-backend && npx jest --testPathPattern="<related_test>" --forceExit`
- **Per wave merge:** `cd tbs-erp-backend && npx jest --forceExit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tbs-erp-backend/test/unit/sanitize-html.spec.ts` -- covers SEC-05 (strict + relaxed modes)
- [ ] `tbs-erp-backend/test/unit/file-validation.pipe.spec.ts` -- covers SEC-06
- [ ] `tbs-erp-backend/test/unit/custom-throttler.guard.spec.ts` -- covers SEC-04

## Sources

### Primary (HIGH confidence)
- Codebase audit: `app.module.ts` -- verified ThrottlerGuard is NOT registered as APP_GUARD
- Codebase audit: `sanitize-html.decorator.ts` -- verified @SanitizeHtml and @SanitizeHtmlStrict exist and work correctly
- Codebase audit: All controller/DTO files -- verified current sanitization and throttling coverage gaps
- `package.json` -- verified installed package versions
- npm registry -- verified `@nestjs/throttler@6.5.0` is latest, `@nest-lab/throttler-storage-redis@1.2.0` available

### Secondary (MEDIUM confidence)
- [@nestjs/throttler documentation](https://docs.nestjs.com/security/rate-limiting) -- ThrottlerGuard registration, @Throttle/@SkipThrottle decorators
- [NestJS throttler Redis storage](https://www.npmjs.com/package/@nest-lab/throttler-storage-redis) -- Redis storage for multi-instance
- [DOMPurify documentation](https://github.com/cure53/DOMPurify) -- sanitization configuration options

### Tertiary (LOW confidence)
- Community articles on ThrottlerGuard v6 `throwThrottlingException` override -- API may differ slightly, verify against installed version

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed and verified in node_modules
- Architecture: HIGH -- patterns derived from existing codebase + official NestJS docs
- Pitfalls: HIGH -- ThrottlerGuard gap confirmed by codebase grep; all pitfalls verified against actual code
- Sanitization scope: MEDIUM -- 200+ DTOs identified but specific field-by-field audit deferred to implementation

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable libraries, no breaking changes expected)
