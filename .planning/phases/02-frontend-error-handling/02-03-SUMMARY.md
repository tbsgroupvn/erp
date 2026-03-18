---
phase: 02-frontend-error-handling
plan: 03
subsystem: ui
tags: [react, tanstack-query, sonner, toast, error-handling, hooks]

# Dependency graph
requires:
  - phase: 02-frontend-error-handling
    provides: "Centralized QueryClient mutation onError with parseApiError + getErrorMessage (Plan 02-01)"
provides:
  - "47 hook files with zero duplicate toast.error in mutation onError callbacks"
  - "Single-source mutation error toasts via centralized QueryClient handler"
affects: [03-fsm-verification, 04-input-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "No per-hook toast.error in mutation onError - centralized handler only"
    - "Pattern B preserved: optimistic rollback logic kept in onError without toast.error"
    - "Business-logic toast.error in onSuccess kept (e.g., test failure result)"

key-files:
  created: []
  modified:
    - "tbs-erp-frontend/src/lib/hooks/use-orders.ts"
    - "tbs-erp-frontend/src/lib/hooks/use-containers.ts"
    - "tbs-erp-frontend/src/lib/hooks/use-customs-declaration.ts"
    - "tbs-erp-frontend/src/lib/hooks/use-finance.ts"
    - "tbs-erp-frontend/src/lib/hooks/use-approvals.ts"
    - "tbs-erp-frontend/src/lib/hooks/use-approval-flows.ts"
    - "tbs-erp-frontend/src/lib/hooks/use-drive.ts"
    - "tbs-erp-frontend/src/lib/hooks/use-wiki.ts"
    - "tbs-erp-frontend/src/lib/hooks/use-automation.ts"
    - "tbs-erp-frontend/src/lib/hooks/use-tasks.ts"
    - "tbs-erp-frontend/src/lib/hooks/use-users.ts"
    - "tbs-erp-frontend/src/lib/hooks/use-notifications.ts"
    - "tbs-erp-frontend/src/lib/hooks/use-ai-assistant.ts"

key-decisions:
  - "Kept toast.error in useTestAutomationRule onSuccess -- business logic for test failure display, not a duplicate error handler"
  - "Preserved optimistic rollback logic in useOptimisticTaskStatus onError, only removed toast.error line"
  - "Removed orphaned sonner imports from use-notifications.ts and use-ai-assistant.ts (zero remaining toast usage)"

patterns-established:
  - "No per-hook toast.error in mutation onError: centralized QueryClient handler is the single source of mutation error toasts"
  - "Pattern B preservation: when onError has non-toast logic (state rollback, form cleanup), keep the logic, remove only toast.error"

requirements-completed: [ERR-05]

# Metrics
duration: 10min
completed: 2026-03-18
---

# Phase 02 Plan 03: Remove Duplicate Toast Error Summary

**Removed per-hook toast.error from all 47 hook files' mutation onError callbacks to prevent double toast notifications with centralized QueryClient handler**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-18T10:09:55Z
- **Completed:** 2026-03-18T10:20:23Z
- **Tasks:** 2
- **Files modified:** 47

## Accomplishments
- Removed all duplicate toast.error calls from mutation onError callbacks across 47 hook files
- Preserved all 197 toast.success calls in onSuccess callbacks unchanged
- Preserved optimistic rollback logic in useOptimisticTaskStatus (Pattern B)
- Removed orphaned sonner imports from 2 files that no longer use toast
- Single remaining toast.error is business logic in useTestAutomationRule onSuccess (correct)

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove per-hook toast.error from batch 1 (24 hooks)** - `3c270d3` (fix)
2. **Task 2: Remove per-hook toast.error from batch 2 (23 hooks)** - `4a9c250` (fix)

## Files Created/Modified
- `tbs-erp-frontend/src/lib/hooks/use-orders.ts` - Removed 5 toast.error calls from mutation onError
- `tbs-erp-frontend/src/lib/hooks/use-customs-declaration.ts` - Removed 14 toast.error calls from mutation onError
- `tbs-erp-frontend/src/lib/hooks/use-finance.ts` - Removed 10 toast.error calls from mutation onError
- `tbs-erp-frontend/src/lib/hooks/use-drive.ts` - Removed 11 toast.error calls from mutation onError
- `tbs-erp-frontend/src/lib/hooks/use-approvals.ts` - Removed 7 toast.error calls (Pattern C: console.error + toast.error)
- `tbs-erp-frontend/src/lib/hooks/use-wiki.ts` - Removed 7 toast.error calls (extracted error message pattern)
- `tbs-erp-frontend/src/lib/hooks/use-tasks.ts` - Removed 4 toast.error from standard mutations + 1 from optimistic (kept rollback)
- `tbs-erp-frontend/src/lib/hooks/use-users.ts` - Removed 6 toast.error calls
- `tbs-erp-frontend/src/lib/hooks/use-okr.ts` - Removed 8 toast.error calls
- `tbs-erp-frontend/src/lib/hooks/use-notifications.ts` - Removed toast.error + orphaned sonner import
- `tbs-erp-frontend/src/lib/hooks/use-ai-assistant.ts` - Removed toast.error + orphaned sonner import
- Plus 36 additional hook files (all listed in plan frontmatter)

## Decisions Made
- Kept toast.error in useTestAutomationRule's onSuccess callback -- this is business logic displaying test failure results, not a duplicate error handler
- Preserved optimistic rollback logic in useOptimisticTaskStatus's onError -- only removed the toast.error line, kept the state restoration
- Removed orphaned sonner imports from use-notifications.ts and use-ai-assistant.ts since they no longer use any toast calls

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 02 (Frontend Error Handling) is now complete with all 3 plans done
- Centralized error handling pipeline: backend error codes -> API response -> parseApiError -> getErrorMessage -> single toast
- Ready for Phase 03 (FSM Verification)

---
*Phase: 02-frontend-error-handling*
*Completed: 2026-03-18*
