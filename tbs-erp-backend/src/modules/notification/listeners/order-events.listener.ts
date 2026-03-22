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

  /**
   * Send customer-facing notification when order moves to a trackable status.
   * Critical statuses (CUSTOMS_HOLD) also trigger SMS.
   */
  @OnEvent('order.status.changed')
  async handleOrderStatusCustomerNotify(payload: {
    orderId: string;
    orderCode: string;
    customerId: string;
    fromStatus: string;
    toStatus: string;
    changedBy: string;
  }) {
    const CUSTOMER_NOTIFY_STATUSES = [
      'DEPOSITED',
      'CN_WAREHOUSE',
      'IN_TRANSIT',
      'VN_WAREHOUSE',
      'DELIVERING',
      'DELIVERED',
      'CUSTOMS_HOLD',
    ];

    if (!CUSTOMER_NOTIFY_STATUSES.includes(payload.toStatus)) return;

    const statusMessages: Record<string, string> = {
      DEPOSITED: 'Đã nhận cọc, đơn hàng đang được xử lý',
      CN_WAREHOUSE: 'Hàng đã về kho Trung Quốc',
      IN_TRANSIT: 'Hàng đang vận chuyển về Việt Nam',
      VN_WAREHOUSE: 'Hàng đã về kho Việt Nam',
      DELIVERING: 'Hàng đang giao đến bạn',
      DELIVERED: 'Hàng đã giao thành công',
      CUSTOMS_HOLD:
        '⚠ Đơn hàng đang bị giữ tại hải quan, vui lòng liên hệ CSKH',
    };

    try {
      await this.notificationService.send({
        userId: payload.customerId,
        title: `Đơn hàng ${payload.orderCode} - ${statusMessages[payload.toStatus] ?? payload.toStatus}`,
        body:
          statusMessages[payload.toStatus] ??
          `Trạng thái đơn hàng đã chuyển sang ${payload.toStatus}`,
        type: 'ORDER',
        referenceId: payload.orderId,
      });

      this.logger.log(
        `Customer notification sent for order ${payload.orderCode}: ${payload.toStatus}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send customer notification for order ${payload.orderCode}: ${error.message}`,
      );
    }
  }

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
