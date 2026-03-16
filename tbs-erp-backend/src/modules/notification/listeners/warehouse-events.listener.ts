import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '../notification.service';

/**
 * Listens for warehouse events and notifies the sale owner.
 * The order module's WarehouseUpdatedListener handles weight recalculation;
 * this listener focuses on notifications.
 */
@Injectable()
export class WarehouseEventsListener {
  private readonly logger = new Logger(WarehouseEventsListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('warehouse.received')
  async handleWarehouseReceived(event: {
    orderId: string;
    warehouse: 'CN' | 'VN';
    packageCode?: string;
  }) {
    this.logger.log(`Package received at warehouse ${event.warehouse} for order ${event.orderId}`);

    try {
      // Find the sale owner for this order to notify them
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: { saleId: true, code: true },
      });

      // Guard: order must exist and have a sale owner
      if (!order?.saleId) {
        this.logger.warn(
          `warehouse.received: order ${event.orderId} not found or has no saleId, skipping notification`,
        );
        return;
      }

      await this.notificationService.send({
        userId: order.saleId,
        title: `Package Received - Warehouse ${event.warehouse}`,
        body: `A package${event.packageCode ? ` (${event.packageCode})` : ''} for order ${order.code} has been received at the ${event.warehouse} warehouse.`,
        type: 'WAREHOUSE',
        referenceId: event.orderId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to process warehouse.received for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
