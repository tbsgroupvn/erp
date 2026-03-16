import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from './notification.service';
import { AccountStatus, ComplaintStatus, OrderStatus } from '@prisma/client';
import { businessHoursBetween } from '@common/utils/business-hours';

/**
 * Escalation condition types supported by the EscalationRule model.
 */
type EscalationEventType = 'OVERDUE_AR' | 'COMPLAINT_UNRESOLVED' | 'ORDER_STUCK';

interface EscalationCheckResult {
  ruleId: string;
  ruleName: string;
  eventType: string;
  count: number;
  thresholdValue: number;
  recipientRole: string;
}

/**
 * Escalation Service (BGD-4).
 *
 * Runs every hour to evaluate active EscalationRule records. For each rule
 * the service checks the corresponding business condition (overdue AR,
 * unresolved complaints, or stuck orders) and when the threshold is
 * exceeded sends a notification to the configured recipient role.
 */
@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Cron: Every hour on the hour.
   * Fetches all active escalation rules and evaluates each condition.
   */
  @Cron('0 * * * *')
  async runEscalationChecks(): Promise<void> {
    this.logger.log('Starting escalation rule checks...');

    try {
      const rules = await this.prisma.escalationRule.findMany({
        where: { isActive: true },
      });

      if (rules.length === 0) {
        this.logger.debug('No active escalation rules found');
        return;
      }

      let escalationsTriggered = 0;

      for (const rule of rules) {
        try {
          const result = await this.evaluateRule(rule);

          if (result && result.count > 0) {
            await this.sendEscalationNotification(result);
            escalationsTriggered++;
          }
        } catch (ruleError) {
          this.logger.error(
            `Failed to evaluate escalation rule ${rule.id} (${rule.eventType}): ${ruleError.message}`,
          );
        }
      }

      this.logger.log(
        `Escalation checks completed: ${escalationsTriggered} escalation(s) triggered from ${rules.length} rules`,
      );
    } catch (error) {
      this.logger.error(`Escalation check failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Evaluate a single escalation rule and return the result if the
   * threshold is exceeded, or null otherwise.
   */
  private async evaluateRule(rule: {
    id: string;
    name: string | null;
    eventType: string;
    thresholdValue: number;
    thresholdUnit: string;
    recipientRole: string;
  }): Promise<EscalationCheckResult | null> {
    const eventType = rule.eventType as EscalationEventType;

    let count = 0;

    switch (eventType) {
      case 'OVERDUE_AR':
        count = await this.countOverdueAR(rule.thresholdValue);
        break;

      case 'COMPLAINT_UNRESOLVED':
        count = await this.countUnresolvedComplaints(rule.thresholdValue);
        break;

      case 'ORDER_STUCK':
        count = await this.countStuckOrders(rule.thresholdValue);
        break;

      default:
        this.logger.warn(`Unknown escalation event type: ${rule.eventType} (rule ${rule.id})`);
        return null;
    }

    if (count === 0) {
      return null;
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name ?? rule.eventType,
      eventType: rule.eventType,
      count,
      thresholdValue: rule.thresholdValue,
      recipientRole: rule.recipientRole,
    };
  }

  /**
   * Compute a business-hours-aware cutoff date. When useBusinessHours is
   * enabled, the threshold in days is converted to business hours and the
   * cutoff is determined using businessHoursBetween so that only actual
   * working time is counted. Falls back to simple calendar-day subtraction
   * when the feature is disabled.
   */
  private getBusinessDayCutoff(thresholdDays: number): Date {
    const useBusinessHours = this.configService.get<boolean>(
      'business.overdraft.useBusinessHours',
      false,
    );

    if (!useBusinessHours) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - thresholdDays);
      return cutoff;
    }

    const businessHoursConfig = this.configService.get('business.businessHours');
    const workHoursPerDay =
      (businessHoursConfig?.workEnd ?? 17) - (businessHoursConfig?.workStart ?? 8);
    const targetBusinessHours = thresholdDays * workHoursPerDay;

    // Walk backward from now to find the date where businessHoursBetween
    // equals the target threshold. Start with a generous calendar estimate.
    const now = new Date();
    let candidateDays = thresholdDays;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() - candidateDays);

      const elapsed = businessHoursBetween(candidate, now, businessHoursConfig);
      if (elapsed >= targetBusinessHours) {
        return candidate;
      }
      // Expand the search window by one day
      candidateDays++;

      // Safety cap to avoid infinite loops (e.g. 4x the threshold)
      if (candidateDays > thresholdDays * 4) {
        return candidate;
      }
    }
  }

  /**
   * Count AccountReceivable records that are overdue by more than
   * the specified number of days (business-hours-aware when configured).
   */
  private async countOverdueAR(thresholdDays: number): Promise<number> {
    const cutoffDate = this.getBusinessDayCutoff(thresholdDays);

    return this.prisma.accountReceivable.count({
      where: {
        status: {
          in: [AccountStatus.OPEN, AccountStatus.PARTIAL, AccountStatus.OVERDUE],
        },
        dueDate: { lt: cutoffDate },
      },
    });
  }

  /**
   * Count Complaint records that have been open or under investigation
   * for longer than the specified number of days (business-hours-aware
   * when configured).
   */
  private async countUnresolvedComplaints(thresholdDays: number): Promise<number> {
    const cutoffDate = this.getBusinessDayCutoff(thresholdDays);

    return this.prisma.complaint.count({
      where: {
        status: {
          in: [ComplaintStatus.OPEN, ComplaintStatus.INVESTIGATING],
        },
        createdAt: { lt: cutoffDate },
      },
    });
  }

  /**
   * Count orders that have been stuck in the same non-terminal status
   * for longer than the specified number of days (business-hours-aware
   * when configured). Uses the most recent status history entry to
   * determine how long the order has been in its current status.
   */
  private async countStuckOrders(thresholdDays: number): Promise<number> {
    const cutoffDate = this.getBusinessDayCutoff(thresholdDays);

    // Terminal statuses that should not be considered "stuck"
    const terminalStatuses: OrderStatus[] = [
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
      OrderStatus.RETURNED,
    ];

    // Find orders whose last status change is older than the threshold
    const stuckOrders = await this.prisma.order.count({
      where: {
        status: { notIn: terminalStatuses },
        statusHistory: {
          every: {
            createdAt: { lt: cutoffDate },
          },
        },
        updatedAt: { lt: cutoffDate },
      },
    });

    return stuckOrders;
  }

  /**
   * Send a notification to the configured role when an escalation
   * threshold has been exceeded.
   */
  private async sendEscalationNotification(result: EscalationCheckResult): Promise<void> {
    const { ruleName, eventType, count, thresholdValue, recipientRole } = result;

    const body = this.buildEscalationMessage(eventType, count, thresholdValue);

    await this.notificationService.sendToRole(recipientRole, {
      title: `Escalation Alert: ${ruleName}`,
      body,
      type: 'ALERT',
      referenceId: result.ruleId,
      isUrgent: true,
    });

    this.logger.warn(
      `Escalation triggered: ${eventType} - ${count} item(s) exceed ${thresholdValue} day threshold. Notified role: ${recipientRole}`,
    );
  }

  /**
   * Build a human-readable escalation notification message.
   */
  private buildEscalationMessage(eventType: string, count: number, thresholdValue: number): string {
    switch (eventType) {
      case 'OVERDUE_AR':
        return (
          `${count} accounts receivable are overdue by more than ${thresholdValue} days. ` +
          `Immediate follow-up is required to prevent further aging.`
        );

      case 'COMPLAINT_UNRESOLVED':
        return (
          `${count} customer complaint(s) have been unresolved for more than ${thresholdValue} days. ` +
          `Please review and expedite resolution.`
        );

      case 'ORDER_STUCK':
        return (
          `${count} order(s) have been stuck in the same status for more than ${thresholdValue} days. ` +
          `Please investigate potential bottlenecks.`
        );

      default:
        return `${count} item(s) have exceeded the ${thresholdValue} day threshold for ${eventType}.`;
    }
  }
}
