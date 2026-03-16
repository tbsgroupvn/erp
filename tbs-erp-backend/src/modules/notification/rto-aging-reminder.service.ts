import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from './notification.service';
import { DeliveryStatus } from '@prisma/client';

/**
 * RTO (Return to Origin) Aging Reminder Service.
 *
 * Runs every weekday at 9:00 AM to check for packages that have been
 * returned to the warehouse but not yet processed. Sends escalating
 * reminders at 7, 14, and 30 day milestones to warehouse managers
 * so that RTO inventory does not accumulate indefinitely.
 */
@Injectable()
export class RtoAgingReminderService {
  private readonly logger = new Logger(RtoAgingReminderService.name);

  /** Day milestones at which reminders are sent. */
  private static readonly REMINDER_DAYS = [7, 14, 30] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Cron: 9:00 AM Monday-Friday.
   * Queries all Delivery records with status RTO_RECEIVED and a non-null
   * rtoReceivedAt date, calculates the aging in days, and sends
   * notifications to warehouse managers at the configured milestones.
   */
  @Cron('0 9 * * 1-5')
  async checkRtoAging(): Promise<void> {
    this.logger.log('Starting RTO aging reminder check...');

    try {
      const rtoDeliveries = await this.prisma.delivery.findMany({
        where: {
          status: DeliveryStatus.RTO_RECEIVED,
          rtoReceivedAt: { not: null },
        },
        select: {
          id: true,
          code: true,
          orderId: true,
          rtoReceivedAt: true,
          rtoReason: true,
          recipientName: true,
          order: {
            select: {
              code: true,
              saleId: true,
              customer: {
                select: { fullName: true },
              },
            },
          },
        },
      });

      if (rtoDeliveries.length === 0) {
        this.logger.debug('No RTO deliveries found');
        return;
      }

      const now = new Date();
      let remindersSent = 0;

      for (const delivery of rtoDeliveries) {
        const rtoReceivedAt = delivery.rtoReceivedAt!;
        const rtoAgeDays = this.calculateDaysDiff(now, rtoReceivedAt);

        // Only send notifications at the exact milestone days
        const matchedMilestone = RtoAgingReminderService.REMINDER_DAYS.find(
          (days) => rtoAgeDays === days,
        );

        if (!matchedMilestone) {
          continue;
        }

        const urgency = this.getUrgencyLevel(matchedMilestone);
        const customerName = delivery.order?.customer?.fullName ?? 'N/A';
        const orderCode = delivery.order?.code ?? 'N/A';

        await this.notificationService.sendToRole('WAREHOUSE_MANAGER', {
          title: `RTO Aging Alert: ${matchedMilestone} days - ${delivery.code}`,
          body:
            `Delivery ${delivery.code} (Order ${orderCode}) has been in RTO storage for ${matchedMilestone} days. ` +
            `Customer: ${customerName}. ` +
            `Reason: ${delivery.rtoReason ?? 'Not specified'}. ` +
            `Please arrange re-delivery or return processing.`,
          type: 'WAREHOUSE',
          referenceId: delivery.id,
          isUrgent: urgency === 'URGENT',
        });

        remindersSent++;

        this.logger.log(
          `RTO reminder sent for delivery ${delivery.code}: ${matchedMilestone} days aged`,
        );
      }

      if (remindersSent > 0) {
        this.logger.log(
          `RTO aging check completed: ${remindersSent} reminder(s) sent out of ${rtoDeliveries.length} RTO deliveries`,
        );
      } else {
        this.logger.debug(
          `RTO aging check completed: no milestones reached among ${rtoDeliveries.length} RTO deliveries`,
        );
      }
    } catch (error) {
      this.logger.error(`RTO aging reminder check failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Calculate the difference in whole days between two dates.
   */
  private calculateDaysDiff(now: Date, past: Date): number {
    const diffMs = now.getTime() - past.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Determine urgency level based on the aging milestone.
   */
  private getUrgencyLevel(days: number): 'NORMAL' | 'HIGH' | 'URGENT' {
    if (days >= 30) return 'URGENT';
    if (days >= 14) return 'HIGH';
    return 'NORMAL';
  }
}
