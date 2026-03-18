# Phase 2: Frontend Error Handling - Research

**Researched:** 2026-03-18
**Domain:** Next.js 14 App Router error handling, Sentry integration, toast notifications
**Confidence:** HIGH

## Summary

Phase 2 builds frontend error resilience for the TBS ERP application. The project uses Next.js 14.2.21 (App Router), TanStack Query v5, sonner toast library, and Axios. Phase 1 already established the backend's `StandardErrorResponse` format with `errorCode`, `requestId`, `message`, `statusCode`, and `timestamp` fields. The backend has a comprehensive `ErrorCode` const registry with 40+ domain-specific codes.

The existing codebase has good foundations: an `ErrorBoundary` class component with Vietnamese UI, an `ErrorState` component with multiple variants (inline/fullpage) and error types (generic/network/server/permission), a root-level `error.tsx` page, a `not-found.tsx` page, a `/403` page, and 47 hooks with per-mutation `toast.error()` calls using hardcoded Vietnamese messages. The key gaps are: no `global-error.tsx`, no route-group-level `error.tsx` files for `(dashboard)/` and `(public)/`, no centralized error parsing from the backend's standardized responses, no Sentry integration, and the QueryClient's mutation `onError` only logs to console without showing toast.

**Primary recommendation:** Create Next.js error boundary files at three levels (global, dashboard, public), centralize API error parsing in a utility that maps backend `errorCode` to Vietnamese messages, wire centralized mutation error toasts through QueryClient's `onError`, and integrate `@sentry/nextjs` for production error reporting.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Create `global-error.tsx` at app root with own `<html>` and `<body>` tags
- Create `error.tsx` at `(dashboard)/` level with in-context recovery UI (retry button), stays within dashboard shell
- Create `error.tsx` at `(public)/` level with branded error page matching public site design
- Reuse existing `ErrorBoundary` component pattern as fallback UI
- Development mode: show error stack trace in collapsible details; Production: show only user-friendly message with requestId
- Parse backend `errorCode` to show specific Vietnamese messages via error code to message mapping utility
- For unknown errors: show generic "Da xay ra loi. Vui long thu lai."
- Show requestId in toast description: "Ma loi: {requestId}"
- Mutations: toast.error on failure; Queries: NO toast on query failure
- Centralize error toast logic in QueryClient's `onError` callback
- Keep existing hook-level toast.success calls
- Dashboard error.tsx: "Thu lai" (retry) button + "Quay ve trang chu" (go home) link
- Public error.tsx: "Quay lai" (go back) button + "Trang chu" (home) link
- global-error.tsx: "Tai lai trang" (reload page) button only
- Auto-retry: rely on existing QueryClient retry config (1 retry for non-auth errors)
- 403 errors: redirect to dedicated `/403` page (already exists)
- Install and configure `@sentry/nextjs` for frontend error reporting
- Wire ErrorBoundary and error.tsx to capture errors to Sentry with errorCode + requestId as tags
- Include route path and user role in Sentry context
- global-error.tsx: always report to Sentry (critical)
- error.tsx: report to Sentry with reduced severity (recoverable)
- Toast errors (API failures): do NOT report individually to Sentry (backend already captures)

### Claude's Discretion
- Error code to Vietnamese message mapping content (generate based on existing ErrorCode constants)
- Sentry SDK configuration details (DSN, environment, sampling rate)
- Exact styling of error pages (use existing Tailwind patterns)
- Whether to create a shared error UI component or inline in each error.tsx
- Toast duration and positioning (use sonner defaults or customize)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ERR-04 | Next.js App Router has `global-error.tsx` at app root and `error.tsx` at `(dashboard)/` and `(public)/` route levels | Next.js error.tsx convention documented; global-error.tsx must include own html/body tags; error.tsx wraps route segments in React Error Boundary; existing ErrorBoundary and ErrorState components provide reusable UI patterns |
| ERR-05 | Frontend displays user-friendly error messages via toast notifications instead of white-screen crashes | 47 hooks already have per-mutation toast.error calls with hardcoded messages; QueryClient mutation onError only does console.error; centralized error parsing utility maps backend ErrorCode (40+ codes) to Vietnamese messages; sonner v1.7.1 already configured at bottom-right with richColors |

</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 14.2.21 | Framework with App Router error conventions | Project standard; error.tsx/global-error.tsx are file conventions |
| @tanstack/react-query | ^5.62.0 | Data fetching with centralized error handling | QueryClient defaultOptions.mutations.onError for centralized toast |
| sonner | ^1.7.1 | Toast notifications | Already used in 47 hooks; Toaster configured at bottom-right |
| axios | ^1.7.9 | HTTP client with interceptors | Response interceptor for parsing StandardErrorResponse |
| lucide-react | ^0.468.0 | Icons for error UI | Already used in ErrorBoundary (AlertTriangle, RefreshCw) |

### New Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @sentry/nextjs | ^10.44.0 | Error reporting for Next.js (App Router compatible) | Production error capture from error.tsx, global-error.tsx, ErrorBoundary |

**Note:** Sentry v10.x is the current major version. It requires `@sentry/nextjs` only (no separate `@sentry/browser` or `@sentry/node`). The SDK wraps `next.config.mjs` with `withSentryConfig` and creates `instrumentation-client.ts` + `sentry.server.config.ts` + `sentry.edge.config.ts`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @sentry/nextjs | LogRocket, Bugsnag | Sentry is specified in CLAUDE.md tech stack; already planned for infra |
| sonner | react-hot-toast | sonner already adopted in 47 hooks; no reason to switch |

**Installation:**
```bash
cd tbs-erp-frontend && npm install @sentry/nextjs
```

**Version verification:** @sentry/nextjs 10.44.0 verified via npm registry 2026-03-18. sonner 1.7.1 already installed (latest is 2.0.7 but not required to upgrade).

## Architecture Patterns

### Recommended Project Structure (New/Modified Files)
```
tbs-erp-frontend/
src/
  app/
    global-error.tsx          # NEW - catches root layout errors (own html/body)
    error.tsx                 # EXISTS - root-level fallback (already present)
    (dashboard)/
      error.tsx               # NEW - in-context dashboard error with retry
    (public)/
      error.tsx               # NEW - branded public error page
    403/
      page.tsx                # EXISTS - already present
  lib/
    utils/
      error-messages.ts       # NEW - errorCode -> Vietnamese message mapping
      parse-api-error.ts      # NEW - extract errorCode/requestId from AxiosError
    providers/
      query-provider.tsx      # MODIFY - centralize mutation onError with toast
    api/
      client.ts               # MODIFY - (optional) parse StandardErrorResponse in interceptor
  components/
    shared/
      error-boundary.tsx      # MODIFY - add Sentry.captureException in componentDidCatch
instrumentation-client.ts     # NEW - Sentry client initialization (at project root, NOT src/)
sentry.server.config.ts       # NEW - Sentry server initialization (at project root)
sentry.edge.config.ts         # NEW - Sentry edge initialization (at project root)
instrumentation.ts            # NEW - Next.js instrumentation hook (at project root)
next.config.mjs               # MODIFY - wrap with withSentryConfig
.env.example                  # MODIFY - add NEXT_PUBLIC_SENTRY_DSN, SENTRY_AUTH_TOKEN
```

### Pattern 1: Error Code to Vietnamese Message Mapping
**What:** A utility that maps backend `ErrorCode` string values to user-friendly Vietnamese messages
**When to use:** When parsing API error responses for toast display
**Example:**
```typescript
// Source: Backend error-codes.ts constants mapped to Vietnamese
const ERROR_MESSAGES: Record<string, string> = {
  // Order
  ORDER_NOT_FOUND: 'Khong tim thay don hang',
  ORDER_INVALID_TRANSITION: 'Khong the chuyen trang thai don hang',
  ORDER_ALREADY_COMPLETED: 'Don hang da hoan thanh',
  ORDER_ALREADY_CANCELLED: 'Don hang da bi huy',
  INSUFFICIENT_DEPOSIT: 'So tien dat coc chua du',
  // Auth
  INVALID_CREDENTIALS: 'Tai khoan hoac mat khau khong dung',
  TOKEN_EXPIRED: 'Phien dang nhap da het han',
  ACCOUNT_LOCKED: 'Tai khoan da bi khoa',
  // ... all 40+ codes
  // Fallback
};

const DEFAULT_MESSAGE = 'Da xay ra loi. Vui long thu lai.';

export function getErrorMessage(errorCode: string | undefined): string {
  if (!errorCode) return DEFAULT_MESSAGE;
  return ERROR_MESSAGES[errorCode] ?? DEFAULT_MESSAGE;
}
```

### Pattern 2: API Error Parser
**What:** Extract `errorCode`, `requestId`, and `message` from Axios error responses conforming to `StandardErrorResponse`
**When to use:** In QueryClient's centralized `onError` and anywhere API errors need parsing
**Example:**
```typescript
// Source: Backend StandardErrorResponse interface
import type { AxiosError } from 'axios';

interface ParsedApiError {
  errorCode: string | undefined;
  requestId: string | undefined;
  message: string;
  statusCode: number | undefined;
}

export function parseApiError(error: unknown): ParsedApiError {
  const axiosError = error as AxiosError<{
    success: false;
    errorCode: string;
    requestId: string;
    message: string | string[];
    statusCode: number;
  }>;

  const data = axiosError?.response?.data;

  if (data && data.success === false) {
    return {
      errorCode: data.errorCode,
      requestId: data.requestId,
      message: Array.isArray(data.message) ? data.message[0] : data.message,
      statusCode: data.statusCode,
    };
  }

  return {
    errorCode: undefined,
    requestId: undefined,
    message: (error as Error)?.message || 'Unknown error',
    statusCode: axiosError?.response?.status,
  };
}
```

### Pattern 3: Centralized Mutation Error Toast
**What:** Replace QueryClient's `console.error`-only mutation `onError` with a toast that shows Vietnamese message + requestId
**When to use:** In `query-provider.tsx` QueryClient initialization
**Example:**
```typescript
// In QueryClient defaultOptions.mutations.onError:
onError: (error: unknown) => {
  const parsed = parseApiError(error);
  const message = getErrorMessage(parsed.errorCode);

  toast.error(message, {
    description: parsed.requestId
      ? `Ma loi: ${parsed.requestId}`
      : undefined,
  });
},
```

**Important:** This centralized handler shows toast for ALL mutations. The existing per-hook `onError: () => toast.error('...')` calls will ALSO fire (TanStack Query calls BOTH global and local onError). To avoid duplicate toasts, the per-hook toast.error calls should be removed from mutations that don't need custom messages, OR the centralized handler should only fire when no hook-level onError is present.

**Recommended approach:** Remove per-hook `onError: () => toast.error('...')` calls and let the centralized handler provide contextual Vietnamese messages based on `errorCode`. Keep per-hook `onSuccess: () => toast.success('...')` calls as they are contextual.

### Pattern 4: Next.js error.tsx with Sentry
**What:** Route-level error boundary that reports to Sentry and shows recovery UI
**When to use:** In `(dashboard)/error.tsx` and `(public)/error.tsx`
**Example:**
```typescript
'use client';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      level: 'error', // not 'fatal' since recoverable
      tags: { boundary: 'dashboard' },
    });
  }, [error]);

  return (
    // In-context error UI with retry button + go home link
    // Stays within dashboard shell (sidebar/topbar visible)
  );
}
```

### Pattern 5: global-error.tsx with Sentry
**What:** App-root error boundary that catches layout-level crashes
**When to use:** At `src/app/global-error.tsx`
**Critical:** Must include own `<html>` and `<body>` tags since root layout has crashed
**Example:**
```typescript
'use client';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      level: 'fatal', // layout-level crash is critical
      tags: { boundary: 'global' },
    });
  }, [error]);

  return (
    <html lang="vi">
      <body>
        {/* Minimal error UI with "Tai lai trang" button */}
      </body>
    </html>
  );
}
```

### Anti-Patterns to Avoid
- **Duplicate toast notifications:** TanStack Query calls BOTH global and per-hook `onError`. If you add centralized toast AND keep per-hook toast.error, users see two toasts. Solution: remove per-hook toast.error calls OR use a deduplication flag.
- **Toast on query failures:** The decision explicitly says NO toast on query failures. Do not add query-level `onError` toast. Let error.tsx boundaries handle render failures from failed queries.
- **Importing Sentry in global-error.tsx via regular import:** Since global-error.tsx replaces the root layout, it cannot rely on providers or layout-level initialization. Sentry SDK self-initializes via `instrumentation-client.ts`, so `import * as Sentry from '@sentry/nextjs'` works directly.
- **Using console.log for error reporting:** The production build strips `console.log` (compiler.removeConsole in next.config.mjs). Only `console.error` and `console.warn` survive. Always use Sentry for production error reporting.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error reporting | Custom fetch-to-API error logger | @sentry/nextjs | Source maps, breadcrumbs, session replay, performance monitoring |
| Toast notifications | Custom toast system | sonner (already installed) | Already used in 47 hooks, Toaster configured |
| API error parsing | Ad-hoc error.response checks in each hook | Centralized parseApiError() utility | Backend has standardized response format; one parser works everywhere |
| Error boundaries | Multiple custom error boundary classes | Next.js error.tsx file convention | Automatic React Error Boundary wrapping per route segment |

**Key insight:** The backend already returns structured `StandardErrorResponse` with `errorCode` and `requestId`. The frontend should parse this structure ONCE in a utility, not re-implement parsing in 47 hooks.

## Common Pitfalls

### Pitfall 1: TanStack Query Double Toast
**What goes wrong:** Adding toast.error in QueryClient's global `onError` AND keeping per-hook `onError: () => toast.error('...')` causes users to see two error toasts for every failed mutation.
**Why it happens:** TanStack Query v5 calls both global and local onError callbacks.
**How to avoid:** Remove per-hook `toast.error` in mutation `onError` callbacks. Let the centralized handler in QueryClient provide the error message using the backend's `errorCode`. Keep per-hook `toast.success` calls since they're contextual ("Don hang da cap nhat" vs generic).
**Warning signs:** Two toast notifications appearing simultaneously after a mutation failure.

### Pitfall 2: global-error.tsx Missing html/body Tags
**What goes wrong:** The global-error.tsx renders without its own `<html>` and `<body>` tags, causing a hydration mismatch or blank screen.
**Why it happens:** Developers copy the error.tsx pattern (which relies on the parent layout) into global-error.tsx, but global-error.tsx replaces the root layout entirely.
**How to avoid:** Always include `<html lang="vi">` and `<body>` in global-error.tsx. Include inline styles (not Tailwind classes relying on CSS from layout) as a safety measure, though Next.js typically preserves existing stylesheets.
**Warning signs:** White screen when root layout crashes in production.

### Pitfall 3: Sentry Source Map Leaking
**What goes wrong:** Source maps are uploaded to Sentry but also served to the browser, exposing source code.
**Why it happens:** Default Webpack configuration generates source maps that are publicly accessible.
**How to avoid:** Set `hideSourceMaps: true` in `withSentryConfig` options. This uploads maps to Sentry but removes them from the production build.
**Warning signs:** Visiting `_next/static/chunks/*.js.map` returns source code.

### Pitfall 4: Sentry Capturing 401/403 as Errors
**What goes wrong:** Every 401 (expired token, auto-refreshed) and 403 (permission denied) shows up as an error in Sentry, causing noise.
**Why it happens:** Sentry's default HTTP instrumentation captures all non-2xx responses.
**How to avoid:** Configure `beforeSend` in Sentry client config to filter out 401/403 AxiosErrors. Or configure `denyUrls` / error filtering.
**Warning signs:** Sentry dashboard flooded with auth-related "errors" that aren't real bugs.

### Pitfall 5: Next.js error.tsx Not Catching Layout Errors
**What goes wrong:** An error in `(dashboard)/layout.tsx` is NOT caught by `(dashboard)/error.tsx`.
**Why it happens:** Next.js error boundaries wrap the page content, not the layout of the same segment. Layout errors bubble up to the parent segment's error boundary.
**How to avoid:** This is by design. The root `error.tsx` (already exists at `src/app/error.tsx`) catches layout errors from route groups. The `global-error.tsx` catches root layout errors. Understanding this hierarchy prevents confusion during testing.
**Warning signs:** Dashboard layout crashes show the root error.tsx UI instead of the dashboard error.tsx UI.

### Pitfall 6: Existing Root error.tsx Overlap
**What goes wrong:** The project already has `src/app/error.tsx` (a root-level error page). Adding `(dashboard)/error.tsx` and `(public)/error.tsx` means the root error.tsx only catches errors from the root layout and pages not in a route group.
**Why it happens:** Next.js error boundary hierarchy is: global-error.tsx > root error.tsx > route-group error.tsx.
**How to avoid:** Keep the existing root `error.tsx` as a fallback. It catches errors from root layout children that aren't in `(dashboard)` or `(public)` route groups. Ensure its UI is consistent with the new route-group error pages.
**Warning signs:** Inconsistent error page styling between root and route-group error pages.

## Code Examples

### Existing Assets to Reuse

**ErrorBoundary component** (`src/components/shared/error-boundary.tsx`):
- Class component with Vietnamese text ("Da xay ra loi"), retry button, reload button
- Dev mode: collapsible stack trace details
- Already wraps `{children}` in dashboard layout
- Has `withErrorBoundary` HOC for granular wrapping
- Modification needed: add `Sentry.captureException(error)` in `componentDidCatch`

**ErrorState component** (`src/components/shared/error-state.tsx`):
- Variants: `inline` | `fullpage`
- Types: `generic` | `network` | `server` | `permission`
- Each type has Vietnamese title/description and appropriate icon
- Can be used as the UI inside error.tsx files

**Existing root error.tsx** (`src/app/error.tsx`):
- Full-page error with Vietnamese text, retry button, home link
- Help section with contact support and email
- Dev mode: collapsible error details
- Should be updated to include Sentry capture

**Existing 403 page** (`src/app/403/page.tsx`):
- Already has Vietnamese "Ban khong co quyen truy cap" message
- Back button + home button
- No changes needed for this phase

### Sentry Configuration Files

**instrumentation-client.ts** (project root):
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Performance sampling
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay for error debugging
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,

  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
  ],

  // Filter out noisy errors
  beforeSend(event) {
    // Don't report 401/403 API errors (handled by app flow)
    const statusCode = event.contexts?.response?.status_code;
    if (statusCode === 401 || statusCode === 403) return null;
    return event;
  },
});
```

**sentry.server.config.ts** (project root):
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});
```

**sentry.edge.config.ts** (project root):
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});
```

**instrumentation.ts** (project root):
```typescript
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
```

**next.config.mjs modification:**
```typescript
import { withSentryConfig } from '@sentry/nextjs';

// ... existing config ...

export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  hideSourceMaps: true,
  disableLogger: true,
});
```

### Toast Error Integration Pattern

```typescript
// query-provider.tsx modification
import { parseApiError } from '@/lib/utils/parse-api-error';
import { getErrorMessage } from '@/lib/utils/error-messages';
import { toast } from 'sonner';

// In QueryClient defaultOptions.mutations:
mutations: {
  retry: false,
  networkMode: 'offlineFirst',
  onError: (error: unknown) => {
    const parsed = parseApiError(error);
    const message = getErrorMessage(parsed.errorCode);

    toast.error(message, {
      description: parsed.requestId
        ? `Ma loi: ${parsed.requestId}`
        : undefined,
    });
  },
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sentry.client.config.ts` for client init | `instrumentation-client.ts` for client init | Sentry SDK v8.28+ | New file name for client-side Sentry initialization |
| `@sentry/nextjs` v7 with separate packages | `@sentry/nextjs` v8/v10 unified package | 2024-2025 | Single package handles client, server, and edge; simplified setup |
| Manual ErrorBoundary wrapping | Next.js `error.tsx` file convention | Next.js 13+ | Automatic error boundary per route segment; less boilerplate |
| `_error.tsx` (Pages Router) | `error.tsx` + `global-error.tsx` (App Router) | Next.js 13+ | Route-segment-level error isolation vs app-wide single error page |

**Deprecated/outdated:**
- `sentry.client.config.ts`: Renamed to `instrumentation-client.ts` in Sentry v8.28+
- `_app.tsx` / `_error.tsx`: Pages Router conventions; this project uses App Router exclusively
- `Sentry.init()` in `_app.tsx`: Replaced by `instrumentation-client.ts` pattern

## Open Questions

1. **Sentry DSN availability**
   - What we know: Infra stack includes Sentry (CLAUDE.md), but no SENTRY_DSN in .env.example
   - What's unclear: Whether a Sentry project is already provisioned
   - Recommendation: Add `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN` to .env.example with empty defaults. Sentry SDK gracefully no-ops when DSN is empty/undefined, so no runtime errors.

2. **Per-hook toast.error removal scope**
   - What we know: 47 hooks have 215 total `toast.error()` calls in mutation `onError` callbacks
   - What's unclear: Whether ALL should be removed or only those with generic messages
   - Recommendation: Remove per-hook `onError: () => toast.error('...')` for mutations where the centralized handler provides equally good or better messages (most cases). Keep hook-level onError only if it needs to do something besides toast (e.g., form state reset). This is a large change (47 files) but mechanical.

3. **Existing root error.tsx evolution**
   - What we know: Root `src/app/error.tsx` already exists with full Vietnamese UI
   - What's unclear: Whether it should be updated in-place or replaced
   - Recommendation: Update in-place to add Sentry integration. Keep its current UI since it serves as fallback for non-route-group pages.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | `tbs-erp-frontend/vitest.config.ts` |
| Quick run command | `cd tbs-erp-frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd tbs-erp-frontend && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ERR-04 | Dashboard error.tsx renders error UI with retry button | unit | `cd tbs-erp-frontend && npx vitest run src/app/__tests__/dashboard-error.test.tsx -x` | No - Wave 0 |
| ERR-04 | Public error.tsx renders branded error page | unit | `cd tbs-erp-frontend && npx vitest run src/app/__tests__/public-error.test.tsx -x` | No - Wave 0 |
| ERR-04 | global-error.tsx renders with own html/body | unit | `cd tbs-erp-frontend && npx vitest run src/app/__tests__/global-error.test.tsx -x` | No - Wave 0 |
| ERR-05 | parseApiError extracts errorCode and requestId from AxiosError | unit | `cd tbs-erp-frontend && npx vitest run src/lib/utils/__tests__/parse-api-error.test.ts -x` | No - Wave 0 |
| ERR-05 | getErrorMessage maps known errorCodes to Vietnamese messages | unit | `cd tbs-erp-frontend && npx vitest run src/lib/utils/__tests__/error-messages.test.ts -x` | No - Wave 0 |
| ERR-05 | getErrorMessage returns default message for unknown codes | unit | `cd tbs-erp-frontend && npx vitest run src/lib/utils/__tests__/error-messages.test.ts -x` | No - Wave 0 |
| ERR-05 | QueryClient mutation onError shows toast with parsed error | unit | `cd tbs-erp-frontend && npx vitest run src/lib/providers/__tests__/query-provider.test.tsx -x` | No - Wave 0 |
| ERR-04 | ErrorBoundary calls Sentry.captureException | unit | `cd tbs-erp-frontend && npx vitest run src/components/shared/__tests__/error-boundary.test.tsx -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd tbs-erp-frontend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd tbs-erp-frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/utils/__tests__/parse-api-error.test.ts` -- covers ERR-05 (parse utility)
- [ ] `src/lib/utils/__tests__/error-messages.test.ts` -- covers ERR-05 (message mapping)
- [ ] `src/app/__tests__/dashboard-error.test.tsx` -- covers ERR-04 (dashboard error boundary)
- [ ] `src/app/__tests__/public-error.test.tsx` -- covers ERR-04 (public error boundary)
- [ ] `src/app/__tests__/global-error.test.tsx` -- covers ERR-04 (global error boundary)
- [ ] Test setup may need Sentry mock: `vi.mock('@sentry/nextjs')` -- prevent real Sentry calls in tests

## Sources

### Primary (HIGH confidence)
- Next.js official docs: `error.js` file convention -- https://nextjs.org/docs/app/api-reference/file-conventions/error -- Props, behavior, global-error.tsx requirements
- Sentry official docs: Manual Setup for Next.js -- https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/ -- File structure, config patterns, instrumentation-client.ts
- npm registry: @sentry/nextjs 10.44.0 (verified 2026-03-18)
- npm registry: sonner latest 2.0.7 (project uses 1.7.1, compatible)

### Secondary (MEDIUM confidence)
- Sentry Next.js guide overview -- https://docs.sentry.io/platforms/javascript/guides/nextjs/ -- General setup flow, wizard vs manual
- Next.js error handling guide -- https://nextjs.org/docs/app/getting-started/error-handling -- Error boundary hierarchy

### Codebase (HIGH confidence - direct inspection)
- `tbs-erp-backend/src/common/exceptions/error-codes.ts` -- 40+ ErrorCode constants
- `tbs-erp-backend/src/common/exceptions/error-response.interface.ts` -- StandardErrorResponse shape
- `tbs-erp-frontend/src/components/shared/error-boundary.tsx` -- Existing ErrorBoundary with Vietnamese UI
- `tbs-erp-frontend/src/components/shared/error-state.tsx` -- ErrorState with variants and types
- `tbs-erp-frontend/src/lib/providers/query-provider.tsx` -- QueryClient with mutation onError (console.error only)
- `tbs-erp-frontend/src/lib/providers/toast-provider.tsx` -- Toaster config (bottom-right, richColors, 4s duration)
- `tbs-erp-frontend/src/app/error.tsx` -- Existing root error page with Vietnamese UI
- `tbs-erp-frontend/src/app/not-found.tsx` -- 404 page (public-facing style reference)
- `tbs-erp-frontend/src/app/403/page.tsx` -- 403 page (already exists, no changes needed)
- `tbs-erp-frontend/src/app/(dashboard)/layout.tsx` -- Dashboard layout with ErrorBoundary wrapping children
- `tbs-erp-frontend/src/app/(public)/layout.tsx` -- Public layout with Navbar/Footer
- `tbs-erp-frontend/next.config.mjs` -- Next.js config (will need withSentryConfig wrap)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use except @sentry/nextjs; Sentry docs verified
- Architecture: HIGH -- Next.js error.tsx convention is well-documented; existing codebase patterns are clear
- Pitfalls: HIGH -- TanStack Query double-toast and global-error.tsx html/body requirements are well-documented gotchas

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (30 days -- stable stack, no breaking changes expected)
