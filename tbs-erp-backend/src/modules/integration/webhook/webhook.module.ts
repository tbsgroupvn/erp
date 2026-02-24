import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookRetryService } from './webhook-retry.service';

/**
 * Webhook Module — Manages webhook endpoint subscriptions and reliable
 * event delivery with exponential backoff retry.
 *
 * Provides:
 *   - WebhookRetryService: Dispatch events, retry failed deliveries
 *   - WebhookController: CRUD for webhook endpoints + delivery history
 *
 * Dependencies:
 *   - PrismaService (global) — WebhookEndpoint, WebhookDelivery models
 *   - MetricsService (global) — Prometheus metrics for deliveries
 *   - ScheduleModule — Cron for retry processing
 */
@Module({
  controllers: [WebhookController],
  providers: [WebhookRetryService],
  exports: [WebhookRetryService],
})
export class WebhookModule {}
