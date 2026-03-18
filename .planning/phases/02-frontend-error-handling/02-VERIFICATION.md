---
phase: 02-frontend-error-handling
verified: 2026-03-18T11:45:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Trigger a mutation failure (e.g., submit an order with invalid data)"
    expected: "A single Vietnamese toast appears — no duplicate toasts, message matches the errorCode from backend, requestId shown in description"
    why_human: "Cannot programmatically fire an HTTP mutation and observe toast behavior; requires a running dev environment"
  - test: "Navigate to a broken dashboard page (e.g., throw an error in a page component)"
    expected: "Sidebar and topbar remain visible; in-context error card appears with 'Thu lai' retry button and 'Quay ve trang chu' link to /tong-quan"
    why_human: "Next.js error boundary rendering requires a browser environment"
  - test: "Crash the root layout (e.g., throw in layout.tsx)"
    expected: "global-error.tsx renders with its own html/body, 'Tai lai trang' reload button appears, no white screen"
    why_human: "Root layout crash requires a running Next.js application"
  - test: "Verify Sentry receives events with correct tags"
    expected: "Sentry events include boundary tag (global/dashboard/public/root/component), userRole tag, and path in extra"
    why_human: "Requires a valid NEXT_PUBLIC_SENTRY_DSN and live Sentry project to observe incoming events"
---

# Phase 02: Frontend Error Handling Verification Report

**Phase Goal:** The frontend never shows a white-screen crash — every error is caught, displayed as a user-friendly message, and reported
**Verified:** 2026-03-18T11:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | API mutation failures display Vietnamese toast with parsed errorCode message | VERIFIED | `query-provider.tsx` lines 110-119: `parseApiError` + `getErrorMessage` + `toast.error` wired in mutations.onError |
| 2 | Toast shows requestId in description for support contact | VERIFIED | `query-provider.tsx` line 116: `\u00e3 l\u1ed7i: ${parsed.requestId}` conditional description |
| 3 | Unknown error codes show generic fallback message | VERIFIED | `error-messages.ts` line 8: `DEFAULT_MESSAGE` constant; `getErrorMessage` returns it when code is undefined or unrecognized |
| 4 | Query failures do NOT show toast (only mutations) | VERIFIED | `query-provider.tsx` queries section has no `onError` with toast; only mutations.onError triggers toast |
| 5 | Sentry SDK initializes without errors when DSN is configured | VERIFIED | `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` all call `Sentry.init` with DSN from env |
| 6 | Navigating to broken dashboard page shows in-context error UI with retry (sidebar visible) | VERIFIED | `(dashboard)/error.tsx`: min-h-[400px] card, reset() button, plain `<a href="/tong-quan">` — renders inside shell |
| 7 | A root layout crash shows global-error.tsx with own html/body and reload button | VERIFIED | `global-error.tsx`: contains `<html lang="vi">`, `<body>`, `window.location.reload()` |
| 8 | ErrorBoundary reports errors to Sentry via captureException in componentDidCatch | VERIFIED | `error-boundary.tsx` lines 56-63: `Sentry.captureException` with boundary, userRole, path, componentStack |
| 9 | No duplicate toast notifications on mutation failure | VERIFIED | `grep -rn "toast.error" src/lib/hooks/` returns exactly 1 match — in `use-automation.ts` inside `onSuccess` (business logic, not a duplicate error handler) |
| 10 | All 50+ backend ErrorCode values have Vietnamese message mappings | VERIFIED | `error-messages.ts`: all 50 error codes from backend `ErrorCode` registry mapped, including BATCH_IMPORT_VALIDATION_ERROR |

**Score:** 10/10 truths verified

---

### Required Artifacts

#### Plan 02-01 Artifacts (ERR-05)

| Artifact | Status | Details |
|----------|--------|---------|
| `tbs-erp-frontend/src/lib/utils/error-messages.ts` | VERIFIED | 121 lines; exports `getErrorMessage`; contains `ORDER_NOT_FOUND`, `INVALID_CREDENTIALS`, `BATCH_IMPORT_VALIDATION_ERROR`; DEFAULT_MESSAGE defined |
| `tbs-erp-frontend/src/lib/utils/parse-api-error.ts` | VERIFIED | 62 lines; exports `parseApiError` and `ParsedApiError`; checks `success === false`; extracts `errorCode`, `requestId`; imports `AxiosError` |
| `tbs-erp-frontend/src/lib/providers/query-provider.tsx` | VERIFIED | Contains `toast.error(message,` in mutations.onError; imports `parseApiError` and `getErrorMessage`; queries section has no toast |
| `tbs-erp-frontend/instrumentation-client.ts` | VERIFIED | Contains `Sentry.init`, `beforeSend` with 401/403 filter, `browserTracingIntegration`, `replayIntegration` |
| `tbs-erp-frontend/next.config.mjs` | VERIFIED | Contains `import { withSentryConfig }`, `withSentryConfig(config,`, `hideSourceMaps: true` |

#### Plan 02-02 Artifacts (ERR-04)

| Artifact | Status | Details |
|----------|--------|---------|
| `tbs-erp-frontend/src/app/global-error.tsx` | VERIFIED | 70 lines; `'use client'`; `<html lang="vi">`; `<body>`; `level: 'fatal'`; `window.location.href` in extra; `window.location.reload()` |
| `tbs-erp-frontend/src/app/(dashboard)/error.tsx` | VERIFIED | 73 lines; `'use client'`; `Sentry.captureException` with `boundary: 'dashboard'`; `useAuthStore.getState().user?.role`; `reset()` button; `<a href="/tong-quan">` |
| `tbs-erp-frontend/src/app/(public)/error.tsx` | VERIFIED | 71 lines; `'use client'`; `Sentry.captureException` with `boundary: 'public'`; `window.history.back()`; `from-blue-50 via-white to-blue-50` gradient |
| `tbs-erp-frontend/src/components/shared/error-boundary.tsx` | VERIFIED | `Sentry.captureException` in `componentDidCatch`; includes `componentStack`; no TODO comment remaining; `withErrorBoundary` HOC preserved |

#### Plan 02-03 Artifacts (ERR-05, duplicate toast cleanup)

| Artifact | Status | Details |
|----------|--------|---------|
| `tbs-erp-frontend/src/lib/hooks/use-orders.ts` | VERIFIED | 0 `toast.error` calls; `toast.success` calls preserved |
| `tbs-erp-frontend/src/lib/hooks/use-containers.ts` | VERIFIED | 0 `toast.error` calls |
| All 47 hook files | VERIFIED | `grep -rn "toast.error" src/lib/hooks/` returns 1 match total — in `use-automation.ts` line 111 inside `onSuccess` (business logic: test failure result display, not a duplicate error handler) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `query-provider.tsx` | `parse-api-error.ts` | `import parseApiError` | WIRED | Line 10: `import { parseApiError } from '@/lib/utils/parse-api-error'`; used line 111 |
| `query-provider.tsx` | `error-messages.ts` | `import getErrorMessage` | WIRED | Line 11: `import { getErrorMessage } from '@/lib/utils/error-messages'`; used line 112 |
| `global-error.tsx` | `@sentry/nextjs` | `import * as Sentry` | WIRED | Line 5: `Sentry.captureException` called with `level: 'fatal'` |
| `(dashboard)/error.tsx` | `@sentry/nextjs` | `import * as Sentry` | WIRED | Line 5; `captureException` with `boundary: 'dashboard'` |
| `(dashboard)/error.tsx` | `auth-store.ts` | `import { useAuthStore }` | WIRED | Line 6; `useAuthStore.getState().user?.role` called in useEffect |
| `error-boundary.tsx` | `@sentry/nextjs` | `import * as Sentry` | WIRED | Line 5; `captureException` in `componentDidCatch` with component stack |
| `hooks/*.ts` | `query-provider.tsx` | QueryClient centralized mutation onError | WIRED | 47 hook files contain 0 `toast.error` in mutation onError; centralized handler is sole source |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ERR-04 | 02-02 | Next.js App Router has `global-error.tsx` at app root and `error.tsx` at `(dashboard)/` and `(public)/` route levels | SATISFIED | All 3 files exist: `src/app/global-error.tsx`, `src/app/(dashboard)/error.tsx`, `src/app/(public)/error.tsx` |
| ERR-05 | 02-01, 02-03 | Frontend displays user-friendly error messages via toast notifications instead of white-screen crashes | SATISFIED | Centralized mutation onError in QueryClient uses `getErrorMessage` for Vietnamese text; 47 hooks have zero duplicate toast.error in onError; error boundaries catch render-level errors |

Both requirements declared in PLAN frontmatter are fully accounted for and satisfied.

**Orphaned requirements check:** REQUIREMENTS.md maps only ERR-04 and ERR-05 to Phase 2. No additional requirements are mapped to Phase 2 that are unclaimed by plans. Zero orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/error.tsx` | 9 | Component named `GlobalError` but file is root `error.tsx` (not `global-error.tsx`) | Info | Naming is misleading but functionally harmless — Next.js uses file location, not function name, for routing |
| `src/app/global-error.tsx` | — | Does not use `reset` prop (received but unused) | Info | The plan specifies using `window.location.reload()` instead of `reset()` for crashed layout; this is correct behavior per the plan's locked decision |

No blocker anti-patterns found. No FIXME/TODO/placeholder comments remain in modified files. No empty implementations.

---

### Human Verification Required

#### 1. Single Toast on Mutation Failure

**Test:** Log into the ERP, trigger a mutation that fails (e.g., attempt to transition an order to an invalid state)
**Expected:** Exactly one Vietnamese toast notification appears — no duplicates. Message is human-readable (e.g., "Khong the chuyen trang thai don hang"). If the API returns a requestId, it appears as "Ma loi: {requestId}" in the toast description.
**Why human:** Cannot programmatically trigger an HTTP mutation through a running backend and observe the toast rendering layer.

#### 2. Dashboard Error Boundary — In-Context Recovery

**Test:** Add `throw new Error('test')` to any dashboard page component, navigate to it
**Expected:** Sidebar and topbar remain visible. A red error card appears in the main content area with "Da xay ra loi" heading, "Thu lai" button, and "Quay ve trang chu" link. Dev mode shows collapsible error details.
**Why human:** Next.js error boundary activation requires a running Next.js dev or prod server.

#### 3. Root Layout Crash — global-error.tsx

**Test:** Add `throw new Error('test')` inside the root `layout.tsx`, reload the page
**Expected:** Page shows `global-error.tsx` output: its own HTML shell, "He thong gap su co" heading, "Tai lai trang" button, no router/sidebar elements visible.
**Why human:** Root layout crash requires a running Next.js application and cannot be simulated by file inspection.

#### 4. Sentry Event Receipt with Context

**Test:** With a valid `NEXT_PUBLIC_SENTRY_DSN`, trigger any of the above errors
**Expected:** Sentry dashboard receives events with tags: `boundary` = (global/dashboard/public/root/component), `userRole` = authenticated user's role. Extra context includes `path` (pathname or href).
**Why human:** Requires a live Sentry project; cannot verify network event delivery programmatically.

---

### Gaps Summary

No gaps. All 10 observable truths are verified. Both requirements (ERR-04, ERR-05) are satisfied by substantive, wired implementations:

- **ERR-05 (toast):** `error-messages.ts` maps all 50+ error codes, `parse-api-error.ts` extracts the structured error, `query-provider.tsx` wires them into the centralized mutation onError toast. All 47 hook files have had duplicate `toast.error` calls removed.
- **ERR-04 (error boundaries):** `global-error.tsx` handles root layout crashes with own HTML shell; `(dashboard)/error.tsx` renders inside the dashboard shell preserving navigation; `(public)/error.tsx` shows branded public error page. `error-boundary.tsx` and root `error.tsx` both report to Sentry with route path and user role context.

The one remaining `toast.error` call across all 47 hook files (`use-automation.ts:111`) is correctly placed inside `onSuccess` as business logic displaying a test execution failure result — it is not a duplicate mutation error handler.

---

_Verified: 2026-03-18T11:45:00Z_
_Verifier: Claude (gsd-verifier)_
