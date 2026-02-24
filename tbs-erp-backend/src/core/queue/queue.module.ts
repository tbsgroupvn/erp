import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventPublisherService } from '@core/events/event-publisher.service';
import { OrderEventProcessor } from '@core/events/processors/order-event.processor';
import { NotificationEventProcessor } from '@core/events/processors/notification-event.processor';
import { FinanceEventProcessor } from '@core/events/processors/finance-event.processor';
import { WarehouseEventProcessor } from '@core/events/processors/warehouse-event.processor';
import { OperationCostModule } from '@modules/operation-cost/operation-cost.module';

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
 *
 * Uses the existing Redis instance configured via REDIS_HOST / REDIS_PORT env vars.
 */
@Module({
  imports: [
    forwardRef(() => OperationCostModule),

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
        },
        defaultJobOptions: {
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
      }),
    }),

    // ─── Register Queues ───
    BullModule.registerQueue(
      { name: 'order-events' },
      { name: 'notification-events' },
      { name: 'finance-events' },
      { name: 'warehouse-events' },
      { name: 'integration-events' },
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
  ],
  exports: [
    BullModule,
    EventPublisherService,
  ],
})
export class QueueModule {}
