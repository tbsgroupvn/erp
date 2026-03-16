import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '../notification.service';

@Injectable()
export class BulkyCwAlertListener {
  private readonly logger = new Logger(BulkyCwAlertListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Notify Sale + Warehouse agent when CW >> actual weight (bulky item).
   * Allows Sale to advise customer on compression/repacking.
   */
  @OnEvent('package.bulky_cw_alert')
  async handleBulkyCwAlert(event: {
    packageId: string;
    packageCode: string;
    orderId: string;
    actualWeight: number;
    volumetricWeight: number;
    chargeableWeight: number;
    cwRatio: number;
    route: string;
    dimensions: { length: number; width: number; height: number };
  }) {
    this.logger.warn(
      `Bulky CW alert: ${event.packageCode} - CW=${event.chargeableWeight}kg, ` +
        `actual=${event.actualWeight}kg, ratio=${event.cwRatio}x`,
    );

    try {
      const { length, width, height } = event.dimensions;

      const notification = {
        title: 'Canh bao hang cong kenh',
        body:
          `Kien ${event.packageCode}: CW = ${event.chargeableWeight}kg ` +
          `(gap ${event.cwRatio} lan KL thuc ${event.actualWeight}kg). ` +
          `Kich thuoc ${length}x${width}x${height}cm, tuyen ${event.route}. ` +
          `Can tu van KH ep kien?`,
        type: 'WAREHOUSE',
        referenceId: event.packageId,
        isUrgent: true,
      };

      // Find the Sale assigned to this order
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: { saleId: true },
      });

      if (order?.saleId) {
        await this.notificationService.send({
          userId: order.saleId,
          ...notification,
        });
      }

      // Also notify warehouse CN agent
      await this.notificationService.sendToRole('WAREHOUSE_CN_AGENT', notification);
    } catch (error) {
      this.logger.error(
        `Failed to process package.bulky_cw_alert for package ${event.packageId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Notify WAREHOUSE_MANAGER + LOGISTICS_MANAGER when remeasure reduces CW by > 50%.
   * Requires spot-check to verify measurement accuracy.
   */
  @OnEvent('package.remeasure_spot_check')
  async handleRemeasureSpotCheck(event: {
    packageId: string;
    packageCode: string;
    orderId: string;
    oldCW: number;
    newCW: number;
    reductionPercent: number;
    measuredBy: string;
  }) {
    this.logger.warn(
      `Remeasure spot-check: ${event.packageCode} - old CW=${event.oldCW}kg, ` +
        `new CW=${event.newCW}kg, reduction=${event.reductionPercent}%`,
    );

    try {
      const notification = {
        title: `Can kiem tra lai: CW giam ${event.reductionPercent}%`,
        body:
          `Kien ${event.packageCode}: CW cu ${event.oldCW}kg -> moi ${event.newCW}kg ` +
          `(giam ${event.reductionPercent}%). Agent ${event.measuredBy} da do lai. ` +
          `Yeu cau spot-check.`,
        type: 'WAREHOUSE',
        referenceId: event.packageId,
        isUrgent: true,
      };

      await this.notificationService.sendToRole('WAREHOUSE_MANAGER', notification);
      await this.notificationService.sendToRole('LOGISTICS_MANAGER', notification);
    } catch (error) {
      this.logger.error(
        `Failed to process package.remeasure_spot_check for package ${event.packageId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
