import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderStatus } from '@prisma/client';
import { OrderStatusService } from '../order-status.service';

export interface WarehousePackageReceivedEvent {
  packageId: string;
  orderId: string;
  actualWeight?: number;
  chargeableWeight?: number;
  warehouse: 'CN' | 'VN';
}

export interface PackageMeasuredEvent {
  packageId: string;
  orderId: string;
  actualWeight: number;
  volumetricWeight: number;
  chargeableWeight: number;
}

/**
 * Listens for warehouse events and updates order weight totals.
 *
 * When a package is received or measured at a warehouse, the order's
 * total actual weight and total chargeable weight are recalculated
 * from all its associated packages.
 */
@Injectable()
export class WarehouseUpdatedListener {
  private readonly logger = new Logger(WarehouseUpdatedListener.name);

  constructor(private readonly orderStatusService: OrderStatusService) {}

  @OnEvent('warehouse.package.received')
  async handlePackageReceived(event: WarehousePackageReceivedEvent): Promise<void> {
    this.logger.log(
      `Package ${event.packageId} received at warehouse ${event.warehouse} for order ${event.orderId}`,
    );

    try {
      await this.orderStatusService.recalculateOrderWeights(event.orderId);
    } catch (error) {
      this.logger.error(
        `Failed to recalculate weights for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }

    // Auto-transition SOURCING → WAREHOUSE_CN khi kiện đầu tiên về kho TQ
    if (event.warehouse === 'CN') {
      try {
        const transitioned = await this.orderStatusService.autoTransitionToWarehouseCN(event.orderId);
        if (transitioned) {
          this.logger.log(
            `Order ${event.orderId} auto-transitioned to WAREHOUSE_CN after package ${event.packageId} received`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed auto-transition for order ${event.orderId}: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  @OnEvent('warehouse.package.measured')
  async handlePackageMeasured(event: PackageMeasuredEvent): Promise<void> {
    this.logger.log(
      `Package ${event.packageId} measured: actual=${event.actualWeight}kg, chargeable=${event.chargeableWeight}kg`,
    );

    try {
      await this.orderStatusService.recalculateOrderWeights(event.orderId);
    } catch (error) {
      this.logger.error(
        `Failed to recalculate weights for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * P2-3: When all packages for an order are delivered,
   * transition the order from DELIVERING → SETTLEMENT.
   */
  @OnEvent('order.all.delivered')
  async handleAllDelivered(event: { orderId: string; completedAt: Date }): Promise<void> {
    this.logger.log(`All packages delivered for order ${event.orderId}. Transitioning to SETTLEMENT.`);

    try {
      await this.orderStatusService.changeStatus(
        event.orderId,
        OrderStatus.SETTLEMENT,
        'SYSTEM',
        'Tự động chuyển quyết toán: tất cả kiện hàng đã giao',
      );
    } catch (error) {
      this.logger.error(
        `Failed to transition order ${event.orderId} to SETTLEMENT: ${error.message}`,
        error.stack,
      );
    }
  }
}
