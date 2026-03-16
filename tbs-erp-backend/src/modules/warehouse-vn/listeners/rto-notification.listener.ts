import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '@modules/notification/notification.service';

@Injectable()
export class RtoNotificationListener {
  private readonly logger = new Logger(RtoNotificationListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Khi tai xe bao giao that bai -> thong bao Sale + CSKH.
   */
  @OnEvent('delivery.failed')
  async handleDeliveryFailed(event: {
    deliveryId: string;
    orderId: string;
    driverId?: string;
    failReason: string;
    failNote?: string;
  }) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: {
          id: true,
          code: true,
          saleId: true,
          customer: { select: { fullName: true } },
        },
      });

      if (!order) {
        this.logger.warn(`Order ${event.orderId} not found for delivery.failed notification`);
        return;
      }

      const failReasonLabel = this.getFailReasonLabel(event.failReason);
      const customerName = order.customer?.fullName ?? 'N/A';

      // Notify sale owner
      await this.notificationService.send({
        userId: order.saleId,
        title: `Giao hang that bai - ${order.code}`,
        body:
          `Don ${order.code} (KH: ${customerName}): Tai xe giao khong thanh cong. ` +
          `Ly do: ${failReasonLabel}.${event.failNote ? ` Chi tiet: ${event.failNote}.` : ''} ` +
          `Hang dang tren duong tra ve kho.`,
        type: 'ORDER',
        referenceId: order.id,
        isUrgent: true,
      });

      // Notify CSKH role
      await this.notificationService.sendToRole('CSKH', {
        title: `Giao hang that bai - ${order.code}`,
        body:
          `Don ${order.code} (KH: ${customerName}): Giao khong thanh cong. ` +
          `Ly do: ${failReasonLabel}. Hang dang tra ve kho VN.`,
        type: 'ORDER',
        referenceId: order.id,
        isUrgent: true,
      });

      this.logger.log(`RTO notification sent for failed delivery ${event.deliveryId}, order ${order.code}`);
    } catch (error) {
      this.logger.error(
        `Failed to send delivery.failed notification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Khi kho VN scan nhan hang hoan -> thong bao Sale + CSKH ve phi luu kho.
   */
  @OnEvent('delivery.rto.received')
  async handleRtoReceived(event: { deliveryId: string; orderId: string }) {
    try {
      const delivery = await this.prisma.delivery.findUnique({
        where: { id: event.deliveryId },
        select: { id: true, code: true, rtoReceivedAt: true },
      });

      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: {
          id: true,
          code: true,
          saleId: true,
          customer: { select: { fullName: true } },
        },
      });

      if (!order) {
        this.logger.warn(`Order ${event.orderId} not found for delivery.rto.received notification`);
        return;
      }

      const customerName = order.customer?.fullName ?? 'N/A';
      const receivedDate = delivery?.rtoReceivedAt
        ? delivery.rtoReceivedAt.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      // Notify sale owner
      await this.notificationService.send({
        userId: order.saleId,
        title: `Giao hang that bai - Hang da ve kho`,
        body:
          `Don ${order.code} (KH: ${customerName}): Giao that bai. Hang da ve kho VN. ` +
          `Phi luu kho tinh tu ngay ${receivedDate}. Lien he KH de len lich giao lai.`,
        type: 'ORDER',
        referenceId: order.id,
        isUrgent: true,
      });

      // Notify CSKH role
      await this.notificationService.sendToRole('CSKH', {
        title: `Hang hoan da ve kho - ${order.code}`,
        body:
          `Don ${order.code} (KH: ${customerName}): Hang hoan da ve kho VN ngay ${receivedDate}. ` +
          `Phi luu kho 10,000 VND/ngay. Can lien he KH len lich giao lai.`,
        type: 'ORDER',
        referenceId: order.id,
        isUrgent: true,
      });

      this.logger.log(`RTO received notification sent for delivery ${event.deliveryId}, order ${order.code}`);
    } catch (error) {
      this.logger.error(
        `Failed to send delivery.rto.received notification: ${error.message}`,
        error.stack,
      );
    }
  }

  private getFailReasonLabel(reason: string): string {
    const labels: Record<string, string> = {
      KH_KHONG_CO_NHA: 'KH khong co nha',
      KH_TU_CHOI: 'KH tu choi nhan hang',
      DIA_CHI_SAI: 'Dia chi giao sai',
      KHAC: 'Ly do khac',
    };
    return labels[reason] ?? reason;
  }
}
