---
phase: 05-rbac-audit-coverage
plan: 02
subsystem: auth
tags: [rbac, integration-test, data-scope, nestjs, prisma, decorators]

# Dependency graph
requires:
  - phase: 05-rbac-audit-coverage
    provides: ALL_ROLES constant, @Roles/@Public decorators on controllers
provides:
  - RBAC audit integration test as CI safety net for undecorated endpoints
  - DataScopeService wired into complaint and order-read services
  - Verified CRM data scoping already operational
affects: [06-fsm-verification, 07-business-rule-enforcement]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Metadata-only controller scanning for RBAC audit", "DataScopeService via order relation for complaint scoping"]

key-files:
  created:
    - tbs-erp-backend/test/integration/rbac-audit.integration.spec.ts
  modified:
    - tbs-erp-backend/src/core/auth/auth.controller.ts
    - tbs-erp-backend/src/modules/blog/blog.controller.ts
    - tbs-erp-backend/src/modules/complaint/complaint.service.ts
    - tbs-erp-backend/src/modules/complaint/complaint.module.ts
    - tbs-erp-backend/src/modules/complaint/complaint.controller.ts
    - tbs-erp-backend/src/modules/order/order-read.service.ts
    - tbs-erp-backend/src/modules/order/order.module.ts
    - tbs-erp-backend/src/modules/reports/reports.module.ts
    - tbs-erp-backend/src/modules/batch/batch.module.ts

key-decisions:
  - "Metadata-only scanning (no DI resolution) for RBAC audit test -- avoids Redis/DB connection requirements"
  - "Three-tier test: (1) strict @Roles/@Public+auth guard check, (2) advisory @Roles/@Public-only report, (3) full audit report"
  - "AuthController public endpoints (login, refresh, forgot-password, reset-password, 2fa/verify, 2fa/sms/send) marked @Public()"
  - "AuthController authenticated endpoints marked @Roles(...ALL_ROLES) for explicit access documentation"
  - "Complaint data scoping via order relation (where: { order: scopeFilter }) since complaints are order-linked"
  - "OrderReadService.getOrderList user param is optional for backward compatibility with internal callers"

patterns-established:
  - "Data scoping via related entity: where.order = scopeFilter for complaint->order relation"
  - "extractControllers() recursive module metadata scanner for CI tests"

requirements-completed: [SEC-02, SEC-03]

# Metrics
duration: 24min
completed: 2026-03-19
---

# Phase 5 Plan 2: RBAC Audit Integration Test & Data Scope Wiring Summary

**Metadata-scanning RBAC audit test covering all controllers as CI safety net, plus DataScopeService wired into complaint and order-read services for role-based data filtering**

## Performance

- **Duration:** 24 min
- **Started:** 2026-03-19T04:30:30Z
- **Completed:** 2026-03-19T04:54:30Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- RBAC audit integration test discovers all controllers via module metadata scanning (no DI resolution required)
- Test passes with zero violations -- every HTTP endpoint has @Roles(), @Public(), or UseGuards(JwtAuthGuard)
- AuthController properly decorated: public endpoints (@Public), authenticated endpoints (@Roles(...ALL_ROLES))
- BlogController public read endpoints (findAll, getAllTags, findBySlug) marked @Public()
- ComplaintService.findAll and findById now apply data scope filter via order relation
- OrderReadService.getOrderList now accepts optional user param for data scope filtering
- CRM data scoping verified as already operational

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RBAC audit integration test** - `fa13b0e` (feat)
2. **Task 2: Wire DataScopeService into complaint and order-read services** - `4c2914f` (feat)

## Files Created/Modified
- `tbs-erp-backend/test/integration/rbac-audit.integration.spec.ts` - RBAC audit integration test with metadata-only scanning
- `tbs-erp-backend/src/core/auth/auth.controller.ts` - Added @Public() and @Roles(...ALL_ROLES) to all auth endpoints
- `tbs-erp-backend/src/modules/blog/blog.controller.ts` - Added @Public() to read-only blog endpoints
- `tbs-erp-backend/src/modules/complaint/complaint.service.ts` - Added DataScopeService, data-scoped findAll and findById
- `tbs-erp-backend/src/modules/complaint/complaint.module.ts` - Added RbacModule import
- `tbs-erp-backend/src/modules/complaint/complaint.controller.ts` - Passes user to service, expanded roles
- `tbs-erp-backend/src/modules/order/order-read.service.ts` - Added DataScopeService, data-scoped getOrderList
- `tbs-erp-backend/src/modules/order/order.module.ts` - Added RbacModule import
- `tbs-erp-backend/src/modules/reports/reports.module.ts` - Fixed missing BullModule.registerQueue for report-jobs
- `tbs-erp-backend/src/modules/batch/batch.module.ts` - Fixed missing BullModule.registerQueue for batch-jobs

## Decisions Made
- Used metadata-only scanning (Reflect.getMetadata on module tree) instead of NestJS DiscoveryService to avoid DI resolution issues with Bull queues, Redis, and DB connections in test environment
- Three-level test: (1) strict test verifying @Roles/@Public or auth guards on all endpoints, (2) advisory test logging endpoints without explicit @Roles/@Public, (3) full audit report with endpoint breakdown
- AuthController: login/refresh/forgot-password/reset-password/2fa-verify/sms-send are @Public(); all other authenticated methods use @Roles(...ALL_ROLES)
- Complaint scoping applies scope filter on the order relation (complaints link to orders via orderId)
- OrderReadService user param is optional to maintain backward compatibility with internal service-to-service calls

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed ReportsModule missing BullModule.registerQueue for report-jobs**
- **Found during:** Task 1 (RBAC audit test compilation)
- **Issue:** ReportSchedulerService injects @InjectQueue('report-jobs') but ReportsModule didn't import BullModule.registerQueue
- **Fix:** Added BullModule.registerQueue({ name: 'report-jobs' }) to ReportsModule imports
- **Files modified:** tbs-erp-backend/src/modules/reports/reports.module.ts
- **Committed in:** fa13b0e

**2. [Rule 3 - Blocking] Fixed BatchModule missing BullModule.registerQueue for batch-jobs**
- **Found during:** Task 1 (RBAC audit test compilation)
- **Issue:** BatchController injects @InjectQueue('batch-jobs') but BatchModule didn't import BullModule.registerQueue
- **Fix:** Added BullModule.registerQueue({ name: 'batch-jobs' }) to BatchModule imports
- **Files modified:** tbs-erp-backend/src/modules/batch/batch.module.ts
- **Committed in:** fa13b0e

**3. [Rule 2 - Missing Critical] Added @Public/@Roles decorators to AuthController and BlogController**
- **Found during:** Task 1 (RBAC audit test discovered 180 violations)
- **Issue:** AuthController had no explicit access control decorators; BlogController public endpoints lacked @Public()
- **Fix:** Added @Public() to 6 public auth methods, @Roles(...ALL_ROLES) to 9 authenticated auth methods, @Public() to 3 blog read methods
- **Files modified:** auth.controller.ts, blog.controller.ts
- **Committed in:** fa13b0e

**4. [Rule 2 - Missing Critical] Changed test approach from DiscoveryService to metadata scanning**
- **Found during:** Task 1 (DI resolution failures with full AppModule compile)
- **Issue:** Test.createTestingModule(AppModule).compile() failed due to unresolvable Bull queue tokens and cross-module DI issues
- **Fix:** Switched to metadata-only scanning using Reflect.getMetadata on module tree -- no DI resolution needed
- **Committed in:** fa13b0e

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 missing critical)
**Impact on plan:** All auto-fixes necessary for test functionality and correctness. No scope creep.

## Issues Encountered
- 2 pre-existing TypeScript errors in prisma.service.ts and batch-job.service.ts -- not related to this plan, documented in Plan 05-01
- Full AppModule compile() in test environment requires all infrastructure (Redis, Bull queues) to be mockable -- resolved by using metadata-only scanning approach

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- RBAC audit test provides CI safety net for all future controller additions
- DataScopeService pattern established for complaint and order-read services
- All SEC-02 (CI RBAC enforcement) and SEC-03 (data scoping) requirements met
- Phase 5 complete -- ready for Phase 6 (FSM Verification)

---
*Phase: 05-rbac-audit-coverage*
*Completed: 2026-03-19*
