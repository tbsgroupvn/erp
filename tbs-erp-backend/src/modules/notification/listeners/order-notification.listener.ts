import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '../notification.service';
import { OrderStatus } from '@prisma/client';

/**
 * Listens for order lifecycle events and sends targeted notifications
 * to the assigned sales person (sale owner).
 *
 * Complements the NotificationService's inline @OnEvent handlers
 * (which notify the changedBy user) and the OrderEventsListener
 * (which handles cancel requests). This listener focuses on keeping
 * the sale informed of key logistics milestones.
 */
@Injectable()
export class OrderNotificationListener {
  private readonly logger = new Logger(OrderNotificationListener.name);

  /** Statuses that trigger a sales notification on status change. */
  private static readonly SALE_NOTIFY_STATUSES: OrderStatus[] = [
    OrderStatus.WAREHOUSE_CN,
    OrderStatus.WAREHOUSE_VN,
    OrderStatus.DELIVERING,
    OrderStatus.COMPLETED,
  ];

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * When an order's status changes to WAREHOUSE_VN, DELIVERING, or COMPLETED,
   * notify the assigned sale so they can update the customer proactively.
   */
  @OnEvent('order.status.changed')
  async handleOrderStatusChanged(event: {
    orderId: string;
    code?: string;
    orderCode?: string;
    fromStatus: string | null;
    toStatus: string;
    changedBy: string;
  }): Promise<void> {
    const newStatus = event.toStatus as OrderStatus;

    if (!OrderNotificationListener.SALE_NOTIFY_STATUSES.includes(newStatus)) {
      return;
    }

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: {
          id: true,
          code: true,
          saleId: true,
          customer: {
            select: { fullName: true },
          },
        },
      });

      if (!order) {
        this.logger.warn(`Order ${event.orderId} not found for status change notification`);
        return;
      }

      // Avoid double-notifying if the sale is the one who made the change
      if (order.saleId === event.changedBy) {
        return;
      }

      const orderCode = order.code;
      const customerName = order.customer?.fullName ?? 'N/A';
      const message = this.buildStatusChangeMessage(newStatus, orderCode, customerName);

      await this.notificationService.send({
        userId: order.saleId,
        title: message.title,
        body: message.body,
        type: 'ORDER',
        referenceId: order.id,
      });

      this.logger.log(`Sale notification sent for order ${orderCode}: status -> ${newStatus}`);
    } catch (error) {
      this.logger.error(
        `Failed to send sale notification for order status change: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * When a package arrives at the VN warehouse, notify the sale
   * so they can inform the customer.
   */
  @OnEvent('package.received.vn')
  async handlePackageReceivedVN(event: {
    orderId: string;
    packageId?: string;
    packageCode?: string;
  }): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: {
          id: true,
          code: true,
          saleId: true,
          customer: {
            select: { fullName: true },
          },
        },
      });

      if (!order) {
        this.logger.warn(`Order ${event.orderId} not found for package.received.vn notification`);
        return;
      }

      const packageRef = event.packageCode ? ` (${event.packageCode})` : '';

      await this.notificationService.send({
        userId: order.saleId,
        title: `Package Arrived in VN - ${order.code}`,
        body:
          `A package${packageRef} for order ${order.code} ` +
          `(Customer: ${order.customer?.fullName ?? 'N/A'}) ` +
          `has arrived at the VN warehouse. Please notify the customer for delivery scheduling.`,
        type: 'WAREHOUSE',
        referenceId: order.id,
      });

      this.logger.log(`Sale notified: package arrived VN for order ${order.code}`);
    } catch (error) {
      this.logger.error(
        `Failed to send package.received.vn notification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * When a delivery is completed, notify the sale that the customer
   * has received their goods.
   */
  @OnEvent('delivery.completed')
  async handleDeliveryCompleted(event: {
    orderId: string;
    deliveryId?: string;
    deliveryCode?: string;
  }): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: {
          id: true,
          code: true,
          saleId: true,
          customer: {
            select: { fullName: true },
          },
        },
      });

      if (!order) {
        this.logger.warn(`Order ${event.orderId} not found for delivery.completed notification`);
        return;
      }

      const deliveryRef = event.deliveryCode ? ` (Delivery: ${event.deliveryCode})` : '';

      await this.notificationService.send({
        userId: order.saleId,
        title: `Delivery Completed - ${order.code}`,
        body:
          `Order ${order.code}${deliveryRef} has been successfully delivered ` +
          `to ${order.customer?.fullName ?? 'the customer'}. ` +
          `Please follow up for feedback and settlement.`,
        type: 'ORDER',
        referenceId: order.id,
      });

      this.logger.log(`Sale notified: delivery completed for order ${order.code}`);
    } catch (error) {
      this.logger.error(
        `Failed to send delivery.completed notification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Build title and body for a status-change notification to the sale.
   */
  private buildStatusChangeMessage(
    status: OrderStatus,
    orderCode: string,
    customerName: string,
  ): { title: string; body: string } {
    switch (status) {
      case OrderStatus.WAREHOUSE_CN:
        return {
          title: `Hang da nhap kho TQ - ${orderCode}`,
          body:
            `Don hang ${orderCode} (KH: ${customerName}) da co kien hang nhap kho Trung Quoc. ` +
            `Vui long theo doi va cap nhat khach hang.`,
        };

      case OrderStatus.WAREHOUSE_VN:
        return {
          title: `Order Arrived at VN Warehouse - ${orderCode}`,
          body:
            `Order ${orderCode} (Customer: ${customerName}) has arrived at the VN warehouse. ` +
            `Please coordinate with the customer for delivery scheduling.`,
        };

      case OrderStatus.DELIVERING:
        return {
          title: `Order Out for Delivery - ${orderCode}`,
          body:
            `Order ${orderCode} (Customer: ${customerName}) is now out for delivery. ` +
            `The customer should expect to receive their goods shortly.`,
        };

      case OrderStatus.COMPLETED:
        return {
          title: `Order Completed - ${orderCode}`,
          body:
            `Order ${orderCode} (Customer: ${customerName}) has been marked as completed. ` +
            `Please ensure settlement is finalized.`,
        };

      default:
        return {
          title: `Order Status Update - ${orderCode}`,
          body: `Order ${orderCode} (Customer: ${customerName}) status changed to ${status}.`,
        };
    }
  }
}
