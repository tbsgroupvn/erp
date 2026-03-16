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

    try {
      // Collect all notified sale IDs to avoid duplicate notifications
      const notifiedSaleIds = new Set<string>();

      for (const customerId of event.customerIds) {
        // Find the sale owner for this customer
        const customer = await this.prisma.customer.findUnique({
          where: { id: customerId },
          select: { saleId: true, fullName: true },
        });

        if (!customer?.saleId || notifiedSaleIds.has(customer.saleId)) continue;
        notifiedSaleIds.add(customer.saleId);

        await this.notificationService.send({
          userId: customer.saleId,
          title: 'Container bi ket tai cua khau',
          body: `Container ${event.containerCode} dang bi ket tai cua khau. Vui long lien he Sale de biet them chi tiet. Khach hang: ${customer.fullName}`,
          type: 'WAREHOUSE',
          referenceId: event.containerId,
          isUrgent: true,
        });
      }

      // Also notify sale owners of orders in the container not covered by customerIds
      const orders = await this.prisma.order.findMany({
        where: { containerId: event.containerId },
        select: { saleId: true },
      });

      for (const order of orders) {
        if (!order.saleId || notifiedSaleIds.has(order.saleId)) continue;
        notifiedSaleIds.add(order.saleId);

        await this.notificationService.send({
          userId: order.saleId,
          title: 'Container bi ket tai cua khau',
          body: `Container ${event.containerCode} dang bi ket tai cua khau. Vui long lien he Sale de biet them chi tiet.`,
          type: 'WAREHOUSE',
          referenceId: event.containerId,
          isUrgent: true,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to process container.on_hold_border for container ${event.containerId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
