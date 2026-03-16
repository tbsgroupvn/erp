import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { PrismaService } from '@core/database/prisma.service';

/**
 * Captures BullMQ failed jobs to PostgreSQL dead_letter_events table
 * to prevent data loss when Redis auto-purges after 7 days.
 *
 * Listens for 'failed' events on all registered queues via QueueEvents
 * and persists the failure details to the DeadLetterEvent model.
 */
@Injectable()
export class FailedJobCaptureService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FailedJobCaptureService.name);
  private readonly queueEventInstances: QueueEvents[] = [];

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('finance-events') private readonly financeQueue: Queue,
    @InjectQueue('order-events') private readonly orderQueue: Queue,
    @InjectQueue('warehouse-events') private readonly warehouseQueue: Queue,
    @InjectQueue('notification-events')
    private readonly notificationQueue: Queue,
    @InjectQueue('integration-events')
    private readonly integrationQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    const queues = [
      { name: 'finance-events', queue: this.financeQueue },
      { name: 'order-events', queue: this.orderQueue },
      { name: 'warehouse-events', queue: this.warehouseQueue },
      { name: 'notification-events', queue: this.notificationQueue },
      { name: 'integration-events', queue: this.integrationQueue },
    ];

    for (const { name, queue } of queues) {
      try {
        const queueEvents = new QueueEvents(name, {
          connection: (queue as any).opts?.connection,
        });

        queueEvents.on('failed', async ({ jobId, failedReason }) => {
          await this.captureFailedJob(name, jobId, failedReason);
        });

        this.queueEventInstances.push(queueEvents);
        this.logger.log(`Listening for failed jobs on queue: ${name}`);
      } catch (error) {
        this.logger.error(
          `Failed to setup listener for queue ${name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const queueEvents of this.queueEventInstances) {
      try {
        await queueEvents.close();
      } catch {
        // Ignore close errors during shutdown
      }
    }
  }

  private async captureFailedJob(
    queueName: string,
    jobId: string,
    failedReason: string,
  ): Promise<void> {
    try {
      await this.prisma.deadLetterEvent.create({
        data: {
          event: `bullmq:${queueName}:${jobId}`,
          payload: { queueName, jobId, failedReason } as any,
          error: (failedReason || 'Unknown error').substring(0, 2000),
          source: `bullmq_${queueName}`,
        },
      });

      this.logger.warn(
        `Captured failed BullMQ job: queue=${queueName}, jobId=${jobId}, reason=${failedReason?.substring(0, 100)}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to capture BullMQ job to DLQ: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
