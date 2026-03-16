import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '../notification.service';

/**
 * Listens for payment-related events not already handled by the
 * NotificationService's inline @OnEvent handlers.
 *
 * (ar.payment.recorded is handled in the service)
 * This listener handles: payroll.approved
 */
@Injectable()
export class PaymentEventsListener {
  private readonly logger = new Logger(PaymentEventsListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('payroll.approved')
  async handlePayrollApproved(event: {
    month: number;
    year: number;
    count: number;
    approverId: string;
  }) {
    this.logger.log(`Payroll approved for ${event.month}/${event.year}: ${event.count} records`);

    try {
      // Notify finance team
      const financeUsers = await this.prisma.user.findMany({
        where: {
          role: { in: ['CHIEF_ACCOUNTANT', 'ACCOUNTANT_AR'] },
          isActive: true,
        },
        select: { id: true },
      });

      for (const user of financeUsers) {
        await this.notificationService.send({
          userId: user.id,
          title: 'Payroll Approved',
          body: `Payroll for ${event.month}/${event.year} has been approved (${event.count} employees).`,
          type: 'PAYMENT',
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to process payroll.approved for ${event.month}/${event.year}: ${error.message}`,
        error.stack,
      );
    }
  }
}
