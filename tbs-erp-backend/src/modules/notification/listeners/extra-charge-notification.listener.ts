import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '../notification.service';

@Injectable()
export class ExtraChargeNotificationListener {
  private readonly logger = new Logger(ExtraChargeNotificationListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('order.extra_charge_pending')
  async handleExtraChargePending(event: {
    chargeId: string;
    orderId: string;
    orderCode: string;
    chargeType: string;
    amount: number;
    createdBy: string;
  }) {
    this.logger.log(
      `Extra charge pending notification: order=${event.orderCode}, type=${event.chargeType}, amount=${event.amount}`,
    );

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: { saleId: true },
      });

      if (!order?.saleId) return;

      await this.notificationService.send({
        userId: order.saleId,
        title: 'Phu phi phat sinh cho don hang',
        body: `Don ${event.orderCode} co phu phi phat sinh ${event.chargeType}: ${event.amount.toLocaleString()}. Dang cho phe duyet.`,
        type: 'ORDER',
        referenceId: event.orderId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send extra charge pending notification: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('order.extra_charge_approved')
  async handleExtraChargeApproved(event: {
    chargeId: string;
    orderId: string;
    orderCode: string;
    amount: number;
    approvedBy: string;
  }) {
    this.logger.log(
      `Extra charge approved notification: order=${event.orderCode}, amount=${event.amount}`,
    );

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: { saleId: true, totalAmount: true },
      });

      if (!order?.saleId) return;

      await this.notificationService.send({
        userId: order.saleId,
        title: 'Phu phi da duoc phe duyet',
        body: `Phu phi ${event.amount.toLocaleString()} cho don ${event.orderCode} da duoc phe duyet. Tong moi: ${Number(order.totalAmount).toLocaleString()}`,
        type: 'ORDER',
        referenceId: event.orderId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send extra charge approved notification: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('order.extra_charge_rejected')
  async handleExtraChargeRejected(event: {
    chargeId: string;
    orderId: string;
    orderCode: string;
    rejectedBy: string;
  }) {
    this.logger.log(
      `Extra charge rejected notification: order=${event.orderCode}`,
    );

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: { saleId: true },
      });

      if (!order?.saleId) return;

      await this.notificationService.send({
        userId: order.saleId,
        title: 'Phu phi da bi tu choi',
        body: `Phu phi cho don ${event.orderCode} da bi tu choi.`,
        type: 'ORDER',
        referenceId: event.orderId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send extra charge rejected notification: ${error.message}`,
        error.stack,
      );
    }
  }
}
