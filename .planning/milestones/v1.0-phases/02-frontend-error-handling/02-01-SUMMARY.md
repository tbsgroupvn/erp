---
phase: 02-frontend-error-handling
plan: 01
subsystem: ui
tags: [error-handling, sentry, toast, tanstack-query, axios, i18n-vi]

# Dependency graph
requires:
  - phase: 01-backend-error-standardization
    provides: ErrorCode registry and StandardErrorResponse interface
provides:
  - Error code to Vietnamese message mapping (getErrorMessage)
  - API error parser for AxiosError (parseApiError)
  - Sentry SDK initialization (client, server, edge)
  - Centralized mutation onError toast in QueryClient
affects: [02-frontend-error-handling, 03-frontend-hooks-cleanup]

# Tech tracking
tech-stack:
  added: ["@sentry/nextjs"]
  patterns: ["centralized mutation error toast", "error code to i18n message mapping", "Sentry beforeSend filter for auth errors"]

key-files:
  created:
    - tbs-erp-frontend/src/lib/utils/error-messages.ts
    - tbs-erp-frontend/src/lib/utils/parse-api-error.ts
    - tbs-erp-frontend/instrumentation-client.ts
    - tbs-erp-frontend/sentry.server.config.ts
    - tbs-erp-frontend/sentry.edge.config.ts
    - tbs-erp-frontend/instrumentation.ts
  modified:
    - tbs-erp-frontend/next.config.mjs
    - tbs-erp-frontend/.env.example
    - tbs-erp-frontend/src/lib/providers/query-provider.tsx
    - tbs-erp-frontend/package.json

key-decisions:
  - "Vietnamese diacritics used in error messages matching codebase convention (Unicode escapes in source for safety)"
  - "Sentry 401/403 errors filtered in beforeSend to avoid noise from auth flow"
  - "Mutation toast shows requestId as description for support contact tracing"

patterns-established:
  - "Error message pattern: getErrorMessage(errorCode) returns Vietnamese string, falls back to generic message"
  - "API error parsing pattern: parseApiError(error) extracts errorCode, requestId, message, statusCode from AxiosError"
  - "Sentry config pattern: 4 files at project root (instrumentation-client, sentry.server.config, sentry.edge.config, instrumentation)"

requirements-completed: [ERR-05]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 2 Plan 1: Error Utilities and Sentry Setup Summary

**Error parsing utilities with 50+ Vietnamese message mappings, Sentry SDK integration, and centralized mutation error toasts via QueryClient**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T09:54:52Z
- **Completed:** 2026-03-18T09:58:25Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Created error-messages.ts mapping all 50+ backend ErrorCode values to Vietnamese user-friendly messages
- Created parse-api-error.ts to extract errorCode, requestId, message, statusCode from AxiosError responses
- Installed @sentry/nextjs and configured 4 Sentry config files (client, server, edge, instrumentation)
- Wrapped next.config.mjs with withSentryConfig (hideSourceMaps: true, disableLogger: true)
- Replaced generic console.error mutation handler with parsed error toast showing Vietnamese messages

## Task Commits

Each task was committed atomically:

1. **Task 1: Create error parsing utilities** - `123136b` (feat)
2. **Task 2: Install Sentry SDK and create config files** - `60168a1` (feat)
3. **Task 3: Centralize mutation onError with parsed error toast** - `40d7195` (feat)

## Files Created/Modified
- `tbs-erp-frontend/src/lib/utils/error-messages.ts` - ErrorCode to Vietnamese message mapping with getErrorMessage()
- `tbs-erp-frontend/src/lib/utils/parse-api-error.ts` - AxiosError parser for StandardErrorResponse with parseApiError()
- `tbs-erp-frontend/instrumentation-client.ts` - Sentry client init with browser tracing, replay, and 401/403 filter
- `tbs-erp-frontend/sentry.server.config.ts` - Sentry server-side init
- `tbs-erp-frontend/sentry.edge.config.ts` - Sentry edge runtime init
- `tbs-erp-frontend/instrumentation.ts` - Next.js instrumentation with register() and onRequestError
- `tbs-erp-frontend/next.config.mjs` - Added withSentryConfig wrapper with hideSourceMaps
- `tbs-erp-frontend/.env.example` - Added SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN
- `tbs-erp-frontend/src/lib/providers/query-provider.tsx` - Replaced mutation onError with parsed error toast
- `tbs-erp-frontend/package.json` - Added @sentry/nextjs dependency

## Decisions Made
- Used Unicode escape sequences for Vietnamese diacritics in error-messages.ts source code for cross-platform safety, matching patterns seen in existing codebase
- Sentry beforeSend filters out 401/403 responses since those are handled by the app's auth flow (token refresh interceptor)
- Mutation toast description shows requestId (formatted as "Ma loi: {requestId}") for customer support traceability
- Query failures intentionally do NOT trigger toast -- error boundaries handle render-level errors from failed queries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

To enable Sentry error reporting, set the following environment variables:
- `NEXT_PUBLIC_SENTRY_DSN` - Sentry project DSN
- `SENTRY_ORG` - Sentry organization slug
- `SENTRY_PROJECT` - Sentry project slug
- `SENTRY_AUTH_TOKEN` - Sentry auth token (for source map uploads)

Without these variables, Sentry will silently not initialize (DSN is undefined).

## Next Phase Readiness
- Error utilities (getErrorMessage, parseApiError) ready for consumption by Plan 02 (error boundaries) and Plan 03 (hook cleanup)
- Sentry SDK ready to capture unhandled exceptions and request errors
- Centralized mutation error toast active for all mutations across the app

## Self-Check: PASSED

All 6 created files verified present. All 3 task commits verified in git log.

---
*Phase: 02-frontend-error-handling*
*Completed: 2026-03-18*
