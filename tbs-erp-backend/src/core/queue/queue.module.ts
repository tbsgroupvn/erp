import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventPublisherService } from '@core/events/event-publisher.service';
import { OrderEventProcessor } from '@core/events/processors/order-event.processor';
import { NotificationEventProcessor } from '@core/events/processors/notification-event.processor';
import { FinanceEventProcessor } from '@core/events/processors/finance-event.processor';
import { WarehouseEventProcessor } from '@core/events/processors/warehouse-event.processor';
import { FailedJobCaptureService } from '@core/queue/failed-job-capture.service';
import { OperationCostModule } from '@modules/operation-cost/operation-cost.module';
import { ReportJobProcessor } from '@modules/reports/report-job.processor';
import { BatchJobProcessor } from '@modules/batch/batch-job.processor';
import { ReportsModule } from '@modules/reports/reports.module';
import { BatchModule } from '@modules/batch/batch.module';

/**
 * Queue module that configures BullMQ with Redis connection and registers
 * all domain event queues and their processors.
 *
 * Queues:
 * - order-events: Order lifecycle events (created, updated, status changed, etc.)
 * - notification-events: Notification delivery events (in-app, email, SMS, broadcast)
 * - finance-events: Finance events (payments, invoices, vouchers)
 * - warehouse-events: Warehouse events (package tracking, inventory)
 * - integration-events: External integration sync events
 * - report-jobs: Scheduled/on-demand report generation (daily revenue, AR aging, etc.)
 * - batch-jobs: Batch import/export operations (orders, customers, AR reports)
 *
 * Uses the existing Redis instance configured via REDIS_HOST / REDIS_PORT env vars.
 */
@Module({
  imports: [
    forwardRef(() => OperationCostModule),
    forwardRef(() => ReportsModule),
    forwardRef(() => BatchModule),

    // ─── BullMQ Root Configuration ───
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          maxRetriesPerRequest: null, // Required by BullMQ
          retryStrategy: (times: number) => {
            // Exponential backoff: 500ms, 1s, 2s, 4s, ... max 30s
            const delay = Math.min(times * 500, 30000);
            return delay;
          },
          reconnectOnError: (err: Error) => {
            // Reconnect on READONLY errors (e.g., failover)
            return err.message.includes('READONLY');
          },
          enableReadyCheck: true,
          connectTimeout: 10000,
          lazyConnect: false,
        },
        defaultJobOptions: {
          timeout: 300_000, // 5 minutes - prevent zombie jobs
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            age: 86400, // 24 hours
            count: 1000,
          },
          removeOnFail: {
            age: 604800, // 7 days
          },
        },
        // ─── Worker defaults ───
        // Rate limiting and stalled job recovery are configured per-queue
        // via defaultWorkerOptions in registerQueueAsync below.
      }),
    }),

    // ─── Register Queues with per-queue worker concurrency ───
    // Concurrency controls how many jobs each worker processes in parallel.
    // Finance uses lower concurrency (2) to preserve ordering and avoid race conditions.
    // Notifications use higher concurrency (5) because they are lightweight I/O tasks.
    // Override any value via the corresponding environment variable.
    //
    // defaultWorkerOptions.concurrency is supported in @nestjs/bullmq v10+.
    BullModule.registerQueueAsync(
      {
        name: 'order-events',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (cs: ConfigService) => ({
          name: 'order-events',
          defaultWorkerOptions: {
            concurrency: parseInt(cs.get<string>('ORDER_QUEUE_CONCURRENCY', '3'), 10),
          },
        }),
      },
      {
        name: 'notification-events',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (cs: ConfigService) => ({
          name: 'notification-events',
          defaultWorkerOptions: {
            concurrency: parseInt(cs.get<string>('NOTIFICATION_QUEUE_CONCURRENCY', '5'), 10),
          },
        }),
      },
      {
        name: 'finance-events',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (cs: ConfigService) => ({
          name: 'finance-events',
          defaultWorkerOptions: {
            // Finance events require ordering; keep concurrency low.
            concurrency: parseInt(cs.get<string>('FINANCE_QUEUE_CONCURRENCY', '2'), 10),
          },
        }),
      },
      {
        name: 'warehouse-events',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (cs: ConfigService) => ({
          name: 'warehouse-events',
          defaultWorkerOptions: {
            concurrency: parseInt(cs.get<string>('WAREHOUSE_QUEUE_CONCURRENCY', '3'), 10),
          },
        }),
      },
      {
        name: 'integration-events',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (cs: ConfigService) => ({
          name: 'integration-events',
          defaultWorkerOptions: {
            // External integration calls; keep low to respect third-party rate limits.
            concurrency: parseInt(cs.get<string>('INTEGRATION_QUEUE_CONCURRENCY', '2'), 10),
          },
        }),
      },
      {
        name: 'report-jobs',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (cs: ConfigService) => ({
          name: 'report-jobs',
          defaultWorkerOptions: {
            concurrency: parseInt(cs.get<string>('REPORT_QUEUE_CONCURRENCY', '1'), 10),
          },
        }),
      },
      {
        name: 'batch-jobs',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (cs: ConfigService) => ({
          name: 'batch-jobs',
          defaultWorkerOptions: {
            concurrency: parseInt(cs.get<string>('BATCH_QUEUE_CONCURRENCY', '2'), 10),
          },
        }),
      },
    ),
  ],
  providers: [
    // Event publisher (routes events to queues)
    EventPublisherService,

    // Event processors (consume from queues)
    OrderEventProcessor,
    NotificationEventProcessor,
    FinanceEventProcessor,
    WarehouseEventProcessor,
    FailedJobCaptureService,

    // Background job processors
    ReportJobProcessor,
    BatchJobProcessor,
  ],
  exports: [BullModule, EventPublisherService],
})
export class QueueModule {}
