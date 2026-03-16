import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Monitors Dead Letter Queues and alerts administrators when
 * failed events accumulate beyond threshold.
 *
 * Checks three DLQ sources every 5 minutes:
 * 1. DeadLetterEvent table (event_bus failures)
 * 2. OutboxEvent table (DEAD_LETTER status)
 * 3. WebhookDelivery table (dead_letter status)
 */
@Injectable()
export class DlqMonitorService {
  private readonly logger = new Logger(DlqMonitorService.name);

  /** Threshold for triggering alerts */
  private static readonly ALERT_THRESHOLD = 5;

  /** Prevent alert flooding - track last alert time per source */
  private readonly lastAlertTimes = new Map<string, Date>();

  /** Minimum interval between alerts for same source (1 hour) */
  private static readonly ALERT_COOLDOWN_MS = 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Check DLQ every 5 minutes for accumulated failures.
   */
  @Cron('0 */5 * * * *')
  async checkDlqHealth(): Promise<void> {
    try {
      await this.checkDeadLetterEvents();
      await this.checkOutboxDeadLetters();
      await this.checkWebhookDeadLetters();
    } catch (error) {
      this.logger.error(
        `DLQ health check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async checkDeadLetterEvents(): Promise<void> {
    const count = await this.prisma.deadLetterEvent.count({
      where: { resolvedAt: null },
    });

    if (count >= DlqMonitorService.ALERT_THRESHOLD) {
      await this.sendAlert(
        'dead_letter_events',
        count,
        `${count} unresolved dead letter events detected`,
      );
    }
  }

  private async checkOutboxDeadLetters(): Promise<void> {
    const count = await this.prisma.outboxEvent.count({
      where: { status: 'DEAD_LETTER' },
    });

    if (count >= DlqMonitorService.ALERT_THRESHOLD) {
      await this.sendAlert(
        'outbox_dead_letter',
        count,
        `${count} outbox events in DEAD_LETTER state`,
      );
    }
  }

  private async checkWebhookDeadLetters(): Promise<void> {
    const count = await this.prisma.webhookDelivery.count({
      where: { status: 'dead_letter' },
    });

    if (count >= DlqMonitorService.ALERT_THRESHOLD) {
      await this.sendAlert(
        'webhook_dead_letter',
        count,
        `${count} webhook deliveries in dead_letter state`,
      );
    }
  }

  private async sendAlert(
    source: string,
    count: number,
    message: string,
  ): Promise<void> {
    // Check cooldown
    const lastAlert = this.lastAlertTimes.get(source);
    if (
      lastAlert &&
      Date.now() - lastAlert.getTime() < DlqMonitorService.ALERT_COOLDOWN_MS
    ) {
      return; // Still in cooldown
    }

    this.lastAlertTimes.set(source, new Date());

    this.logger.warn(`DLQ ALERT [${source}]: ${message}`);

    // Emit event for notification system to pick up
    this.eventEmitter.emit('dlq.alert', {
      source,
      count,
      message,
      timestamp: new Date(),
      severity:
        count >= DlqMonitorService.ALERT_THRESHOLD * 3
          ? 'CRITICAL'
          : 'WARNING',
    });
  }
}
