# Phase 2: Frontend Error Handling - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Catch every frontend error — render crashes, API failures, navigation errors — and display user-friendly Vietnamese messages instead of white screens or raw errors. This phase does NOT add new business logic or change API contracts. It builds on Phase 1's standardized backend error responses (errorCode, requestId).

</domain>

<decisions>
## Implementation Decisions

### Error Page Design (error.tsx / global-error.tsx)
- Create `global-error.tsx` at app root — catches errors outside route layouts (must include its own `<html>` and `<body>` tags per Next.js requirement)
- Create `error.tsx` at `(dashboard)/` level — in-context recovery UI with retry button, stays within dashboard shell (sidebar/topbar visible)
- Create `error.tsx` at `(public)/` level — branded error page matching public site design (logo, navigation still visible)
- Reuse existing `ErrorBoundary` component as the fallback UI pattern — it already has Vietnamese text, retry button, and "Tải lại trang" option
- Development mode: show error stack trace in collapsible details (existing pattern in ErrorBoundary)
- Production mode: show only user-friendly message with error reference code (requestId if available)

### Toast Notification Behavior
- Parse backend `errorCode` to show specific Vietnamese messages — create an error code → message mapping utility
- For known errorCodes: show contextual Vietnamese message (e.g., `ORDER_NOT_FOUND` → "Không tìm thấy đơn hàng")
- For unknown errors: show generic "Đã xảy ra lỗi. Vui lòng thử lại." with toast.error
- Show requestId in toast description for support contact: "Mã lỗi: {requestId}" — users can screenshot this for support
- Mutations: toast.error on failure (already patterned in hooks), toast.success on success (already exists)
- Queries: NO toast on query failure — let error.tsx handle render-level errors, avoid toast spam on page load failures
- Centralize error toast logic in QueryClient's `onError` callback instead of duplicating in every hook
- Keep existing hook-level toast.success calls — they are contextual and useful

### Error Recovery UX
- Dashboard error.tsx: show "Thử lại" (retry) button + "Quay về trang chủ" (go home) link
- Public error.tsx: show "Quay lại" (go back) button + "Trang chủ" (home) link
- global-error.tsx: show "Tải lại trang" (reload page) button only — no navigation possible since layout crashed
- Auto-retry: rely on existing QueryClient retry config (1 retry for non-auth errors) — don't add manual auto-retry
- 403 errors: redirect to a dedicated `/403` page with "Bạn không có quyền truy cập" message

### Error Reporting (Sentry)
- Install and configure `@sentry/nextjs` for frontend error reporting
- Wire ErrorBoundary and error.tsx to capture errors to Sentry with errorCode + requestId as tags
- Include route path and user role in Sentry context for debugging
- global-error.tsx: always report to Sentry (critical — layout-level crash)
- error.tsx: report to Sentry with reduced severity (component-level error, recoverable)
- Toast errors (API failures): do NOT report individually — backend already captures these

### Claude's Discretion
- Error code → Vietnamese message mapping content (Claude generates based on existing ErrorCode constants)
- Sentry SDK configuration details (DSN, environment, sampling rate)
- Exact styling of error pages (use existing Tailwind patterns)
- Whether to create a shared error UI component or inline in each error.tsx
- Toast duration and positioning (use sonner defaults or customize)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Error handling infrastructure (from Phase 1)
- `tbs-erp-backend/src/common/exceptions/error-codes.ts` — All ErrorCode constants that frontend needs to map to Vietnamese messages
- `tbs-erp-backend/src/common/exceptions/error-response.interface.ts` — StandardErrorResponse shape that API returns on errors

### Existing frontend error handling
- `tbs-erp-frontend/src/components/shared/error-boundary.tsx` — Existing ErrorBoundary class component with Vietnamese UI, retry, reload
- `tbs-erp-frontend/src/lib/api/client.ts` — Axios instance, 401 refresh logic, interceptors
- `tbs-erp-frontend/src/lib/providers/query-provider.tsx` — QueryClient configuration, retry logic, mutation onError
- `tbs-erp-frontend/src/app/(dashboard)/layout.tsx` — Dashboard layout wrapping children with ErrorBoundary

### Toast pattern reference
- `tbs-erp-frontend/src/lib/hooks/use-orders.ts` — Example hook with toast.success/toast.error pattern (sonner)

### Public pages
- `tbs-erp-frontend/src/app/not-found.tsx` — Existing 404 page (reference for public error page style)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ErrorBoundary` component: Class component with Vietnamese text, retry/reload buttons, dev-mode stack trace — can be adapted for error.tsx fallback UI
- `withErrorBoundary` HOC: Already exported, wraps any component — useful for granular error isolation
- `sonner` toast library: Already imported in 30+ hooks — established pattern for user notifications
- `apiClient` interceptors: Axios response interceptor handles 401 refresh — can be extended to parse errorCode
- `not-found.tsx`: Existing 404 page — reference for public error page styling

### Established Patterns
- Toast usage: `toast.success('Cập nhật thành công')` / `toast.error('Không thể cập nhật')` — hardcoded Vietnamese strings per hook
- Query retry: `retry: (failureCount, error) => { if (401/403) return false; return failureCount < 1; }`
- Mutation onError: Only `console.error` in QueryClient — no toast notification
- ErrorBoundary placement: Wraps `{children}` in dashboard layout only

### Integration Points
- `src/app/global-error.tsx` — NEW file, Next.js App Router catches unhandled errors
- `src/app/(dashboard)/error.tsx` — NEW file, dashboard route-level error boundary
- `src/app/(public)/error.tsx` — NEW file, public route-level error boundary
- `src/lib/providers/query-provider.tsx` — Modify QueryClient onError for centralized toast
- `src/lib/api/client.ts` — Extend response interceptor to parse errorCode from StandardErrorResponse
- `src/app/403/page.tsx` — NEW file, dedicated forbidden access page

</code_context>

<specifics>
## Specific Ideas

- User delegated all decisions to Claude — chose "Claude chọn phù hợp" for all areas
- Error messages must be in Vietnamese (consistent with existing toast messages)
- Include requestId in error toast for support escalation workflow
- Don't duplicate toast notifications — centralize in QueryClient, keep hook-level success toasts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-frontend-error-handling*
*Context gathered: 2026-03-18*
