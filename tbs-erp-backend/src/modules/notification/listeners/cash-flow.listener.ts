import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../notification.service';

@Injectable()
export class CashFlowListener {
  private readonly logger = new Logger(CashFlowListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent('cash-flow.warning')
  async handleCashFlowWarning(event: {
    orderId: string;
    orderCode: string;
    utilizationPercent: number;
    level: string;
    timestamp: Date;
  }) {
    this.logger.warn(
      `Cash flow WARNING: order ${event.orderCode}, utilization ${event.utilizationPercent.toFixed(1)}%`,
    );

    try {
      const notification = {
        title: 'Canh bao dong tien',
        body:
          `Don hang ${event.orderCode}: Su dung quy dat ${event.utilizationPercent.toFixed(1)}%. ` +
          `Can theo doi sat de tranh vuot quy.`,
        type: 'FINANCE',
        referenceId: event.orderId,
        isUrgent: false,
      };

      await Promise.all([
        this.notificationService.sendToRole('CFO', notification),
        this.notificationService.sendToRole('CHIEF_ACCOUNTANT', notification),
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to process cash-flow.warning for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('cash-flow.critical')
  async handleCashFlowCritical(event: {
    orderId: string;
    orderCode: string;
    utilizationPercent: number;
    level: string;
    timestamp: Date;
  }) {
    this.logger.error(
      `Cash flow CRITICAL: order ${event.orderCode}, utilization ${event.utilizationPercent.toFixed(1)}%`,
    );

    try {
      const notification = {
        title: 'KHAN CAP: Vuot quy dong tien',
        body:
          `Don hang ${event.orderCode}: Su dung quy dat ${event.utilizationPercent.toFixed(1)}%. ` +
          `Can xu ly ngay de dam bao dong tien.`,
        type: 'FINANCE',
        referenceId: event.orderId,
        isUrgent: true,
      };

      await Promise.all([
        this.notificationService.sendToRole('CEO', notification),
        this.notificationService.sendToRole('COO', notification),
        this.notificationService.sendToRole('CFO', notification),
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to process cash-flow.critical for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
