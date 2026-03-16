import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';

/**
 * Persistent Dead Letter Queue backed by the DeadLetterEvent table.
 *
 * Replaces the in-memory DLQ that would lose events on process restart.
 */
@Injectable()
export class DeadLetterQueueService {
  private readonly logger = new Logger(DeadLetterQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Persist a failed event to the dead_letter_events table.
   */
  async addToDeadLetterQueue(
    event: string,
    payload: unknown,
    error: string,
    source: string = 'event_bus',
  ): Promise<void> {
    try {
      await this.prisma.deadLetterEvent.create({
        data: {
          event,
          payload: payload as any,
          error,
          source,
        },
      });
      this.logger.warn(`Event persisted to DLQ: ${event} (source: ${source})`);
    } catch (err) {
      // Last-resort fallback: log to stdout so it's captured by log aggregator
      // Truncate payload to prevent excessive logging of potentially sensitive data
      const truncatedPayload = JSON.stringify(payload).substring(0, 500);
      this.logger.error(
        `CRITICAL: Failed to persist DLQ entry for "${event}": ${err.message}`,
        `event=${event}, payload=${truncatedPayload}..., error=${String(error).substring(0, 200)}`,
      );
    }
  }

  /**
   * Get unresolved dead letter entries with pagination.
   */
  async getUnresolved(skip = 0, take = 50) {
    return this.prisma.deadLetterEvent.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  /**
   * Retry a dead letter event by ID. Marks it as resolved on success.
   */
  async resolve(id: string, resolvedBy: string): Promise<void> {
    await this.prisma.deadLetterEvent.update({
      where: { id },
      data: { resolvedAt: new Date(), resolvedBy },
    });
  }

  /**
   * Get DLQ stats for monitoring dashboard.
   */
  async getStats() {
    const [total, unresolved] = await this.prisma.$transaction([
      this.prisma.deadLetterEvent.count(),
      this.prisma.deadLetterEvent.count({ where: { resolvedAt: null } }),
    ]);
    return { total, unresolved, resolved: total - unresolved };
  }

  /**
   * Replay a dead letter event by re-emitting it through EventEmitter2.
   * On success, marks the event as resolved.
   * On failure, increments retryCount and updates error.
   */
  async replay(
    id: string,
    triggeredBy: string,
  ): Promise<{ success: boolean; error?: string }> {
    const event = await this.prisma.deadLetterEvent.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException(`Dead letter event ${id} not found`);
    }

    if (event.resolvedAt) {
      return { success: true }; // Already resolved
    }

    try {
      // Re-emit the event through EventEmitter2
      await this.eventEmitter.emitAsync(event.event, event.payload);

      // Mark as resolved on success
      await this.prisma.deadLetterEvent.update({
        where: { id },
        data: {
          resolvedAt: new Date(),
          resolvedBy: triggeredBy,
          retryCount: { increment: 1 },
        },
      });

      this.logger.log(`DLQ event ${id} [${event.event}] replayed successfully by ${triggeredBy}`);
      return { success: true };
    } catch (error) {
      // Update retry count and error message
      await this.prisma.deadLetterEvent.update({
        where: { id },
        data: {
          retryCount: { increment: 1 },
          error: error.message?.substring(0, 2000),
        },
      });

      this.logger.error(
        `DLQ event ${id} [${event.event}] replay failed: ${error.message}`,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Replay all unresolved dead letter events from a specific source.
   * Processes up to 100 events at a time, ordered by creation date (oldest first).
   */
  async replayAll(
    source: string,
    triggeredBy: string,
  ): Promise<{ total: number; success: number; failed: number }> {
    const events = await this.prisma.deadLetterEvent.findMany({
      where: { source, resolvedAt: null },
      take: 100,
      orderBy: { createdAt: 'asc' },
    });

    let success = 0;
    let failed = 0;

    for (const event of events) {
      const result = await this.replay(event.id, triggeredBy);
      if (result.success) success++;
      else failed++;
    }

    this.logger.log(
      `DLQ replayAll for source="${source}": total=${events.length}, success=${success}, failed=${failed}`,
    );

    return { total: events.length, success, failed };
  }
}
