---
phase: 04-input-validation-rate-limiting
plan: 03
subsystem: api
tags: [file-upload, validation, mime-type, size-limit, security, nestjs-pipe]

# Dependency graph
requires:
  - phase: 04-01
    provides: FileValidationPipe, FILE_UPLOAD_LIMITS constants, error codes FILE_TOO_LARGE/FILE_TYPE_NOT_ALLOWED
provides:
  - FileValidationPipe applied to CMS media upload endpoints (single + multi-file)
  - Document upload DTO using centralized DOCUMENT+IMAGE MIME/size limits
  - Batch import using FileValidationPipe with BATCH_IMPORT limits
  - Drive presigned URL DTOs with 25MB size cap and MIME whitelist
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FileValidationPipe in @UploadedFile() for multer-based uploads"
    - "Loop validation for @UploadedFiles() multi-file endpoints"
    - "DTO-level @Max/@IsIn for presigned URL flows where file never passes through NestJS"

key-files:
  created: []
  modified:
    - tbs-erp-backend/src/modules/cms-media/media.controller.ts
    - tbs-erp-backend/src/modules/document/dto/upload-document.dto.ts
    - tbs-erp-backend/src/modules/document/dto/add-version.dto.ts
    - tbs-erp-backend/src/modules/batch/batch.controller.ts
    - tbs-erp-backend/src/modules/drive/dto/index.ts

key-decisions:
  - "Document controller uses DTO-based S3 upload flow (not multer), so validation applied via @Max/@IsIn in DTO instead of FileValidationPipe"
  - "Drive presigned URL flow uses DTO-level declared MIME/size validation (no magic number validation possible)"
  - "AddVersionDto also tightened with DOCUMENT limits and MIME whitelist for defense-in-depth"
  - "All 4 Drive DTOs (RequestUpload, ConfirmUpload, RequestNewVersion, ConfirmNewVersion) validated consistently"

patterns-established:
  - "Multer endpoints: use FileValidationPipe in @UploadedFile() decorator"
  - "Multi-file endpoints: instantiate FileValidationPipe and call transform() in loop"
  - "Presigned URL endpoints: use @Max and @IsIn decorators on DTO size/mimeType fields"

requirements-completed: [SEC-06]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 4 Plan 3: File Upload Validation Summary

**FileValidationPipe applied to CMS/batch upload endpoints, Document and Drive DTOs tightened with centralized size/MIME limits from FILE_UPLOAD_LIMITS**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T02:07:12Z
- **Completed:** 2026-03-19T02:12:35Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- CMS media upload validates against CMS_MEDIA limits (50MB, image + video/mp4) for both single and multi-file endpoints
- Document upload DTO uses centralized DOCUMENT+IMAGE limits (10MB, PDF/Excel/CSV/images), replacing hardcoded 50MB limit
- Batch import uses FileValidationPipe with BATCH_IMPORT limits (10MB, Excel/CSV only), replacing inline MIME check
- Drive presigned URL DTOs reduced from 500MB to 25MB with MIME type whitelist on all 4 DTOs

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply FileValidationPipe to CMS media, document, and batch upload endpoints** - `521b2d6` (feat)
2. **Task 2: Tighten Drive upload DTO validation (presigned URL flow)** - `6302158` (feat)

## Files Created/Modified
- `tbs-erp-backend/src/modules/cms-media/media.controller.ts` - Added FileValidationPipe to upload and uploadMultiple methods
- `tbs-erp-backend/src/modules/document/dto/upload-document.dto.ts` - Replaced hardcoded MIME list and 50MB limit with FILE_UPLOAD_LIMITS constants
- `tbs-erp-backend/src/modules/document/dto/add-version.dto.ts` - Added MIME whitelist and 10MB size limit from centralized constants
- `tbs-erp-backend/src/modules/batch/batch.controller.ts` - Added FileValidationPipe, removed inline allowedMimes check
- `tbs-erp-backend/src/modules/drive/dto/index.ts` - All 4 upload DTOs: 25MB max, MIME whitelist, XSS-safe filenames

## Decisions Made
- Document controller uses DTO-based S3 upload flow (not multer @UploadedFile), so validation applied via @Max/@IsIn in DTO instead of FileValidationPipe -- this is the correct approach since the file never passes through NestJS
- Drive presigned URL flow cannot do magic number validation (file goes directly to MinIO) -- DTO-level declared MIME/size validation is the best achievable defense
- AddVersionDto also received centralized limits for defense-in-depth (was previously 512MB with no MIME check)
- All 4 Drive DTOs validated consistently (RequestUpload, ConfirmUpload, RequestNewVersion, ConfirmNewVersion)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] AddVersionDto had no MIME validation and 512MB size limit**
- **Found during:** Task 1 (document upload validation)
- **Issue:** AddVersionDto allowed any MIME type and up to 512MB -- inconsistent with upload-document.dto.ts limits
- **Fix:** Added @IsIn with DOCUMENT+IMAGE MIME whitelist and @Max with FILE_UPLOAD_LIMITS.DOCUMENT.maxSizeBytes
- **Files modified:** tbs-erp-backend/src/modules/document/dto/add-version.dto.ts
- **Verification:** TypeScript compiles, DTO now validates MIME and size consistently
- **Committed in:** 521b2d6 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Drive ConfirmUpload/Version DTOs missing size/MIME validation**
- **Found during:** Task 2 (Drive DTO validation)
- **Issue:** ConfirmUploadDto, RequestNewVersionDto, and ConfirmNewVersionDto had no @Max on size and no MIME whitelist
- **Fix:** Added @Max(25MB) and @IsIn(DRIVE.allowedMimeTypes) to all DTOs; added @SanitizeHtmlStrict on filename fields
- **Files modified:** tbs-erp-backend/src/modules/drive/dto/index.ts
- **Verification:** TypeScript compiles, all 4 DTOs now enforce consistent limits
- **Committed in:** 6302158 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both auto-fixes fill validation gaps the plan identified but only partially covered. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All file upload endpoints now have consistent size and MIME type validation
- Phase 4 (Input Validation & Rate Limiting) is complete with all 3 plans finished
- Ready for Phase 5: RBAC Audit

---
*Phase: 04-input-validation-rate-limiting*
*Completed: 2026-03-19*
