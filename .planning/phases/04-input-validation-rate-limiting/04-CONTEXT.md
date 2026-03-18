# Phase 4: Input Validation & Rate Limiting - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden all user-supplied input: sanitize HTML in text fields, validate file uploads (size + MIME), and enforce rate limits on abuse-prone endpoints. This phase does NOT add new business logic, change API contracts, or modify authentication flows.

</domain>

<decisions>
## Implementation Decisions

### HTML Sanitization Scope
- Apply `@SanitizeHtml()` decorator to all user-input text fields across ALL DTOs (not just CMS) — comments, notes, descriptions, complaint text, order notes, chat messages, etc.
- The existing `@SanitizeHtml` decorator and `html-sanitizer.util.ts` are already solid — reuse them
- Audit all DTOs with string fields that accept user input and add the decorator
- CMS content fields (blog body, page content) use a relaxed sanitization mode (allow safe HTML tags for rich text)
- Non-CMS text fields use strict sanitization (strip all HTML tags)
- Claude has discretion on which specific DTO fields need the decorator (based on codebase audit)

### Rate Limit Thresholds
- Complaint submission: 5/hour per user (per requirement SEC-04)
- Bulk import endpoints: 3/hour per user (prevent abuse of resource-intensive operations)
- Public-facing endpoints (contact form, registration, newsletter): 10/minute per IP
- Auth endpoints (login, register): already have throttling — verify limits are appropriate
- AI assistant: already has custom rate limit guard — leave as-is
- All other authenticated endpoints: use global default (60 requests/minute per user)
- Return `429 Too Many Requests` with `errorCode: 'RATE_LIMIT_EXCEEDED'` and `Retry-After` header (Phase 1 error format)
- Claude has discretion on exact rate limit values for endpoints not specified above

### File Upload Rules
- Global max file size: 10MB for documents, 5MB for images
- Allowed MIME types for images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Allowed MIME types for documents: `application/pdf`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (xlsx), `application/vnd.ms-excel` (xls), `text/csv`
- CMS media uploads: allow image MIME types + `video/mp4` up to 50MB
- Drive uploads: allow all above MIME types up to 25MB
- Reject with clear error message using Phase 1 error format (`FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`)
- Claude has discretion on how to implement (pipe-based validation, custom decorator, or multer fileFilter)

### Claude's Discretion
- Which specific DTO fields need `@SanitizeHtml()` (based on audit)
- Implementation approach for file validation (pipe vs decorator vs multer config)
- Exact rate limit values for unspecified endpoints
- Whether to create a centralized file validation pipe or per-controller configuration
- How to differentiate CMS relaxed sanitization from strict sanitization mode

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### HTML sanitization
- `tbs-erp-backend/src/common/decorators/sanitize-html.decorator.ts` — Existing @SanitizeHtml decorator implementation
- `tbs-erp-backend/src/common/utils/html-sanitizer.util.ts` — Sanitization utility with DOMPurify or similar
- `tbs-erp-backend/src/modules/blog/dto/create-blog-post.dto.ts` — Example of @SanitizeHtml usage on CMS DTO

### Rate limiting
- `tbs-erp-backend/src/app.module.ts` — ThrottlerModule configuration (global defaults)
- `tbs-erp-backend/src/config/business.config.ts` — Business config with rate limit values
- `tbs-erp-backend/src/modules/complaint/complaint.service.ts` — Complaint service (target for 5/hr limit)
- `tbs-erp-backend/src/modules/public/public.controller.ts` — Public endpoints (target for IP-based limits)
- `tbs-erp-backend/src/modules/public/public-cms.controller.ts` — Public CMS endpoints
- `tbs-erp-backend/src/core/auth/auth.controller.ts` — Auth endpoints with existing throttling

### File upload
- `tbs-erp-backend/src/modules/cms-media/media.controller.ts` — CMS media upload with multer
- `tbs-erp-backend/src/modules/document/document.controller.ts` — Document upload endpoint
- `tbs-erp-backend/src/modules/drive/drive.controller.ts` — Drive file upload
- `tbs-erp-backend/src/modules/batch/batch.controller.ts` — Bulk import upload

### Error codes (from Phase 1)
- `tbs-erp-backend/src/common/exceptions/error-codes.ts` — ErrorCode registry (add RATE_LIMIT_EXCEEDED, FILE_TOO_LARGE, FILE_TYPE_NOT_ALLOWED)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@SanitizeHtml()` decorator: Already implemented, applied to CMS DTOs — extend to all user-input DTOs
- `ThrottlerModule`: Already configured globally in `app.module.ts` — add endpoint-specific overrides
- `@Throttle()` decorator: Already used on auth, public, AI controllers — apply to complaint, bulk import
- `AiRateLimitGuard`: Custom rate limit guard for AI assistant — reference for custom per-endpoint logic
- `ErrorCode` registry: Phase 1 infrastructure — add new codes for rate limiting and file validation

### Established Patterns
- DTO validation: `class-validator` decorators (`@IsString()`, `@IsOptional()`, etc.)
- File upload: `@UseInterceptors(FileInterceptor('file'))` with multer
- Rate limiting: `@Throttle({ default: { limit: N, ttl: T } })` per controller/method
- Global guards: `APP_GUARD` provider in `app.module.ts`

### Integration Points
- All DTOs with user-input text fields — need `@SanitizeHtml()` decorator
- Complaint controller — 5/hr rate limit
- Bulk import controllers — 3/hr rate limit
- Public controllers — 10/min per IP rate limit
- File upload controllers — size + MIME validation
- ErrorCode registry — new error codes

</code_context>

<specifics>
## Specific Ideas

- User delegated all decisions to Claude
- Complaint rate limit of 5/hour is per requirement SEC-04
- Error responses must use Phase 1 error format (errorCode + requestId)
- CMS rich text needs relaxed sanitization (allow safe HTML), everything else strict

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-input-validation-rate-limiting*
*Context gathered: 2026-03-18*
