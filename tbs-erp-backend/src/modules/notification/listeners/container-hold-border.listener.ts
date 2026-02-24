import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '../notification.service';

/**
 * Listens for container.on_hold_border events and notifies
 * affected customers' sale owners about the border hold.
 */
@Injectable()
export class ContainerHoldBorderListener {
  private readonly logger = new Logger(ContainerHoldBorderListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('container.on_hold_border')
  async handleContainerOnHoldBorder(event: {
    containerId: string;
    containerCode: string;
    customerIds: string[];
  }) {
    this.logger.log(
      `Container ${event.containerCode} on hold at border. Notifying ${event.customerIds.length} customers.`,
    );

    for (const customerId of event.customerIds) {
      // Find the sale owner for this customer
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { saleId: true, fullName: true },
      });

      if (!customer?.saleId) continue;

      await this.notificationService.send({
        userId: customer.saleId,
        title: 'Container bị kẹt tại cửa khẩu',
        body: `Container ${event.containerCode} đang bị kẹt tại cửa khẩu. Vui lòng liên hệ Sale để biết thêm chi tiết. Khách hàng: ${customer.fullName}`,
        type: 'WAREHOUSE',
        referenceId: event.containerId,
        isUrgent: true,
      });
    }

    // Also create notifications for all affected customers' orders' sale owners
    const orders = await this.prisma.order.findMany({
      where: { containerId: event.containerId },
      select: { saleId: true, code: true, customerId: true },
    });

    const notifiedSaleIds = new Set<string>();
    for (const order of orders) {
      if (notifiedSaleIds.has(order.saleId)) continue;
      notifiedSaleIds.add(order.saleId);

      await this.notificationService.send({
        userId: order.saleId,
        title: 'Container bị kẹt tại cửa khẩu',
        body: `Container ${event.containerCode} đang bị kẹt tại cửa khẩu. Vui lòng liên hệ Sale để biết thêm chi tiết.`,
        type: 'WAREHOUSE',
        referenceId: event.containerId,
        isUrgent: true,
      });
    }
  }
}
