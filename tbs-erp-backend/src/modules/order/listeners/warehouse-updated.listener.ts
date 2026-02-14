import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderService } from '../order.service';

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

  constructor(private readonly orderService: OrderService) {}

  @OnEvent('warehouse.package.received')
  async handlePackageReceived(
    event: WarehousePackageReceivedEvent,
  ): Promise<void> {
    this.logger.log(
      `Package ${event.packageId} received at warehouse ${event.warehouse} for order ${event.orderId}`,
    );

    try {
      await this.orderService.recalculateOrderWeights(event.orderId);
    } catch (error) {
      this.logger.error(
        `Failed to recalculate weights for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('warehouse.package.measured')
  async handlePackageMeasured(event: PackageMeasuredEvent): Promise<void> {
    this.logger.log(
      `Package ${event.packageId} measured: actual=${event.actualWeight}kg, chargeable=${event.chargeableWeight}kg`,
    );

    try {
      await this.orderService.recalculateOrderWeights(event.orderId);
    } catch (error) {
      this.logger.error(
        `Failed to recalculate weights for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
