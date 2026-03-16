import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';

export interface SupplierOrderReceivedEvent {
  supplierOrderId: string;
  code: string;
  orderId: string;
  quantityReceived?: number;
  actualPriceCNY?: number;
  receivedBy: string;
}

export interface ShortfallClosedEvent {
  supplierOrderId: string;
  code: string;
  orderId: string;
  orderItemId: string | null;
  shortfallQty: number;
  quantityOrdered: number;
  quantityReceived: number;
  supplierRefundCNY: number;
  closedBy: string;
}

type FulfillmentStatus = 'FULL' | 'PARTIAL' | 'NONE';

@Injectable()
export class FulfillmentTrackingListener {
  private readonly logger = new Logger(FulfillmentTrackingListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('supplier-order.received')
  async onSupplierOrderReceived(event: SupplierOrderReceivedEvent): Promise<void> {
    this.logger.log(`Fulfillment tracking: supplier-order.received for order ${event.orderId}`);
    try {
      await this.updateFulfillment(event.orderId);
    } catch (error) {
      this.logger.error(
        `Failed to update fulfillment for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('supplier-order.shortfall.closed')
  async onShortfallClosed(event: ShortfallClosedEvent): Promise<void> {
    this.logger.log(`Fulfillment tracking: shortfall closed for order ${event.orderId}`);
    try {
      await this.updateFulfillment(event.orderId);
    } catch (error) {
      this.logger.error(
        `Failed to update fulfillment after shortfall close for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  private async updateFulfillment(orderId: string): Promise<void> {
    // Get all supplier orders for this order, grouped by orderItemId
    const supplierOrders = await this.prisma.supplierOrder.findMany({
      where: { orderId },
      select: {
        orderItemId: true,
        quantityReceived: true,
      },
    });

    // Get all order items
    const orderItems = await this.prisma.orderItem.findMany({
      where: { orderId, deletedAt: null },
      select: { id: true, quantity: true, fulfilledQuantity: true },
    });

    // Calculate fulfilledQuantity per orderItem
    const fulfilledMap = new Map<string, number>();
    for (const so of supplierOrders) {
      if (so.orderItemId) {
        const current = fulfilledMap.get(so.orderItemId) ?? 0;
        fulfilledMap.set(so.orderItemId, current + so.quantityReceived);
      }
    }

    // Update each order item's fulfilledQuantity
    for (const item of orderItems) {
      const newFulfilled = fulfilledMap.get(item.id) ?? 0;
      if (newFulfilled !== item.fulfilledQuantity) {
        await this.prisma.orderItem.update({
          where: { id: item.id },
          data: { fulfilledQuantity: newFulfilled },
        });
      }
    }

    // Calculate overall fulfillment status
    let fulfillmentStatus: FulfillmentStatus = 'NONE';

    if (orderItems.length > 0) {
      const allFull = orderItems.every((item) => {
        const fulfilled = fulfilledMap.get(item.id) ?? 0;
        return fulfilled >= item.quantity;
      });
      const anyFulfilled = orderItems.some((item) => {
        const fulfilled = fulfilledMap.get(item.id) ?? 0;
        return fulfilled > 0;
      });

      if (allFull) {
        fulfillmentStatus = 'FULL';
      } else if (anyFulfilled) {
        fulfillmentStatus = 'PARTIAL';
      }
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { fulfillmentStatus },
    });

    this.logger.log(
      `Order ${orderId} fulfillment updated: ${fulfillmentStatus}`,
    );
  }
}
