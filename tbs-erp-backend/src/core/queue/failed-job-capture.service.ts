import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents, Job } from 'bullmq';
import { PrismaService } from '@core/database/prisma.service';
import { ErrorCode } from '@common/exceptions';

/**
 * Captures BullMQ failed jobs to PostgreSQL dead_letter_events table
 * to prevent data loss when Redis auto-purges after 7 days.
 *
 * Listens for 'failed' events on all registered queues via QueueEvents
 * and persists the failure details to the DeadLetterEvent model.
 *
 * Structured payload includes errorCode and correlationId for integration
 * with DlqMonitorService and admin dashboards.
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
          let fullJob: Job | undefined;
          try {
            fullJob = await queue.getJob(jobId);
          } catch {
            // Job may have been removed; proceed without it
          }
          await this.captureFailedJob(name, jobId, failedReason, fullJob);
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
    job?: Job,
  ): Promise<void> {
    try {
      const correlationId = job?.data?.metadata?.correlationId || 'unknown';
      const errorCode = this.extractErrorCode(failedReason);

      await this.prisma.deadLetterEvent.create({
        data: {
          event: `bullmq:${queueName}:${jobId}`,
          payload: {
            queueName,
            jobId,
            failedReason,
            errorCode,
            correlationId,
            eventType: job?.data?.type || job?.name || 'unknown',
            attemptsMade: job?.attemptsMade || 0,
          } as any,
          error: (failedReason || 'Unknown error').substring(0, 2000),
          source: `bullmq_${queueName}`,
        },
      });

      this.logger.warn(
        `Captured failed BullMQ job: queue=${queueName}, jobId=${jobId}, ` +
          `errorCode=${errorCode}, correlationId=${correlationId}, ` +
          `reason=${failedReason?.substring(0, 100)}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to capture BullMQ job to DLQ: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Extract a structured errorCode from the failure reason string.
   *
   * Attempts to parse as JSON first (for structured error messages),
   * then checks for known ErrorCode strings in the text,
   * and falls back to JOB_PROCESSING_FAILED.
   */
  private extractErrorCode(failedReason: string): string {
    if (!failedReason) {
      return ErrorCode.JOB_PROCESSING_FAILED;
    }

    // Try JSON parse (logProcessorError may have written JSON)
    try {
      const parsed = JSON.parse(failedReason);
      if (parsed?.errorCode) {
        return parsed.errorCode;
      }
    } catch {
      // Not JSON, continue with string matching
    }

    // Check for known ErrorCode values in the failure reason
    const knownCodes = Object.values(ErrorCode);
    for (const code of knownCodes) {
      if (failedReason.includes(code)) {
        return code;
      }
    }

    return ErrorCode.JOB_PROCESSING_FAILED;
  }
}
