---
phase: 05-rbac-audit-coverage
plan: 01
subsystem: auth
tags: [rbac, roles-guard, domain-exception, nestjs, decorators]

# Dependency graph
requires:
  - phase: 01-backend-error-standardization
    provides: DomainException and ErrorCode infrastructure
provides:
  - Upgraded RolesGuard with DomainException and Vietnamese error messages
  - ALL_ROLES constant for @Roles(...ALL_ROLES) pattern
  - All 14 previously-undecorated controllers now have @Roles() or @Public()
affects: [05-rbac-audit-coverage, 06-fsm-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: ["@Roles(...ALL_ROLES) for workplace controllers", "@Public() for infrastructure/public endpoints"]

key-files:
  created: []
  modified:
    - tbs-erp-backend/src/core/rbac/guards/roles.guard.ts
    - tbs-erp-backend/src/core/rbac/roles.enum.ts
    - tbs-erp-backend/src/core/health/health.controller.ts
    - tbs-erp-backend/src/modules/health/health.controller.ts
    - tbs-erp-backend/src/core/metrics/metrics.controller.ts
    - tbs-erp-backend/src/modules/public/public-cms.controller.ts
    - tbs-erp-backend/src/modules/chat/chat.controller.ts
    - tbs-erp-backend/src/modules/calendar/calendar.controller.ts
    - tbs-erp-backend/src/modules/drive/drive.controller.ts
    - tbs-erp-backend/src/modules/wiki/wiki.controller.ts
    - tbs-erp-backend/src/modules/video/video.controller.ts
    - tbs-erp-backend/src/modules/search/search.controller.ts
    - tbs-erp-backend/src/modules/attendance/attendance.controller.ts
    - tbs-erp-backend/src/modules/attendance/attendance-gps.controller.ts
    - tbs-erp-backend/src/modules/customer-portal/customer-portal.controller.ts
    - tbs-erp-backend/src/modules/approval/delegation/delegation.controller.ts

key-decisions:
  - "ALL_ROLES uses Object.values(UserRole) for automatic inclusion of all 22 roles"
  - "@Roles(...ALL_ROLES) at class level for workplace controllers per RESEARCH.md recommendation"
  - "@Public() at class level for health/metrics/public-cms controllers"

patterns-established:
  - "@Roles(...ALL_ROLES) at class level for any-authenticated-user endpoints"
  - "@Public() at class level for infrastructure endpoints (health, metrics) and public CMS"

requirements-completed: [SEC-01]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 5 Plan 1: RBAC Guard Upgrade & Controller Decoration Summary

**RolesGuard upgraded to DomainException with Vietnamese role labels, ALL_ROLES constant added, and all 14 undecorated controllers now have explicit @Roles() or @Public() decorators**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T04:22:00Z
- **Completed:** 2026-03-19T04:27:24Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- RolesGuard now throws DomainException with FORBIDDEN errorCode and Vietnamese messages showing current role vs required roles
- ALL_ROLES constant (Object.values(UserRole)) exported from roles.enum.ts for @Roles(...ALL_ROLES) usage
- All 14 previously-undecorated controllers now have explicit access control decorators
- 4 infrastructure/public controllers marked @Public() (health x2, metrics, public-cms)
- 10 authenticated controllers marked @Roles(...ALL_ROLES) with RolesGuard added to UseGuards

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade RolesGuard + add ALL_ROLES constant** - `4662049` (feat)
2. **Task 2: Add @Roles/@Public to all 14 undecorated controllers** - `9c88ac7` (feat)

## Files Created/Modified
- `tbs-erp-backend/src/core/rbac/guards/roles.guard.ts` - Replaced ForbiddenException with DomainException, added Vietnamese role label messages
- `tbs-erp-backend/src/core/rbac/roles.enum.ts` - Added ALL_ROLES constant
- `tbs-erp-backend/src/core/health/health.controller.ts` - Added @Public() at class level
- `tbs-erp-backend/src/modules/health/health.controller.ts` - Added @Public() at class level
- `tbs-erp-backend/src/core/metrics/metrics.controller.ts` - Added @Public() at class level
- `tbs-erp-backend/src/modules/public/public-cms.controller.ts` - Added @Public() at class level
- `tbs-erp-backend/src/modules/chat/chat.controller.ts` - Added @Roles(...ALL_ROLES) + RolesGuard
- `tbs-erp-backend/src/modules/calendar/calendar.controller.ts` - Added @Roles(...ALL_ROLES) + RolesGuard
- `tbs-erp-backend/src/modules/drive/drive.controller.ts` - Added @Roles(...ALL_ROLES) + RolesGuard
- `tbs-erp-backend/src/modules/wiki/wiki.controller.ts` - Added @Roles(...ALL_ROLES) + RolesGuard
- `tbs-erp-backend/src/modules/video/video.controller.ts` - Added @Roles(...ALL_ROLES) + RolesGuard
- `tbs-erp-backend/src/modules/search/search.controller.ts` - Added @Roles(...ALL_ROLES) + RolesGuard
- `tbs-erp-backend/src/modules/attendance/attendance.controller.ts` - Added @Roles(...ALL_ROLES) + RolesGuard
- `tbs-erp-backend/src/modules/attendance/attendance-gps.controller.ts` - Added @Roles(...ALL_ROLES) + RolesGuard
- `tbs-erp-backend/src/modules/customer-portal/customer-portal.controller.ts` - Added @Roles(...ALL_ROLES) + RolesGuard
- `tbs-erp-backend/src/modules/approval/delegation/delegation.controller.ts` - Added @Roles(...ALL_ROLES) + RolesGuard

## Decisions Made
- ALL_ROLES uses Object.values(UserRole) for automatic inclusion of any future roles added to the Prisma enum
- @Roles(...ALL_ROLES) at class level chosen for workplace controllers (chat, calendar, drive, wiki, video, search) per RESEARCH.md recommendation -- self-documenting that any authenticated user may access
- @Public() at class level for health and metrics controllers (K8s probes and Prometheus scraper must be unauthenticated)
- Import paths matched per-file convention: controllers using @common/guards/ get @common/guards/roles.guard, controllers using @core/auth/guards/ get @core/rbac/guards/roles.guard
- Customer portal and delegation controllers use @Roles(...ALL_ROLES) at class level since ownership verification is handled at the service level

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- 2 pre-existing TypeScript errors in prisma.service.ts and batch-job.service.ts unrelated to this plan's changes -- not caused by RBAC modifications, left as-is

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All controllers now have explicit RBAC decorators, ready for Plan 05-02 (audit test enforcement)
- RolesGuard provides consistent DomainException error format for RBAC violations
- ALL_ROLES constant available for any future controllers

---
*Phase: 05-rbac-audit-coverage*
*Completed: 2026-03-19*
