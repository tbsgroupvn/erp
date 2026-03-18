---
phase: 02-frontend-error-handling
plan: 02
subsystem: ui
tags: [nextjs, sentry, error-boundary, react, error-handling]

# Dependency graph
requires:
  - phase: 02-frontend-error-handling/01
    provides: Sentry SDK setup and error utilities
provides:
  - Route-level error boundaries (global, dashboard, public)
  - Sentry error reporting with route path and user role context
  - In-context error recovery UI for dashboard users
  - Branded error page for public visitors
affects: [02-frontend-error-handling/03]

# Tech tracking
tech-stack:
  added: []
  patterns: [route-level-error-boundaries, sentry-context-enrichment]

key-files:
  created:
    - tbs-erp-frontend/src/app/global-error.tsx
    - tbs-erp-frontend/src/app/(dashboard)/error.tsx
    - tbs-erp-frontend/src/app/(public)/error.tsx
  modified:
    - tbs-erp-frontend/src/app/error.tsx
    - tbs-erp-frontend/src/components/shared/error-boundary.tsx

key-decisions:
  - "global-error.tsx uses window.location.href (full URL) since Next.js router is crashed; other boundaries use pathname"
  - "ErrorBoundary uses typeof window guard for SSR safety in componentDidCatch"

patterns-established:
  - "Sentry boundary tags: global (fatal), dashboard/root/public (error), component (error) for severity filtering"
  - "All Sentry captureException calls include path in extra and userRole in tags per locked decision"

requirements-completed: [ERR-04]

# Metrics
duration: 5min
completed: 2026-03-18
---

# Phase 02 Plan 02: Error Boundaries Summary

**Next.js route-level error boundaries at 3 levels with Sentry reporting including route path and user role context**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T10:01:34Z
- **Completed:** 2026-03-18T10:07:08Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created global-error.tsx with own html/body tags, fatal Sentry level, and reload button for root layout crashes
- Created dashboard error.tsx rendering inside shell (sidebar/topbar visible) with retry and home navigation
- Created public error.tsx with branded design matching not-found.tsx pattern and back/home buttons
- Wired Sentry.captureException into root error.tsx and ErrorBoundary componentDidCatch with route path and user role context
- All error boundaries show Vietnamese UI with development-mode error details

## Task Commits

Each task was committed atomically:

1. **Task 1: Create global-error.tsx and route-level error.tsx files with Sentry context** - `6b30d5a` (feat)
2. **Task 2: Update root error.tsx with Sentry and wire ErrorBoundary componentDidCatch** - `5f90592` (feat)

## Files Created/Modified
- `tbs-erp-frontend/src/app/global-error.tsx` - Root layout crash boundary with own html/body, fatal Sentry, reload button
- `tbs-erp-frontend/src/app/(dashboard)/error.tsx` - In-context dashboard error with retry, user role in Sentry
- `tbs-erp-frontend/src/app/(public)/error.tsx` - Branded public error with back/home, blue gradient
- `tbs-erp-frontend/src/app/error.tsx` - Added Sentry captureException with root boundary tag and user role
- `tbs-erp-frontend/src/components/shared/error-boundary.tsx` - Replaced TODO with Sentry call including component stack

## Decisions Made
- global-error.tsx uses `window.location.href` (full URL) instead of `pathname` since the Next.js router has crashed at that point
- ErrorBoundary componentDidCatch uses `typeof window !== 'undefined'` guard since class components can theoretically run during SSR
- Dashboard error uses plain `<a href="/tong-quan">` instead of `<Link>` to force full navigation and clear error state
- Public error uses `window.history.back()` for back navigation since public visitors have varied entry points

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All error boundaries in place, ready for Plan 02-03 (form validation and input error handling)
- Sentry integration wired at all 5 boundary levels (global, dashboard, public, root, component)

---
*Phase: 02-frontend-error-handling*
*Completed: 2026-03-18*
