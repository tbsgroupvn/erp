import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '../notification.service';

/**
 * Listens for MHH (Mua hàng hộ) related events:
 * - supplier-order.created
 * - supplier-order.status.changed
 * - supplier-order.received
 * - mhh-issue.created
 * - mhh-issue.assigned
 * - mhh-issue.resolved
 */
@Injectable()
export class MHHEventsListener {
  private readonly logger = new Logger(MHHEventsListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('supplier-order.created')
  async handleSupplierOrderCreated(event: {
    supplierOrderId: string;
    code: string;
    orderId: string;
    supplierName: string;
    createdBy: string;
  }) {
    this.logger.log(`Supplier order created: ${event.code}`);

    try {
      // Notify XNK managers about new supplier order
      const xnkManagers = await this.prisma.user.findMany({
        where: { role: 'XNK_MANAGER', isActive: true },
        select: { id: true },
      });

      for (const manager of xnkManagers) {
        if (manager.id === event.createdBy) continue;
        await this.notificationService.send({
          userId: manager.id,
          title: 'Don NCC moi',
          body: `Don NCC ${event.code} cho NCC "${event.supplierName}" da duoc tao.`,
          type: 'SUPPLIER_ORDER',
          referenceId: event.supplierOrderId,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to process supplier-order.created for ${event.supplierOrderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('supplier-order.status.changed')
  async handleSupplierOrderStatusChanged(event: {
    supplierOrderId: string;
    code: string;
    orderId: string;
    previousStatus: string;
    newStatus: string;
    changedBy: string;
  }) {
    this.logger.log(
      `Supplier order ${event.code} status: ${event.previousStatus} -> ${event.newStatus}`,
    );

    try {
      // If status is ISSUE, notify XNK managers urgently
      if (event.newStatus === 'ISSUE') {
        const xnkManagers = await this.prisma.user.findMany({
          where: { role: 'XNK_MANAGER', isActive: true },
          select: { id: true },
        });

        for (const manager of xnkManagers) {
          await this.notificationService.send({
            userId: manager.id,
            title: 'Don NCC co van de',
            body: `Don NCC ${event.code} gap su co. Truoc do: ${event.previousStatus}.`,
            type: 'SUPPLIER_ORDER',
            referenceId: event.supplierOrderId,
            isUrgent: true,
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to process supplier-order.status.changed for ${event.supplierOrderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('supplier-order.received')
  async handleSupplierOrderReceived(event: {
    supplierOrderId: string;
    code: string;
    orderId: string;
    quantityReceived?: number;
    receivedBy: string;
  }) {
    this.logger.log(`Supplier order ${event.code} received at CN warehouse`);

    try {
      // Notify the order's sale person
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: { saleId: true, code: true },
      });

      if (order?.saleId) {
        await this.notificationService.send({
          userId: order.saleId,
          title: 'Hang NCC da nhan',
          body: `Don NCC ${event.code} (don hang ${order.code}) da duoc kho TQ nhan hang.${event.quantityReceived ? ` SL: ${event.quantityReceived}` : ''}`,
          type: 'SUPPLIER_ORDER',
          referenceId: event.supplierOrderId,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to process supplier-order.received for ${event.supplierOrderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('mhh-issue.created')
  async handleMHHIssueCreated(event: {
    issueId: string;
    code: string;
    orderId: string;
    issueType: string;
    severity: string;
    createdBy: string;
  }) {
    this.logger.log(`MHH issue created: ${event.code}`);

    try {
      // Notify XNK staff about the new issue
      const xnkStaff = await this.prisma.user.findMany({
        where: { role: { in: ['XNK_MANAGER', 'XNK_STAFF'] }, isActive: true },
        select: { id: true },
      });

      const isUrgent = event.severity === 'HIGH' || event.severity === 'CRITICAL';

      for (const staff of xnkStaff) {
        if (staff.id === event.createdBy) continue;
        await this.notificationService.send({
          userId: staff.id,
          title: isUrgent ? 'Van de MHH khan cap' : 'Van de MHH moi',
          body: `Van de ${event.code} (${event.issueType}) duoc tao. Muc do: ${event.severity}.`,
          type: 'MHH_ISSUE',
          referenceId: event.issueId,
          isUrgent,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to process mhh-issue.created for ${event.issueId}: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('mhh-issue.assigned')
  async handleMHHIssueAssigned(event: {
    issueId: string;
    code: string;
    orderId: string;
    previousHandlerId: string | null;
    newHandlerId: string;
    assignedBy: string;
  }) {
    this.logger.log(`MHH issue ${event.code} assigned to ${event.newHandlerId}`);

    try {
      await this.notificationService.send({
        userId: event.newHandlerId,
        title: 'Phan cong xu ly van de MHH',
        body: `Ban duoc phan cong xu ly van de ${event.code}. Vui long kiem tra va xu ly.`,
        type: 'MHH_ISSUE',
        referenceId: event.issueId,
        isUrgent: true,
      });
    } catch (error) {
      this.logger.error(
        `Failed to process mhh-issue.assigned for ${event.issueId}: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('mhh-issue.resolved')
  async handleMHHIssueResolved(event: {
    issueId: string;
    code: string;
    orderId: string;
    resolution: string;
    resolvedBy: string;
  }) {
    this.logger.log(`MHH issue ${event.code} resolved: ${event.resolution}`);

    try {
      // Notify the order's sale person
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: { saleId: true, code: true },
      });

      if (order?.saleId) {
        await this.notificationService.send({
          userId: order.saleId,
          title: 'Van de MHH da giai quyet',
          body: `Van de ${event.code} (don ${order.code}) da duoc giai quyet: ${event.resolution}.`,
          type: 'MHH_ISSUE',
          referenceId: event.issueId,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to process mhh-issue.resolved for ${event.issueId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
