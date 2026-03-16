import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { QCStatus } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '../notification.service';

@Injectable()
export class QcMhhBridgeListener {
  private readonly logger = new Logger(QcMhhBridgeListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * When QC inspection is submitted with PARTIAL or FAILED status,
   * notify the Sale owner and CSKH role so they can send results to customer.
   */
  @OnEvent('qc.inspection.submitted')
  async handleQcInspectionSubmitted(event: {
    inspectionId: string;
    code: string;
    orderId: string;
    status: QCStatus;
    inspectedQuantity: number;
    passedQuantity: number;
    failedQuantity: number;
    submittedBy: string;
  }): Promise<void> {
    if (event.status !== QCStatus.PARTIAL && event.status !== QCStatus.FAILED) {
      return;
    }

    this.logger.log(
      `QC defect detected: ${event.code} - ${event.failedQuantity}/${event.inspectedQuantity} failed`,
    );

    const order = await this.prisma.order.findUnique({
      where: { id: event.orderId },
      select: { id: true, code: true, saleId: true },
    });

    if (!order) {
      this.logger.error(`Order ${event.orderId} not found for QC bridge notification`);
      return;
    }

    const notification = {
      title: 'QC phat hien hang loi',
      body:
        `Don ${order.code}: ${event.failedQuantity}/${event.inspectedQuantity} san pham loi. ` +
        `Can gui KH review.`,
      type: 'ORDER',
      referenceId: event.orderId,
      isUrgent: true,
    };

    // Notify the Sale owner of the order
    if (order.saleId) {
      await this.notificationService.send({
        userId: order.saleId,
        ...notification,
      });
    }

    // Notify CSKH role
    await this.notificationService.sendToRole('CSKH', notification);
  }

  /**
   * When customer rejects QC inspection results,
   * notify WAREHOUSE_CN_AGENT to create MHH Issue and the Sale owner.
   */
  @OnEvent('qc.inspection.customer-decision')
  async handleQcCustomerDecision(event: {
    inspectionId: string;
    code: string;
    orderId: string;
    approved: boolean;
    customerNote?: string;
  }): Promise<void> {
    if (event.approved) {
      return;
    }

    this.logger.log(
      `Customer rejected QC ${event.code} for order ${event.orderId}`,
    );

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: { id: true, code: true, saleId: true },
      });

      if (!order) {
        this.logger.error(`Order ${event.orderId} not found for QC rejection notification`);
        return;
      }

      const warehouseNotification = {
        title: 'KH tu choi hang loi - Can tao MHH Issue',
        body:
          `Don ${order.code}: KH da reject ket qua QC ${event.code}. ` +
          `Can tao MHH Issue de xu ly hang loi voi NCC.`,
        type: 'ORDER',
        referenceId: event.orderId,
        isUrgent: true,
      };

      // Notify WAREHOUSE_CN_AGENT role
      await this.notificationService.sendToRole('WAREHOUSE_CN_AGENT', warehouseNotification);

      // Notify the Sale owner
      if (order.saleId) {
        await this.notificationService.send({
          userId: order.saleId,
          title: 'KH tu choi ket qua QC',
          body:
            `Don ${order.code}: KH da reject ket qua QC ${event.code}. ` +
            `Can theo doi xu ly MHH Issue.`,
          type: 'ORDER',
          referenceId: event.orderId,
          isUrgent: true,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to process qc.inspection.customer-decision for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
