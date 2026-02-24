import { Module, MiddlewareConsumer, NestModule, Logger } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

/**
 * Bull Board module that provides a web-based admin UI for monitoring
 * BullMQ queues at /admin/queues.
 *
 * Features:
 * - View job status across all queues (waiting, active, completed, failed)
 * - Inspect individual job data and error stack traces
 * - Retry failed jobs manually
 * - Clean completed/failed jobs
 *
 * Access is controlled at the reverse proxy / middleware level.
 * In production, only CEO/COO roles should be able to access /admin/queues.
 */
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'order-events' },
      { name: 'notification-events' },
      { name: 'finance-events' },
      { name: 'warehouse-events' },
      { name: 'integration-events' },
    ),
  ],
})
export class BullBoardModule implements NestModule {
  private readonly logger = new Logger(BullBoardModule.name);

  constructor(
    @InjectQueue('order-events') private readonly orderQueue: Queue,
    @InjectQueue('notification-events') private readonly notificationQueue: Queue,
    @InjectQueue('finance-events') private readonly financeQueue: Queue,
    @InjectQueue('warehouse-events') private readonly warehouseQueue: Queue,
    @InjectQueue('integration-events') private readonly integrationQueue: Queue,
  ) { }

  configure(consumer: MiddlewareConsumer) {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [
        new BullMQAdapter(this.orderQueue) as any,
        new BullMQAdapter(this.notificationQueue) as any,
        new BullMQAdapter(this.financeQueue) as any,
        new BullMQAdapter(this.warehouseQueue) as any,
        new BullMQAdapter(this.integrationQueue) as any,
      ],
      serverAdapter,
    });

    this.logger.log('Bull Board admin UI mounted at /admin/queues');

    consumer
      .apply(serverAdapter.getRouter())
      .forRoutes('/admin/queues');
  }
}
