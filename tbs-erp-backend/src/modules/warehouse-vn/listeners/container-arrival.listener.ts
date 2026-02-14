import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface ContainerArrivedEvent {
  containerId: string;
  containerCode: string;
  shippingRoute: string;
  totalPackages: number;
  totalWeight: number;
}

export interface DeliveryCompletedEvent {
  deliveryId: string;
  orderId: string;
  codAmount: number;
  codCollected: boolean;
}

/**
 * Listens for container arrival and delivery completion events
 * that affect Warehouse VN operations.
 *
 * - Container arrival: logs the expected packages and notifies warehouse staff
 * - Delivery completion: checks if all packages for an order are delivered,
 *   then triggers order status advancement to SETTLEMENT
 */
@Injectable()
export class ContainerArrivalListener {
  private readonly logger = new Logger(ContainerArrivalListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * When a container arrives at VN, prepare the receiving worksheet.
   */
  @OnEvent('container.arrived')
  async handleContainerArrived(
    event: ContainerArrivedEvent,
  ): Promise<void> {
    this.logger.log(
      `Container ${event.containerCode} arrived at VN warehouse. ` +
        `Expected: ${event.totalPackages} packages, ${event.totalWeight}kg ` +
        `via ${event.shippingRoute}`,
    );

    try {
      // Fetch all packages in this container for the receiving list
      const packages = await this.prisma.package.findMany({
        where: { containerId: event.containerId },
        select: {
          id: true,
          code: true,
          orderId: true,
          chargeableWeight: true,
          order: {
            select: {
              code: true,
              customerId: true,
              customer: { select: { fullName: true } },
            },
          },
        },
      });

      // Group by customer for efficient sorting
      const customerGroups = new Map<string, number>();
      for (const pkg of packages) {
        const customerName =
          pkg.order.customer.fullName ?? 'Unknown';
        customerGroups.set(
          customerName,
          (customerGroups.get(customerName) ?? 0) + 1,
        );
      }

      this.logger.log(
        `Receiving worksheet prepared for container ${event.containerCode}: ` +
          `${packages.length} packages across ${customerGroups.size} customers`,
      );

      // Emit notification event for warehouse VN staff
      this.eventEmitter.emit('notification.create', {
        type: 'WAREHOUSE',
        title: `Container ${event.containerCode} has arrived`,
        body:
          `Container via ${event.shippingRoute} has arrived with ` +
          `${event.totalPackages} packages (${event.totalWeight}kg). ` +
          `Ready for receiving.`,
        targetRoles: ['WAREHOUSE_VN_MANAGER', 'WAREHOUSE_VN_STAFF'],
        referenceId: event.containerId,
        isUrgent: true,
      });
    } catch (error) {
      this.logger.error(
        `Failed to prepare receiving for container ${event.containerCode}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * When a delivery is completed, check if all packages for the order
   * have been delivered. If so, advance the order to SETTLEMENT status.
   */
  @OnEvent('delivery.completed')
  async handleDeliveryCompleted(
    event: DeliveryCompletedEvent,
  ): Promise<void> {
    this.logger.log(
      `Delivery ${event.deliveryId} completed for order ${event.orderId}. ` +
        `COD: ${event.codAmount}, collected: ${event.codCollected}`,
    );

    try {
      // Check if all packages for this order are delivered
      const undelivered = await this.prisma.package.count({
        where: {
          orderId: event.orderId,
          warehouseVNStatus: { not: 'DELIVERED' },
          receivedVNAt: { not: null }, // Only count packages that arrived at VN
        },
      });

      if (undelivered === 0) {
        this.logger.log(
          `All packages delivered for order ${event.orderId}. ` +
            `Emitting order completion event.`,
        );

        this.eventEmitter.emit('order.all.delivered', {
          orderId: event.orderId,
          completedAt: new Date(),
        });
      } else {
        this.logger.log(
          `Order ${event.orderId} still has ${undelivered} undelivered packages at VN warehouse.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to check delivery completion for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
