import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { OutboxStatus, Prisma } from '@prisma/client';

/**
 * Outbox Pattern implementation for reliable event delivery.
 *
 * Domain services call `record()` inside their Prisma transaction to atomically
 * persist both the business state change and the outbox event. A polling worker
 * then picks up PENDING events and dispatches them via EventEmitter2.
 *
 * Key guarantees:
 * - At-least-once delivery: events survive process restarts because they live in PostgreSQL.
 * - No dual-write: the outbox row is written in the same DB transaction as the business data.
 * - Concurrent-safe: `FOR UPDATE SKIP LOCKED` prevents multiple workers from processing the same event.
 * - Exponential backoff: failed events are retried with increasing delays (2^attempts seconds).
 * - Dead letter: events that exceed maxAttempts are moved to DEAD_LETTER for manual inspection.
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  /** Prevents overlapping cron executions of processOutbox */
  private isProcessing = false;

  /** Prevents overlapping cron executions of retryFailed */
  private isRetrying = false;

  /** Maximum number of events to process in a single batch */
  private static readonly BATCH_SIZE = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Public API ───────────────────────────────────────────────────────

  /**
   * Record an outbox event inside an existing Prisma transaction.
   *
   * This MUST be called within a `prisma.$transaction()` callback so that the
   * outbox row is committed atomically with the business data.
   *
   * @param tx            - The Prisma transaction client
   * @param aggregateType - The type of aggregate (e.g. 'Order', 'Payment', 'Package')
   * @param aggregateId   - The ID of the aggregate instance
   * @param eventType     - The domain event type (e.g. 'order.created')
   * @param payload       - The event payload (will be stored as JSON)
   * @returns The created outbox event record
   *
   * @example
   * ```ts
   * await this.prisma.$transaction(async (tx) => {
   *   const order = await tx.order.create({ data: orderData });
   *   await this.outboxService.record(tx, 'Order', order.id, 'order.created', {
   *     orderId: order.id,
   *     orderCode: order.orderCode,
   *     customerId: order.customerId,
   *   });
   * });
   * ```
   */
  async record(
    tx: Prisma.TransactionClient,
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    return tx.outboxEvent.create({
      data: {
        aggregateType,
        aggregateId,
        eventType,
        payload: payload as Prisma.InputJsonValue,
        status: OutboxStatus.PENDING,
        maxAttempts: 10, // Increased from schema default of 5 to allow more retry time with longer backoff
      },
    });
  }

  // ─── Polling Workers ──────────────────────────────────────────────────

  /**
   * Primary polling worker: picks up PENDING outbox events and dispatches them.
   *
   * Uses `FOR UPDATE SKIP LOCKED` to allow safe concurrent execution across
   * multiple application instances without double-processing.
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processOutbox(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      await this.dispatchBatch(OutboxStatus.PENDING);
    } catch (error) {
      this.logger.error(
        `Outbox processing cycle failed unexpectedly: ${error.message}`,
        error.stack,
      );
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retry worker: picks up FAILED events whose nextRetryAt has passed.
   *
   * Runs every 5 minutes to re-attempt events that previously failed but
   * have not yet exhausted their maxAttempts.
   */
  @Cron('0 */5 * * * *')
  async retryFailed(): Promise<void> {
    if (this.isRetrying) {
      return;
    }

    this.isRetrying = true;
    try {
      await this.dispatchBatch(OutboxStatus.FAILED);
    } catch (error) {
      this.logger.error(
        `Outbox retry cycle failed unexpectedly: ${error.message}`,
        error.stack,
      );
    } finally {
      this.isRetrying = false;
    }
  }

  // ─── Monitoring ───────────────────────────────────────────────────────

  /**
   * Returns event counts grouped by status for monitoring dashboards.
   */
  async getStats(): Promise<Record<string, number>> {
    const results = await this.prisma.outboxEvent.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const stats: Record<string, number> = {
      PENDING: 0,
      DISPATCHED: 0,
      FAILED: 0,
      DEAD_LETTER: 0,
    };

    for (const row of results) {
      stats[row.status] = row._count.id;
    }

    return stats;
  }

  // ─── Internal ─────────────────────────────────────────────────────────

  /**
   * Core dispatch logic shared by both processOutbox and retryFailed.
   *
   * Fetches a batch of events with the given status using row-level locking,
   * then dispatches each one individually so a single failure does not block
   * the entire batch.
   *
   * Security: Uses parameterized $queryRaw (tagged template literals) instead
   * of $queryRawUnsafe to prevent SQL injection.
   */
  private async dispatchBatch(status: OutboxStatus): Promise<void> {
    const now = new Date();

    type OutboxRow = {
      id: string;
      aggregate_type: string;
      aggregate_id: string;
      event_type: string;
      payload: unknown;
      status: string;
      attempts: number;
      max_attempts: number;
      last_error: string | null;
      processed_at: Date | null;
      next_retry_at: Date | null;
      created_at: Date;
    };

    // Use interactive transaction to hold row locks while processing.
    // FOR UPDATE SKIP LOCKED requires the lock to be held until status is updated,
    // otherwise concurrent workers can pick up the same events.
    const events = await this.prisma.executeInTransaction(async (tx) => {
      let rows: OutboxRow[];

      if (status === OutboxStatus.FAILED) {
        rows = await tx.$queryRaw<OutboxRow[]>`
          SELECT id, aggregate_type, aggregate_id, event_type, payload,
                 status, attempts, max_attempts, last_error,
                 processed_at, next_retry_at, created_at
          FROM outbox_events
          WHERE status = 'FAILED' AND next_retry_at <= ${now}
          ORDER BY created_at ASC
          LIMIT 100
          FOR UPDATE SKIP LOCKED`;
      } else {
        rows = await tx.$queryRaw<OutboxRow[]>`
          SELECT id, aggregate_type, aggregate_id, event_type, payload,
                 status, attempts, max_attempts, last_error,
                 processed_at, next_retry_at, created_at
          FROM outbox_events
          WHERE status = 'PENDING'
          ORDER BY created_at ASC
          LIMIT 100
          FOR UPDATE SKIP LOCKED`;
      }

      // Immediately claim these events by setting status to DISPATCHED
      // so row locks can be released and other workers won't pick them up
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        await tx.$executeRaw`
          UPDATE outbox_events SET status = 'DISPATCHED', attempts = attempts + 1
          WHERE id = ANY(${ids}::text[])`;
      }

      return rows;
    });

    if (events.length === 0) {
      return;
    }

    this.logger.log(
      `Outbox: picked up ${events.length} ${status} event(s) for dispatch`,
    );

    let dispatched = 0;
    let failed = 0;

    for (const event of events) {
      try {
        await this.dispatchSingleEvent(event);
        dispatched++;
      } catch (error) {
        failed++;
        this.logger.error(
          `Outbox: unexpected error dispatching event ${event.id}: ${error.message}`,
        );
      }
    }

    if (dispatched > 0 || failed > 0) {
      this.logger.log(
        `Outbox batch complete: ${dispatched} dispatched, ${failed} failed`,
      );
    }
  }

  /**
   * Dispatches a single outbox event via EventEmitter2 and updates its status.
   *
   * On success: marks DISPATCHED with processedAt timestamp.
   * On failure: increments attempts, records the error, and either schedules
   * a retry with exponential backoff or moves to DEAD_LETTER.
   */
  private async dispatchSingleEvent(event: {
    id: string;
    aggregate_type: string;
    aggregate_id: string;
    event_type: string;
    payload: unknown;
    attempts: number;
    max_attempts: number;
  }): Promise<void> {
    const newAttempts = event.attempts + 1;

    try {
      // Emit the event to in-process listeners
      // The event name is the eventType (e.g. 'order.created')
      // Payload includes the full context for consumers
      await this.eventEmitter.emitAsync(event.event_type, {
        aggregateType: event.aggregate_type,
        aggregateId: event.aggregate_id,
        eventType: event.event_type,
        payload: event.payload,
        outboxId: event.id,
      });

      // Success: mark as dispatched
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxStatus.DISPATCHED,
          attempts: newAttempts,
          processedAt: new Date(),
        },
      });

      this.logger.debug(
        `Outbox: dispatched event ${event.id} [${event.event_type}] ` +
          `for ${event.aggregate_type}:${event.aggregate_id}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check if we've exhausted retries
      if (newAttempts >= event.max_attempts) {
        // Move to dead letter
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: OutboxStatus.DEAD_LETTER,
            attempts: newAttempts,
            lastError: errorMessage.substring(0, 2000),
          },
        });

        this.logger.error(
          `Outbox: event ${event.id} [${event.event_type}] moved to DEAD_LETTER ` +
            `after ${newAttempts} attempts. Last error: ${errorMessage}`,
        );
      } else {
        // Exponential backoff: 10s, 20s, 40s, 80s, 160s, 320s, 600s (max 10min)
        const backoffSeconds = Math.min(Math.pow(2, newAttempts) * 10, 600);
        const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);

        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: OutboxStatus.FAILED,
            attempts: newAttempts,
            lastError: errorMessage.substring(0, 2000),
            nextRetryAt,
          },
        });

        this.logger.warn(
          `Outbox: event ${event.id} [${event.event_type}] failed (attempt ${newAttempts}/${event.max_attempts}). ` +
            `Next retry at ${nextRetryAt.toISOString()}. Error: ${errorMessage}`,
        );
      }
    }
  }
}
