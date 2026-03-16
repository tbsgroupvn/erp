import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../notification.service';

/**
 * Listens for package.weight_variance_alert events and notifies
 * WAREHOUSE_VN_MANAGER and CHIEF_ACCOUNTANT roles about significant
 * weight differences between CN and VN warehouses.
 */
@Injectable()
export class WeightVarianceListener {
  private readonly logger = new Logger(WeightVarianceListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent('package.weight_variance_alert')
  async handleWeightVarianceAlert(event: {
    packageId: string;
    packageCode: string;
    orderId: string;
    cnWeight: number;
    vnWeight: number;
    variancePercent: number;
    detectedBy: string;
  }) {
    this.logger.warn(
      `Weight variance alert: package ${event.packageCode} - CN: ${event.cnWeight}kg, VN: ${event.vnWeight}kg, variance: ${event.variancePercent.toFixed(2)}%`,
    );

    try {
      const notification = {
        title: 'Canh bao chenh lech can nang',
        body:
          `Kien hang ${event.packageCode} co chenh lech can nang ${event.variancePercent.toFixed(1)}%. ` +
          `Kho TQ: ${event.cnWeight}kg, Kho VN: ${event.vnWeight}kg.`,
        type: 'WAREHOUSE',
        referenceId: event.packageId,
        isUrgent: true,
      };

      // Notify WAREHOUSE_VN_MANAGER role
      await this.notificationService.sendToRole('WAREHOUSE_VN_MANAGER', notification);

      // Notify CHIEF_ACCOUNTANT role
      await this.notificationService.sendToRole('CHIEF_ACCOUNTANT', notification);
    } catch (error) {
      this.logger.error(
        `Failed to process package.weight_variance_alert for package ${event.packageId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
