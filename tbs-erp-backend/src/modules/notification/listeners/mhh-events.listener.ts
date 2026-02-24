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

    // Notify XNK managers about new supplier order
    const xnkManagers = await this.prisma.user.findMany({
      where: { role: 'XNK_MANAGER', isActive: true },
      select: { id: true },
    });

    for (const manager of xnkManagers) {
      if (manager.id === event.createdBy) continue;
      await this.notificationService.send({
        userId: manager.id,
        title: 'Đơn NCC mới',
        body: `Đơn NCC ${event.code} cho NCC "${event.supplierName}" đã được tạo.`,
        type: 'SUPPLIER_ORDER',
        referenceId: event.supplierOrderId,
      });
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
      `Supplier order ${event.code} status: ${event.previousStatus} → ${event.newStatus}`,
    );

    // If status is ISSUE, notify XNK managers urgently
    if (event.newStatus === 'ISSUE') {
      const xnkManagers = await this.prisma.user.findMany({
        where: { role: 'XNK_MANAGER', isActive: true },
        select: { id: true },
      });

      for (const manager of xnkManagers) {
        await this.notificationService.send({
          userId: manager.id,
          title: 'Đơn NCC có vấn đề',
          body: `Đơn NCC ${event.code} gặp sự cố. Trước đó: ${event.previousStatus}.`,
          type: 'SUPPLIER_ORDER',
          referenceId: event.supplierOrderId,
          isUrgent: true,
        });
      }
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

    // Notify the order's sale person
    const order = await this.prisma.order.findUnique({
      where: { id: event.orderId },
      select: { saleId: true, code: true },
    });

    if (order) {
      await this.notificationService.send({
        userId: order.saleId,
        title: 'Hàng NCC đã nhận',
        body: `Đơn NCC ${event.code} (đơn hàng ${order.code}) đã được kho TQ nhận hàng.${event.quantityReceived ? ` SL: ${event.quantityReceived}` : ''}`,
        type: 'SUPPLIER_ORDER',
        referenceId: event.supplierOrderId,
      });
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
        title: isUrgent ? 'Vấn đề MHH khẩn cấp' : 'Vấn đề MHH mới',
        body: `Vấn đề ${event.code} (${event.issueType}) được tạo. Mức độ: ${event.severity}.`,
        type: 'MHH_ISSUE',
        referenceId: event.issueId,
        isUrgent,
      });
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

    await this.notificationService.send({
      userId: event.newHandlerId,
      title: 'Phân công xử lý vấn đề MHH',
      body: `Bạn được phân công xử lý vấn đề ${event.code}. Vui lòng kiểm tra và xử lý.`,
      type: 'MHH_ISSUE',
      referenceId: event.issueId,
      isUrgent: true,
    });
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

    // Notify the order's sale person
    const order = await this.prisma.order.findUnique({
      where: { id: event.orderId },
      select: { saleId: true, code: true },
    });

    if (order) {
      await this.notificationService.send({
        userId: order.saleId,
        title: 'Vấn đề MHH đã giải quyết',
        body: `Vấn đề ${event.code} (đơn ${order.code}) đã được giải quyết: ${event.resolution}.`,
        type: 'MHH_ISSUE',
        referenceId: event.issueId,
      });
    }
  }
}
