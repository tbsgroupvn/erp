# Phase 3: Transaction Consistency - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Ensure all multi-table write operations are atomic (Prisma interactive transactions), events only fire after successful commit (deferred emit pattern), and the application shuts down gracefully (BullMQ worker drain + Prisma disconnect). This phase does NOT add new business logic, change schemas, or modify FSM transitions.

</domain>

<decisions>
## Implementation Decisions

### Transaction Scope
- Focus on critical multi-table write paths: order status changes, cost allocation, deposit recording, container status changes, complaint resolution, general ledger journal entries
- Audit all service methods that do multiple `prisma.xxx.create/update/delete` calls without a wrapping `$transaction` — wrap them in Prisma interactive transactions
- Services that already use `$transaction` (20+ files) should be verified but not refactored unless they have event emission inside the transaction
- Config/boot-time operations and single-table writes do NOT need transaction wrapping
- Claude has discretion on identifying which specific methods need wrapping based on codebase audit

### Event-After-Commit Strategy
- Use a lightweight deferred emit pattern: collect events during the transaction, emit them only after `$transaction` resolves successfully
- Implementation: create a `TransactionalEventEmitter` utility or service that wraps `EventEmitter2` — accepts events during a transaction context, flushes them on commit, discards them on rollback
- Do NOT implement a full outbox pattern (database table + polling) — too heavy for current scale. The deferred emit pattern is sufficient since events are in-process (not cross-service)
- Key targets: `order-status.service.ts` (4 event emissions), `order.service.ts`, `cash.service.ts`, `complaint.service.ts`, any service that emits events after writes
- Claude has discretion on the exact utility design (class vs function, how transaction context is passed)

### Graceful Shutdown Behavior
- `enableShutdownHooks()` is already called in `main.ts` — keep it
- Add `onApplicationShutdown` lifecycle hook to key services:
  - BullMQ workers: close all processors gracefully (wait for in-flight jobs to finish, max 30s timeout)
  - Prisma: `$disconnect()` after all workers are closed
  - Redis: close connections after BullMQ workers
  - WebSocket gateway: close connections
- Shutdown order: BullMQ workers → WebSocket → Redis → Prisma → exit
- 30-second timeout for in-flight BullMQ jobs — if they don't finish, force-close
- Claude has discretion on implementation details (single shutdown service vs per-module hooks)

### Claude's Discretion
- Which specific service methods need transaction wrapping (based on codebase audit)
- TransactionalEventEmitter design (class vs helper function, context passing mechanism)
- Whether to use NestJS `OnApplicationShutdown` per-module or a centralized shutdown orchestrator
- Shutdown timeout values (30s suggested but flexible)
- Whether existing `$transaction` usages need event-emission fixes

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Transaction patterns
- `tbs-erp-backend/src/modules/order/order.service.ts` — Order creation with $transaction, event emissions after writes
- `tbs-erp-backend/src/modules/order/order-status.service.ts` — Status changes with 4 event emissions (key target for deferred emit)
- `tbs-erp-backend/src/modules/order/sagas/order-completion.saga.ts` — Order completion saga with multi-step writes
- `tbs-erp-backend/src/modules/general-ledger/general-ledger.service.ts` — Journal entry creation (multi-table)
- `tbs-erp-backend/src/modules/cash/cash.service.ts` — Payment voucher operations with events

### Event infrastructure
- `tbs-erp-backend/src/core/events/event-publisher.service.ts` — EventPublisher wrapping EventEmitter2 (with requestId from Phase 1)
- `tbs-erp-backend/src/core/events/processors/order-event.processor.ts` — Order event processor (BullMQ)
- `tbs-erp-backend/src/core/events/processors/finance-event.processor.ts` — Finance event processor
- `tbs-erp-backend/src/core/events/processors/notification-event.processor.ts` — Notification processor

### Shutdown infrastructure
- `tbs-erp-backend/src/main.ts` — Bootstrap with enableShutdownHooks()
- `tbs-erp-backend/src/core/database/prisma.service.ts` — PrismaService with existing shutdown hooks
- `tbs-erp-backend/src/core/queue/failed-job-capture.service.ts` — DLQ capture (needs graceful close)

### Database
- `tbs-erp-backend/src/core/database/prisma.service.ts` — PrismaService, $transaction usage pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EventPublisherService`: Wraps `EventEmitter2` with `requestId` propagation (from Phase 1) — extend for deferred emit
- `PrismaService`: Custom service with `onModuleInit` and `onModuleDestroy` — already handles basic connection lifecycle
- `enableShutdownHooks()`: Already enabled in `main.ts`
- `DomainException`: Phase 1 error handling for transaction failure reporting

### Established Patterns
- `prisma.$transaction([...])` for batch operations (sequential array pattern)
- `prisma.$transaction(async (tx) => { ... })` for interactive transactions
- `this.eventEmitter.emit('event.name', payload)` for synchronous in-process events
- `@OnEvent('event.name')` decorators for event listeners
- `@Processor('queue-name')` for BullMQ processors

### Integration Points
- All services that do multi-table writes and emit events
- `EventPublisherService` — modify to support deferred mode
- `main.ts` — shutdown hooks already wired
- BullMQ workers in `src/core/events/processors/` — need graceful close
- `QueueModule` — BullMQ queue configuration

</code_context>

<specifics>
## Specific Ideas

- User delegated all decisions to Claude — chose "Claude decides all"
- Deferred emit (not outbox) — simpler, matches current in-process architecture
- 30s timeout for BullMQ drain — balances between job completion and fast shutdown
- Shutdown order: BullMQ → WebSocket → Redis → Prisma

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-transaction-consistency*
*Context gathered: 2026-03-18*
