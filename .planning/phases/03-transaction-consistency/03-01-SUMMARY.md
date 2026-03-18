---
phase: 03-transaction-consistency
plan: 01
subsystem: database
tags: [prisma, transactions, event-emitter, nestjs, atomicity, deferred-emit]

# Dependency graph
requires:
  - phase: 01-backend-error-standardization
    provides: DomainException error handling used in all services
provides:
  - TransactionalEmitter service with createCollector() for deferred event emission
  - Transaction-wrapped multi-table writes in order, complaint services
  - Deferred emit pattern applied to container, cash, order services
affects: [03-transaction-consistency, 04-fsm-enforcement, 06-business-rules]

# Tech tracking
tech-stack:
  added: []
  patterns: [transactional-emitter-collector, deferred-event-emission, executeInTransaction-wrapping]

key-files:
  created:
    - tbs-erp-backend/src/core/events/transactional-emitter.service.ts
  modified:
    - tbs-erp-backend/src/core/events/events.module.ts
    - tbs-erp-backend/src/core/event-bus/event-bus.module.ts
    - tbs-erp-backend/src/modules/order/order-status.service.ts
    - tbs-erp-backend/src/modules/order/order.service.ts
    - tbs-erp-backend/src/modules/order/order.module.ts
    - tbs-erp-backend/src/modules/container/container.service.ts
    - tbs-erp-backend/src/modules/container/container.module.ts
    - tbs-erp-backend/src/modules/cash/cash.service.ts
    - tbs-erp-backend/src/modules/cash/cash.module.ts
    - tbs-erp-backend/src/modules/complaint/complaint.service.ts
    - tbs-erp-backend/src/modules/complaint/complaint.module.ts

key-decisions:
  - "TransactionalEmitter registered in both EventsModule and EventBusModule for universal DI access"
  - "Collector pattern buffers events inside tx, flush() fires after commit, discard() for rollback"
  - "EventBusModule imported per-module rather than @Global() to maintain explicit dependency graph"

patterns-established:
  - "Deferred emit pattern: const collector = txEmitter.createCollector(); ... collector.emit() inside tx ... collector.flush() after tx"
  - "Multi-table atomicity: all related writes go through prisma.executeInTransaction(async (tx) => {...})"

requirements-completed: [DAT-01, DAT-02]

# Metrics
duration: 9min
completed: 2026-03-18
---

# Phase 3 Plan 1: TransactionalEmitter + Deferred Emit Summary

**TransactionalEmitter collector pattern applied to 8 service methods across 5 files, ensuring atomic multi-table writes and post-commit event emission**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-18T16:45:03Z
- **Completed:** 2026-03-18T16:54:07Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Created TransactionalEmitter utility service with createCollector() returning {emit, flush, discard} interface
- Wrapped adjustOrderItemQuantity (orderItem.update + order.update) and resolveComplaint approval branches (approval.create + complaint.update) in executeInTransaction for atomicity
- Moved all event emissions from inside executeInTransaction callbacks to collector pattern in container.updateStatus, container.addPackages, and cash.approveVoucher
- Applied deferred emit to order.changeStatus, autoTransitionToWarehouseCN, and reopenOrder for consistency
- Zero direct eventEmitter.emit calls remain inside any executeInTransaction callback across all 5 modified service files

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TransactionalEmitter service and register in modules** - `353f066` (feat)
2. **Task 2: Apply transactions + deferred emit to order, container, cash, complaint services** - `7d80678` (feat)

## Files Created/Modified
- `tbs-erp-backend/src/core/events/transactional-emitter.service.ts` - New TransactionalEmitter injectable with createCollector() pattern
- `tbs-erp-backend/src/core/events/events.module.ts` - Added TransactionalEmitter to providers + exports
- `tbs-erp-backend/src/core/event-bus/event-bus.module.ts` - Added TransactionalEmitter to providers + exports
- `tbs-erp-backend/src/modules/order/order-status.service.ts` - Deferred emit in changeStatus, adjustOrderItemQuantity wrapped in tx, deferred emit in autoTransitionToWarehouseCN
- `tbs-erp-backend/src/modules/order/order.service.ts` - Deferred emit in reopenOrder
- `tbs-erp-backend/src/modules/order/order.module.ts` - Added EventBusModule import
- `tbs-erp-backend/src/modules/container/container.service.ts` - Collector pattern in updateStatus and addPackages (events moved outside tx)
- `tbs-erp-backend/src/modules/container/container.module.ts` - Added EventBusModule import
- `tbs-erp-backend/src/modules/cash/cash.service.ts` - Collector pattern in approveVoucher (events moved outside tx)
- `tbs-erp-backend/src/modules/cash/cash.module.ts` - Added EventBusModule import
- `tbs-erp-backend/src/modules/complaint/complaint.service.ts` - Transaction-wrapped approval branches, deferred emit in direct resolution
- `tbs-erp-backend/src/modules/complaint/complaint.module.ts` - Added EventBusModule import

## Decisions Made
- TransactionalEmitter registered in both EventsModule and EventBusModule so modules importing either get access
- EventBusModule imported per-module (not @Global) to keep explicit dependency graph visible
- Collector pattern chosen over alternatives (Prisma middleware, afterCommit hooks) for simplicity and zero Prisma coupling

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in prisma.service.ts and batch-job.service.ts (unrelated to this plan's changes, out of scope)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- TransactionalEmitter pattern established, ready for plan 03-02 (additional services)
- Pattern can be applied to any future service that needs atomic writes with deferred events

## Self-Check: PASSED

- FOUND: transactional-emitter.service.ts
- FOUND: commit 353f066
- FOUND: commit 7d80678
- FOUND: 03-01-SUMMARY.md

---
*Phase: 03-transaction-consistency*
*Completed: 2026-03-18*
