import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { DomainEvent, DomainEventType } from './domain-events';
import { PrismaService } from '@core/database/prisma.service';
import { OutboxStatus, Prisma } from '@prisma/client';

/**
 * Central event publisher that routes domain events to the appropriate BullMQ queue.
 *
 * Features:
 * - Automatic queue routing based on event type namespace
 * - Retry policy with exponential backoff (3 attempts)
 * - Job retention: 24h for completed, 7 days for failed
 * - Correlation ID generation for distributed tracing
 */
@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(
    @InjectQueue('order-events') private readonly orderQueue: Queue,
    @InjectQueue('notification-events') private readonly notificationQueue: Queue,
    @InjectQueue('finance-events') private readonly financeQueue: Queue,
    @InjectQueue('warehouse-events') private readonly warehouseQueue: Queue,
    @InjectQueue('integration-events') private readonly integrationQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Publish a domain event to the appropriate BullMQ queue.
   *
   * @param event - The domain event to publish
   * @returns The BullMQ job ID for tracking
   */
  async publish<T>(event: DomainEvent<T>): Promise<string> {
    // Ensure metadata has a correlation ID
    if (!event.metadata.correlationId) {
      event.metadata.correlationId = uuidv4();
    }

    // Ensure timestamp
    if (!event.metadata.timestamp) {
      event.metadata.timestamp = new Date();
    }

    const queue = this.getQueue(event.type);
    const queueName = this.getQueueName(event.type);

    this.logger.log(
      `Publishing event ${event.type} to queue [${queueName}] ` +
        `(correlationId: ${event.metadata.correlationId}, ` +
        `aggregateId: ${event.metadata.aggregateId ?? 'N/A'})`,
    );

    try {
      const job = await queue.add(event.type, event, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000, // 1s, 2s, 4s
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 1000, // Keep at most 1000 completed jobs
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
        // Use correlation ID as job ID prefix for easier debugging
        jobId: `${event.type}-${event.metadata.correlationId}`,
      });

      return job.id ?? event.metadata.correlationId;
    } catch (queueError) {
      // BullMQ/Redis unavailable - fall back to Outbox pattern (DB-backed)
      this.logger.warn(
        `BullMQ queue [${queueName}] unavailable, falling back to Outbox: ${queueError.message}`,
      );

      try {
        await this.prisma.outboxEvent.create({
          data: {
            aggregateType: event.type.split('.')[0],
            aggregateId:
              event.metadata.aggregateId ?? event.metadata.correlationId,
            eventType: event.type,
            payload: event as unknown as Prisma.InputJsonValue,
            status: OutboxStatus.PENDING,
            maxAttempts: 10,
          },
        });

        this.logger.log(
          `Event ${event.type} saved to Outbox (correlationId: ${event.metadata.correlationId})`,
        );
      } catch (dbError) {
        // Both Redis and DB are unavailable - log CRITICAL but do NOT throw
        // so the calling service does not crash
        this.logger.error(
          `CRITICAL: Failed to publish event ${event.type} via both BullMQ and Outbox. ` +
            `Queue error: ${queueError.message}. DB error: ${dbError.message}`,
          dbError.stack,
        );
      }

      return event.metadata.correlationId;
    }
  }

  /**
   * Convenience method: publish an event with auto-generated metadata.
   *
   * @param requestId - Optional request ID from HTTP context for end-to-end correlation.
   *                     When provided, used as the correlationId instead of generating a new UUID.
   */
  async emit<T>(
    type: DomainEventType,
    payload: T,
    userId: string,
    source: string,
    aggregateId?: string,
    requestId?: string,
  ): Promise<string> {
    const event: DomainEvent<T> = {
      type,
      payload,
      metadata: {
        userId,
        timestamp: new Date(),
        correlationId: requestId || uuidv4(),
        source,
        aggregateId,
      },
    };
    return this.publish(event);
  }

  /**
   * Route an event type to its corresponding BullMQ queue.
   */
  private getQueue(eventType: DomainEventType): Queue {
    const prefix = eventType.split('.')[0];
    switch (prefix) {
      case 'order':
        return this.orderQueue;
      case 'finance':
        return this.financeQueue;
      case 'warehouse':
        return this.warehouseQueue;
      case 'notification':
        return this.notificationQueue;
      case 'approval':
        return this.notificationQueue; // Approvals route to notification queue
      case 'crm':
        return this.integrationQueue; // CRM events route to integration queue
      default:
        return this.integrationQueue;
    }
  }

  private getQueueName(eventType: DomainEventType): string {
    const prefix = eventType.split('.')[0];
    switch (prefix) {
      case 'order':
        return 'order-events';
      case 'finance':
        return 'finance-events';
      case 'warehouse':
        return 'warehouse-events';
      case 'notification':
        return 'notification-events';
      case 'approval':
        return 'notification-events';
      case 'crm':
        return 'integration-events';
      default:
        return 'integration-events';
    }
  }
}
