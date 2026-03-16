import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '../notification.service';

/**
 * Listens for order-related events not already handled by the
 * NotificationService's inline @OnEvent handlers.
 *
 * Specifically handles: order.cancel.requested
 * (order.created, order.status.changed, order.cancelled are handled in the service)
 */
@Injectable()
export class OrderEventsListener {
  private readonly logger = new Logger(OrderEventsListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('order.cancel.requested')
  async handleOrderCancelRequested(event: {
    orderId: string;
    code: string;
    approvalId: string;
    requestedBy: string;
    reason: string;
  }) {
    this.logger.log(`Order cancel requested: ${event.code}`);

    try {
      // Notify sales leaders about the cancellation request
      const salesLeaders = await this.prisma.user.findMany({
        where: { role: 'SALES_LEADER', isActive: true },
        select: { id: true },
      });

      for (const leader of salesLeaders) {
        await this.notificationService.send({
          userId: leader.id,
          title: 'Order Cancellation Request',
          body: `Order ${event.code} has a cancellation request pending approval. Reason: ${event.reason}`,
          type: 'ORDER',
          referenceId: event.approvalId,
          isUrgent: true,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to process order.cancel.requested for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
