# Phase 3: Transaction Consistency - Research

**Researched:** 2026-03-18
**Domain:** Prisma interactive transactions, deferred event emission, NestJS graceful shutdown, BullMQ worker draining
**Confidence:** HIGH

## Summary

Phase 3 hardens three interconnected concerns: (1) wrapping multi-table write operations in Prisma interactive transactions so partial state is impossible, (2) deferring event emissions until transactions commit successfully so downstream listeners never react to rolled-back data, and (3) orchestrating a clean shutdown sequence so in-flight BullMQ jobs complete and database connections close without data loss.

The codebase already has strong foundations: `PrismaService.executeInTransaction()` with automatic retry on serialization failures (P2034/P2035), `enableShutdownHooks()` in `main.ts`, and `FailedJobCaptureService` with `onModuleDestroy`. The gaps are specific: several critical service methods perform multi-table writes without transaction wrappers, event emissions inside `executeInTransaction` callbacks fire before commit, and no centralized shutdown orchestrator exists to enforce the correct teardown order (BullMQ workers -> WebSocket -> Redis -> Prisma).

**Primary recommendation:** Build a `TransactionalOutbox` helper that collects events during a transaction callback and flushes them only after the `$transaction` promise resolves; apply it to the 6-8 critical service methods identified in the audit; add a `GracefulShutdownService` implementing `OnApplicationShutdown` that drains all BullMQ workers with a 30-second timeout before closing Redis and Prisma.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Focus on critical multi-table write paths: order status changes, cost allocation, deposit recording, container status changes, complaint resolution, general ledger journal entries
- Audit all service methods that do multiple `prisma.xxx.create/update/delete` calls without a wrapping `$transaction` -- wrap them in Prisma interactive transactions
- Services that already use `$transaction` (20+ files) should be verified but not refactored unless they have event emission inside the transaction
- Config/boot-time operations and single-table writes do NOT need transaction wrapping
- Use a lightweight deferred emit pattern: collect events during the transaction, emit them only after `$transaction` resolves successfully
- Implementation: create a `TransactionalEventEmitter` utility or service that wraps `EventEmitter2` -- accepts events during a transaction context, flushes them on commit, discards them on rollback
- Do NOT implement a full outbox pattern (database table + polling) -- too heavy for current scale. The deferred emit pattern is sufficient since events are in-process (not cross-service)
- Key targets: `order-status.service.ts` (4 event emissions), `order.service.ts`, `cash.service.ts`, `complaint.service.ts`, any service that emits events after writes
- `enableShutdownHooks()` is already called in `main.ts` -- keep it
- Add `onApplicationShutdown` lifecycle hook to key services
- BullMQ workers: close all processors gracefully (wait for in-flight jobs to finish, max 30s timeout)
- Prisma: `$disconnect()` after all workers are closed
- Redis: close connections after BullMQ workers
- WebSocket gateway: close connections
- Shutdown order: BullMQ workers -> WebSocket -> Redis -> Prisma -> exit
- 30-second timeout for in-flight BullMQ jobs -- if they don't finish, force-close

### Claude's Discretion
- Which specific service methods need transaction wrapping (based on codebase audit)
- TransactionalEventEmitter design (class vs helper function, context passing mechanism)
- Whether to use NestJS `OnApplicationShutdown` per-module or a centralized shutdown orchestrator
- Shutdown timeout values (30s suggested but flexible)
- Whether existing `$transaction` usages need event-emission fixes

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DAT-01 | All multi-table write operations (order status change, cost allocation, deposit recording) use Prisma interactive transactions | Codebase audit identifies 6-8 methods needing transaction wrappers; `executeInTransaction` helper already exists with retry logic |
| DAT-02 | Service methods that emit events after writes do so inside the same transaction (or use outbox pattern) | Deferred emit pattern via `TransactionalEventEmitter` -- collects events during tx, flushes after commit |
| DAT-06 | Application enables NestJS shutdown hooks with graceful BullMQ worker close and Prisma disconnect | `enableShutdownHooks()` already in `main.ts`; need `GracefulShutdownService` with ordered teardown and 30s timeout |
</phase_requirements>

## Standard Stack

### Core (already installed -- no new packages needed)

| Library | Version (pinned) | Purpose | Why Standard |
|---------|-----------------|---------|--------------|
| @nestjs/core | ^11.1.15 | Framework | Already in project |
| @prisma/client | ^6.3.0 | ORM with interactive transactions | Already in project, `$transaction(async (tx) => {...})` API |
| @nestjs/event-emitter | ^3.0.1 | In-process event bus (EventEmitter2) | Already in project |
| @nestjs/bullmq | ^11.0.4 | BullMQ integration for NestJS | Already in project, `WorkerHost` base class |
| bullmq | ^5.13.0 | Queue/worker with `worker.close()` API | Already in project |

### Supporting

No new packages required. This phase is purely about applying existing APIs correctly.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deferred emit pattern | Full DB outbox (insert to outbox table, poll + publish) | Outbox guarantees at-least-once delivery across process restarts but adds DB writes, polling, and complexity. User explicitly chose deferred emit for current in-process architecture |
| Manual `$transaction` calls | `executeInTransaction` helper | Helper already handles P2034/P2035 retry. Use it for all new transaction wraps |
| Centralized shutdown service | Per-module `onApplicationShutdown` | Centralized is better because shutdown ORDER matters (BullMQ before Prisma). Per-module hooks execute in arbitrary module resolution order |

## Architecture Patterns

### Recommended Project Structure

```
src/
  core/
    events/
      event-publisher.service.ts          # Existing - routes to BullMQ queues
      transactional-emitter.service.ts    # NEW - deferred emit utility
    database/
      prisma.service.ts                   # Existing - executeInTransaction helper
    shutdown/
      graceful-shutdown.service.ts        # NEW - centralized shutdown orchestrator
  modules/
    order/
      order-status.service.ts             # MODIFY - wrap in tx + deferred emit
      order.service.ts                    # VERIFY - already uses tx, fix event timing
    cash/
      cash.service.ts                     # VERIFY - approveVoucher already uses tx but emits inside
    container/
      container.service.ts               # VERIFY - updateStatus already uses tx but emits inside
    complaint/
      complaint.service.ts               # MODIFY - resolveComplaint needs tx wrapper
    general-ledger/
      general-ledger.service.ts          # VERIFY - createJournalEntry is single-model, OK
```

### Pattern 1: TransactionalEventEmitter (Deferred Emit)

**What:** A utility that collects event emissions during a Prisma transaction callback and only dispatches them after the transaction commits successfully. On rollback (exception), collected events are discarded.

**When to use:** Any service method that performs a Prisma `$transaction` AND emits events that downstream listeners should only process if the write succeeded.

**Design recommendation (Claude's discretion area):** Use a class-based service injected via DI.

```typescript
// Source: Custom pattern based on Prisma $transaction API
// File: src/core/events/transactional-emitter.service.ts

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface DeferredEvent {
  eventName: string;
  payload: any;
}

@Injectable()
export class TransactionalEmitter {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Creates a collector that buffers events during a transaction.
   * Returns { emit, flush } -- call emit() inside tx, flush() after tx commits.
   */
  createCollector(): {
    emit: (eventName: string, payload: any) => void;
    flush: () => void;
    discard: () => void;
  } {
    const buffer: DeferredEvent[] = [];

    return {
      emit: (eventName: string, payload: any) => {
        buffer.push({ eventName, payload });
      },
      flush: () => {
        for (const { eventName, payload } of buffer) {
          this.eventEmitter.emit(eventName, payload);
        }
        buffer.length = 0;
      },
      discard: () => {
        buffer.length = 0;
      },
    };
  }
}
```

**Usage in service methods:**

```typescript
// Source: Pattern for order-status.service.ts changeStatus()
async changeStatus(id: string, newStatus: OrderStatus, userId: string, note?: string) {
  const collector = this.txEmitter.createCollector();

  const result = await this.prisma.executeInTransaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id } });
    // ... validation, status update via tx ...

    // Buffer events instead of emitting directly
    collector.emit('order.status.changed', {
      orderId: id,
      fromStatus: order.status,
      toStatus: newStatus,
      changedBy: userId,
    });

    if (newStatus === OrderStatus.SOURCING) {
      collector.emit('order.confirmed', { orderId: id, ... });
    }

    return updated;
  });

  // Only after transaction commits successfully
  collector.flush();
  return result;
}
```

### Pattern 2: Wrapping Non-Transactional Multi-Table Writes

**What:** Identifying service methods that perform multiple Prisma operations on different tables without a transaction wrapper, and wrapping them in `prisma.executeInTransaction()`.

**When to use:** Any method that does 2+ write operations on different tables where partial completion would leave inconsistent state.

```typescript
// BEFORE (unsafe): complaint.resolveComplaint with compensation > threshold
const approval = await this.prisma.approval.create({ ... });  // Step 1
await this.prisma.complaint.update({ ... });                    // Step 2 -- if this fails, orphan approval

// AFTER (safe):
const result = await this.prisma.executeInTransaction(async (tx) => {
  const approval = await tx.approval.create({ ... });
  await tx.complaint.update({ ... });
  return { approval, complaint };
});
```

### Pattern 3: Centralized Graceful Shutdown

**What:** A single service that orchestrates shutdown in the correct order, with timeout protection.

**When to use:** Application shutdown (SIGTERM, SIGINT).

```typescript
// Source: NestJS lifecycle docs + BullMQ graceful shutdown docs
// File: src/core/shutdown/graceful-shutdown.service.ts

@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private readonly DRAIN_TIMEOUT_MS = 30_000;

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Shutdown initiated (signal: ${signal})`);

    // 1. Drain BullMQ workers (wait for in-flight jobs)
    await this.drainWorkers();

    // 2. Close WebSocket connections
    await this.closeWebSocket();

    // 3. Close Redis connections
    await this.closeRedis();

    // 4. Disconnect Prisma (handled by PrismaService.onModuleDestroy)
    // Already wired via NestJS lifecycle
  }

  private async drainWorkers(): Promise<void> {
    // worker.close() returns a Promise that resolves when all in-flight jobs finish
    // Wrap in Promise.race with timeout
    const drainPromise = Promise.allSettled(
      this.workers.map(w => w.close())
    );
    await Promise.race([
      drainPromise,
      new Promise(resolve => setTimeout(resolve, this.DRAIN_TIMEOUT_MS)),
    ]);
  }
}
```

### Anti-Patterns to Avoid

- **Emitting events inside `$transaction` callback:** The event fires immediately, before the transaction commits. If the transaction later rolls back, downstream listeners have already processed stale/phantom data. This is the core problem DAT-02 addresses.
- **Nested transactions:** Prisma does not support nested `$transaction` calls. If `serviceA.method()` wraps in a transaction and calls `serviceB.method()` which also wraps, the inner transaction runs independently. Keep transaction boundaries at the service method level.
- **Long-running transactions:** Prisma interactive transactions default to 5-second timeout. Keep writes short. Move heavy reads (validation, lookups) outside the transaction where safe.
- **Relying on module destruction order for shutdown:** NestJS `onModuleDestroy` hooks fire in module resolution order, which may not match the required shutdown sequence. Use `onApplicationShutdown` (fires after `onModuleDestroy`) with explicit ordering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transaction retry on serialization failure | Custom retry loop per service | `PrismaService.executeInTransaction()` | Already handles P2034/P2035 with configurable retry count |
| Event deferred emission | Ad-hoc array management per method | `TransactionalEmitter.createCollector()` | Consistent API, prevents missed flushes, centralizes the pattern |
| Shutdown timeout | `setTimeout` + `process.exit(1)` scattered | `Promise.race([close(), timeout()])` in GracefulShutdownService | Clean, awaitable, logs which workers timed out |
| Worker reference tracking | Manual Map of worker instances | `@nestjs/bullmq` `WorkerHost` base class + NestJS `DiscoveryService` | Framework manages worker lifecycle |

**Key insight:** The codebase already has `executeInTransaction` with retry logic and `enableShutdownHooks`. This phase is about applying existing infrastructure consistently, not building new abstractions from scratch. The only genuinely new code is the `TransactionalEmitter` (small utility) and `GracefulShutdownService` (orchestration).

## Common Pitfalls

### Pitfall 1: Events Emitted Inside Transactions

**What goes wrong:** `this.eventEmitter.emit('order.status.changed', ...)` inside a `$transaction` callback fires the event immediately. If the transaction later fails and rolls back, downstream listeners (notification, dashboard update, AR creation) have already processed the event based on data that no longer exists.

**Why it happens:** `EventEmitter2.emit()` is synchronous and has no awareness of Prisma transaction state.

**How to avoid:** Use the `TransactionalEmitter.createCollector()` pattern. Buffer events during the transaction, flush after commit.

**Warning signs:** Look for `this.eventEmitter.emit(...)` calls inside `$transaction` or `executeInTransaction` callbacks. Found in:
- `container.service.ts` `updateStatus()` -- 4 event emissions inside `executeInTransaction`
- `container.service.ts` `addPackages()` -- 1 event emission inside `executeInTransaction`
- `cash.service.ts` `approveVoucher()` -- 2 event emissions inside `executeInTransaction`
- `order-completion.saga.ts` `emitCompletionEvents()` step -- fires after saga steps but saga steps are not in a single transaction

### Pitfall 2: Multi-Table Writes Without Transactions

**What goes wrong:** If step 2 of a multi-table write fails, step 1 remains committed, leaving the database in an inconsistent state.

**Why it happens:** Developers write sequential `await prisma.x.create()` / `await prisma.y.update()` calls without wrapping them.

**How to avoid:** Wrap all multi-table write paths in `executeInTransaction()`. Use the codebase audit findings below.

**Warning signs:** Service methods with 2+ `prisma.xxx.create/update/delete` calls on different models without a `$transaction` wrapper. Key offenders identified:
- `order-status.service.ts` `changeStatus()` -- `orderRepo.updateStatus()` + direct event emits (updateStatus itself uses `$transaction` internally in the repo, but the combination with events is unprotected)
- `order-status.service.ts` `adjustOrderItemQuantity()` -- updates OrderItem, then recalculates Order total, then emits event (3 separate operations)
- `complaint.service.ts` `resolveComplaint()` -- creates Approval + updates Complaint status (when compensation > threshold)
- `order.service.ts` `reopenOrder()` -- updates order status + creates status history + emits events (uses nested `statusHistory.create` in the same Prisma call, which IS atomic, but the cache invalidation and event emits are separate)

### Pitfall 3: Prisma Transaction Timeout

**What goes wrong:** Interactive transactions default to 5 seconds. Complex operations (validation reads + multiple writes) can exceed this.

**Why it happens:** Developers include validation queries (customer lookup, period check) inside the transaction when they could be done outside.

**How to avoid:** Move read-only validation BEFORE the transaction. Only include writes and write-dependent reads (optimistic concurrency checks) inside the transaction. Configure timeout explicitly via `$transaction(fn, { timeout: 10000 })` for known-heavy operations if needed.

**Warning signs:** Transaction timeout errors (P2028) in production logs.

### Pitfall 4: BullMQ Worker Close Without Timeout

**What goes wrong:** `worker.close()` waits indefinitely for in-flight jobs. If a job is stuck (e.g., waiting on an external API), shutdown never completes, and the process is eventually killed by Docker/Kubernetes with SIGKILL, causing stalled jobs.

**Why it happens:** BullMQ's `close()` method does not have a built-in timeout parameter.

**How to avoid:** Wrap `worker.close()` in `Promise.race` with a 30-second timeout. After timeout, let the process exit; BullMQ's stalled job detection will pick up the unfinished job when another worker starts.

**Warning signs:** Process hangs during shutdown, Docker forcefully kills the container.

### Pitfall 5: Shutdown Hook Ordering

**What goes wrong:** If Prisma disconnects before BullMQ workers finish draining, in-flight jobs that need DB access will fail with connection errors.

**Why it happens:** `onModuleDestroy` hooks fire in module resolution order, not in a developer-controlled sequence. `PrismaService.onModuleDestroy` might fire before `OrderEventProcessor` finishes.

**How to avoid:** Use `onApplicationShutdown` (which fires AFTER `onModuleDestroy`) for the centralized shutdown orchestrator, OR use `beforeApplicationShutdown` for worker draining and let `onModuleDestroy` handle Prisma disconnect naturally.

**Warning signs:** "Database connection closed" log appearing before "Worker drained" log during shutdown.

## Code Examples

### Existing executeInTransaction Usage (Reference)

```typescript
// Source: tbs-erp-backend/src/core/database/prisma.service.ts (lines 199-233)
async executeInTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await this.$transaction(fn);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientInitializationError ||
        error instanceof Prisma.PrismaClientRustPanicError
      ) {
        this._isHealthy = false;
        throw new InternalServerErrorException('Database temporarily unavailable');
      }
      attempt++;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' || error.code === 'P2035') &&
        attempt < maxRetries
      ) {
        continue; // Retry on serialization failure
      }
      throw error;
    }
  }
}
```

### Current Problem: Events Inside Transaction (cash.service.ts approveVoucher)

```typescript
// Source: tbs-erp-backend/src/modules/cash/cash.service.ts (lines 325-486)
// PROBLEM: eventEmitter.emit() calls at lines 460-478 fire INSIDE the transaction
async approveVoucher(voucherId: string, approvedBy: string) {
  return this.prisma.executeInTransaction(async (tx) => {
    // ... validation, status update, cash transaction creation ...

    // BUG: These fire immediately, before transaction commits
    this.eventEmitter.emit('voucher.approved', { ... });
    if (voucher.type === 'RECEIPT' && voucher.orderId) {
      this.eventEmitter.emit('payment.received', { ... });
    }

    return updated;
  });
}
```

### Fixed Pattern: Deferred Emit with Transaction

```typescript
// Source: Custom pattern for cash.service.ts
async approveVoucher(voucherId: string, approvedBy: string) {
  const collector = this.txEmitter.createCollector();

  const result = await this.prisma.executeInTransaction(async (tx) => {
    // ... all existing validation and writes using tx ...

    // Buffer events instead of emitting
    collector.emit('voucher.approved', {
      voucherId: voucher.id,
      voucherCode: voucher.code,
      type: voucher.type,
      amount: voucher.amount.toNumber(),
      orderId: voucher.orderId,
      approvedBy,
    });

    if (voucher.type === 'RECEIPT' && voucher.orderId) {
      collector.emit('payment.received', {
        orderId: voucher.orderId,
        amount: voucher.amount.toNumber(),
        paymentMethod: voucher.paymentMethod,
        reference: voucher.code,
      });
    }

    return updated;
  });

  // Transaction committed successfully -- now emit
  collector.flush();
  return result;
}
```

### Graceful Shutdown with Worker Draining

```typescript
// Source: BullMQ docs + NestJS lifecycle docs
@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);
  private readonly DRAIN_TIMEOUT_MS = 30_000;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly discoveryService: DiscoveryService,
  ) {}

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Graceful shutdown initiated (signal: ${signal})`);

    // Step 1: Drain BullMQ workers
    const workers = this.discoveryService
      .getProviders()
      .filter(wrapper => wrapper.instance instanceof WorkerHost)
      .map(wrapper => wrapper.instance as WorkerHost);

    this.logger.log(`Draining ${workers.length} BullMQ worker(s)...`);

    const drainPromise = Promise.allSettled(
      workers.map(async (worker) => {
        try {
          await worker.worker.close();
          this.logger.log(`Worker ${worker.constructor.name} drained`);
        } catch (err) {
          this.logger.warn(`Worker ${worker.constructor.name} drain error: ${err.message}`);
        }
      }),
    );

    const result = await Promise.race([
      drainPromise.then(() => 'drained' as const),
      new Promise<'timeout'>(resolve =>
        setTimeout(() => resolve('timeout'), this.DRAIN_TIMEOUT_MS),
      ),
    ]);

    if (result === 'timeout') {
      this.logger.warn(`Worker drain timed out after ${this.DRAIN_TIMEOUT_MS}ms`);
    }

    this.logger.log('Graceful shutdown complete');
  }
}
```

## Codebase Audit: Methods Requiring Changes

### Methods Needing Transaction Wrapping (DAT-01)

| Service | Method | Tables Affected | Current State | Action |
|---------|--------|-----------------|---------------|--------|
| `order-status.service.ts` | `changeStatus()` | Order, OrderStatusHistory | Repo `updateStatus()` uses tx internally, but no tx around the full method | Wrap full method in `executeInTransaction` |
| `order-status.service.ts` | `adjustOrderItemQuantity()` | OrderItem, Order | Two separate `prisma.update()` calls | Wrap in `executeInTransaction` |
| `complaint.service.ts` | `resolveComplaint()` | Complaint, Approval, ApprovalStep | Creates approval + updates complaint in separate calls | Wrap in `executeInTransaction` |
| `order.service.ts` | `reopenOrder()` | Order (with nested statusHistory) | Already atomic via nested create, but emits 2 events outside | Already safe for writes, needs deferred emit only |

### Methods Needing Deferred Emit Fix (DAT-02)

| Service | Method | Events Emitted Inside Tx | Fix |
|---------|--------|--------------------------|-----|
| `cash.service.ts` | `approveVoucher()` | `voucher.approved`, `payment.received` | Move emissions to collector, flush after tx |
| `container.service.ts` | `updateStatus()` | `container.customs.started`, `container.status.changed`, `container.arrived`, `container.departed`, `container.on_hold_border` | Move to collector |
| `container.service.ts` | `addPackages()` | `container.packages.added` | Move to collector |
| `order-completion.saga.ts` | `emitCompletionEvents()` step | `order.completed` | Saga steps are not in a single Prisma tx; this is separate concern |

### Methods Already Correctly Structured (Verify Only)

| Service | Method | Notes |
|---------|--------|-------|
| `order.service.ts` | `createOrder()` | Uses `$transaction`, events emitted AFTER the tx block -- CORRECT |
| `order.service.ts` | `updateOrder()` | Single `orderRepo.update()` call, event emitted after -- CORRECT |
| `complaint.service.ts` | `createComplaint()` | Uses `executeInTransaction`, events emitted after -- CORRECT |
| `general-ledger.service.ts` | `createJournalEntry()` | Single `prisma.journalEntry.create()` with nested lines -- CORRECT (atomic via nested create) |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma batch transactions `$transaction([])` | Interactive transactions `$transaction(async (tx) => {})` | Prisma 4.7+ (2022) | Can pass IDs between operations, conditional logic inside tx |
| QueueScheduler for stalled job recovery | Built-in stalled job recovery in Worker | BullMQ 2.0+ | No separate scheduler needed |
| Manual `process.on('SIGTERM')` | NestJS `enableShutdownHooks()` + lifecycle interfaces | NestJS 7+ | Framework-managed, respects DI lifecycle |
| Per-module `onModuleDestroy` for shutdown | `onApplicationShutdown` for ordered teardown | NestJS 8+ | Fires after all `onModuleDestroy` hooks, connections already closing |

**Deprecated/outdated:**
- `QueueScheduler` from BullMQ v1 -- removed in v2+, stalled job detection is now built into Worker
- `app.enableShutdownHooks(['SIGINT', 'SIGTERM'])` with signal array -- current API takes no arguments; signals are handled automatically

## Open Questions

1. **OrderStatusService.changeStatus() Transaction Scope**
   - What we know: `orderRepo.updateStatus()` internally uses `$transaction` for the status update + history creation. The service method also calls `depositGate.shouldBlockTransition()` and `statusMachine.assertTransition()` which are read-only.
   - What's unclear: Whether the repo's internal transaction is sufficient or whether the entire `changeStatus()` method needs a broader transaction that includes the repo call + the event buffering.
   - Recommendation: The repo's internal tx is sufficient for write atomicity. Add deferred emit around the event calls at the service level. No need to double-wrap in a larger transaction unless the repo tx boundary needs to expand.

2. **OrderCompletionSaga Transaction Strategy**
   - What we know: The saga uses a compensate-on-failure pattern (SagaOrchestrator) with per-step compensations, not a single Prisma transaction. The `emitCompletionEvents` step emits after saga completes.
   - What's unclear: Whether the saga should be converted to a single interactive transaction or kept as a saga with compensation.
   - Recommendation: Keep the saga pattern. Converting to a single tx would require all steps to share a connection with a potentially long timeout. The saga's compensation approach is appropriate for multi-step workflows. Ensure the `emitCompletionEvents` step only fires if all previous steps succeeded (which it does -- saga stops on first failure).

3. **Worker Reference Discovery**
   - What we know: 7 processor classes extend `WorkerHost`. NestJS's `DiscoveryService` can find them.
   - What's unclear: Whether `WorkerHost.worker` property is reliably accessible for calling `.close()`.
   - Recommendation: Verify `WorkerHost.worker` access pattern during implementation. If not accessible, inject `Queue` instances directly and use `Queue.close()` instead.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest 29.4.6 |
| Config file | `jest.config.js` (unit), `test/jest-e2e.json` (e2e) |
| Quick run command | `npx jest --testPathPattern=src/ --passWithNoTests -x` |
| Full suite command | `npx jest --passWithNoTests` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DAT-01 | Multi-table writes are atomic (rollback on failure) | unit | `npx jest src/core/events/transactional-emitter.service.spec.ts -x` | Wave 0 |
| DAT-01 | adjustOrderItemQuantity uses transaction | unit | `npx jest src/modules/order/order-status.service.spec.ts -x` | Wave 0 |
| DAT-02 | Events only fire after transaction commits | unit | `npx jest src/core/events/transactional-emitter.service.spec.ts -x` | Wave 0 |
| DAT-02 | Events discarded on transaction rollback | unit | `npx jest src/core/events/transactional-emitter.service.spec.ts -x` | Wave 0 |
| DAT-06 | Graceful shutdown drains workers before Prisma disconnect | unit | `npx jest src/core/shutdown/graceful-shutdown.service.spec.ts -x` | Wave 0 |
| DAT-06 | Shutdown times out after 30s if workers stuck | unit | `npx jest src/core/shutdown/graceful-shutdown.service.spec.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern=src/ --passWithNoTests -x`
- **Per wave merge:** `npx jest --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/core/events/transactional-emitter.service.spec.ts` -- covers DAT-01, DAT-02 (collector create/emit/flush/discard)
- [ ] `src/core/shutdown/graceful-shutdown.service.spec.ts` -- covers DAT-06 (drain, timeout, order)
- [ ] No new framework install needed -- Jest already configured

## Sources

### Primary (HIGH confidence)
- Prisma Official Docs: [Transactions and batch queries](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) -- interactive transaction API, timeout defaults (maxWait: 2000ms, timeout: 5000ms), P2034 retry pattern
- BullMQ Official Docs: [Graceful Shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown) -- `worker.close()` API, no built-in timeout, stalled job recovery
- NestJS Official Docs: [Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events) -- `onModuleDestroy` -> `beforeApplicationShutdown` -> `onApplicationShutdown` order, signal parameter
- Codebase audit -- `PrismaService.executeInTransaction()` at `src/core/database/prisma.service.ts:199`, `EventPublisherService` at `src/core/events/event-publisher.service.ts`, `FailedJobCaptureService.onModuleDestroy()` at `src/core/queue/failed-job-capture.service.ts:68`

### Secondary (MEDIUM confidence)
- NestJS lifecycle hooks execution order verified via [NestJS GitHub docs](https://github.com/nestjs/docs.nestjs.com/blob/master/content/fundamentals/lifecycle-events.md)
- [NestJS graceful shutdown patterns](https://dev.to/hienngm/graceful-shutdown-in-nestjs-ensuring-smooth-application-termination-4e5n) -- community patterns for ordered shutdown

### Tertiary (LOW confidence)
- None -- all findings verified against official docs or codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already in project, versions verified against npm registry
- Architecture: HIGH -- patterns derived from official Prisma/BullMQ/NestJS docs + codebase audit of actual service methods
- Pitfalls: HIGH -- identified from direct code inspection showing events inside transactions and missing transaction wrappers

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable domain, no fast-moving dependencies)
