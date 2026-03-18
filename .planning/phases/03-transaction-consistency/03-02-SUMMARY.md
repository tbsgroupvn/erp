---
phase: 03-transaction-consistency
plan: 02
subsystem: infra
tags: [nestjs, bullmq, websocket, graceful-shutdown, lifecycle-hooks]

# Dependency graph
requires:
  - phase: 03-transaction-consistency/01
    provides: TransactionalEmitter + EventBusModule for deferred event emission
provides:
  - GracefulShutdownService with ordered teardown (BullMQ -> WS -> Prisma)
  - ShutdownModule registered in AppModule
  - 30s worker drain timeout via Promise.race
affects: [deployment, docker, production-ops]

# Tech tracking
tech-stack:
  added: []
  patterns: [BeforeApplicationShutdown lifecycle, DiscoveryService for dynamic provider resolution, Promise.race timeout pattern]

key-files:
  created:
    - tbs-erp-backend/src/core/shutdown/graceful-shutdown.service.ts
    - tbs-erp-backend/src/core/shutdown/shutdown.module.ts
  modified:
    - tbs-erp-backend/src/app.module.ts

key-decisions:
  - "BeforeApplicationShutdown (Option A) chosen over OnApplicationShutdown to drain workers while DB is still available"
  - "DiscoveryService dynamically finds all WorkerHost instances instead of hardcoding 7 processor references"
  - "Dynamic import of WsGateway to avoid circular dependencies at module load time"

patterns-established:
  - "Shutdown ordering: BeforeApplicationShutdown for cleanup requiring DB access, OnModuleDestroy for DB disconnect"
  - "Promise.race with setTimeout for bounded-time async operations"
  - "DiscoveryService + instanceof for dynamic provider discovery"

requirements-completed: [DAT-06]

# Metrics
duration: 3min
completed: 2026-03-18
---

# Phase 3 Plan 2: Graceful Shutdown Summary

**Centralized GracefulShutdownService using BeforeApplicationShutdown to drain BullMQ workers (30s timeout) and close WebSocket before Prisma disconnects**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T16:56:55Z
- **Completed:** 2026-03-18T16:59:44Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- GracefulShutdownService with BeforeApplicationShutdown lifecycle hook enforces correct teardown order
- DiscoveryService dynamically discovers all 7 WorkerHost instances for draining
- 30-second timeout prevents stuck workers from blocking shutdown indefinitely
- WebSocket server closed with 5s safety timeout during shutdown
- ShutdownModule registered in AppModule for automatic lifecycle integration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GracefulShutdownService with ordered teardown and 30s worker drain timeout** - `379e08d` (feat)
2. **Task 2: Register ShutdownModule in AppModule** - `7ee2967` (feat)

## Files Created/Modified
- `tbs-erp-backend/src/core/shutdown/graceful-shutdown.service.ts` - Centralized shutdown orchestrator with worker drain + WS close
- `tbs-erp-backend/src/core/shutdown/shutdown.module.ts` - Module wrapper with DiscoveryModule import
- `tbs-erp-backend/src/app.module.ts` - ShutdownModule added to imports array

## Decisions Made
- **BeforeApplicationShutdown over OnApplicationShutdown:** Using BeforeApplicationShutdown ensures workers can still access the database during drain. OnApplicationShutdown fires after onModuleDestroy (which is when PrismaService disconnects), so in-flight jobs would get "Database connection closed" errors.
- **DiscoveryService for worker discovery:** Instead of hardcoding references to all 7 processors, DiscoveryService.getProviders() dynamically finds all WorkerHost instances. This is future-proof when new processors are added.
- **Dynamic import for WsGateway:** Uses `await import()` to resolve WsGateway at shutdown time instead of constructor injection, avoiding circular dependency between ShutdownModule and WsModule.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 03 (Transaction Consistency) is now fully complete with both plans done
- TransactionalEmitter (plan 01) + GracefulShutdownService (plan 02) provide a complete transaction safety foundation
- Ready for Phase 04 (Input Validation & Sanitization)

## Self-Check: PASSED

All files verified present on disk. All commit hashes found in git log.

---
*Phase: 03-transaction-consistency*
*Completed: 2026-03-18*
