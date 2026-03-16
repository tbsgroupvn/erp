import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { DomainEvents } from '@common/patterns/domain-events';
import { NotificationService } from '@modules/notification/notification.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class EmployeeStatusListener {
  private readonly logger = new Logger(EmployeeStatusListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  @OnEvent(DomainEvents.EMPLOYEE_STATUS_CHANGED)
  async handleEmployeeStatusChange(payload: {
    employeeId: string;
    oldStatus: string;
    newStatus: string;
  }) {
    const { employeeId, newStatus } = payload;

    try {
      // KT-6: Thu hồi hoa hồng khi NV nghỉ việc
      if (newStatus === 'RESIGNED' || newStatus === 'TERMINATED') {
        await this.handleCommissionClawback(employeeId, newStatus);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process employee status change for ${employeeId} -> ${newStatus}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * KT-6: When an employee resigns or is terminated, check for pending
   * commission records with clawback amounts. Mark them as CLAWBACK_PENDING
   * and alert both HR Manager and Chief Accountant.
   */
  private async handleCommissionClawback(employeeId: string, newStatus: string) {
    // Fetch employee details for richer notification messages
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, code: true, fullName: true, departmentCode: true },
    });

    const employeeLabel = employee ? `${employee.fullName} (${employee.code})` : employeeId;

    const pendingCommissions = await this.prisma.commissionRecord.findMany({
      where: {
        saleId: employeeId,
        status: { not: 'PAID' },
        clawbackAmount: { gt: 0 },
      },
      select: {
        id: true,
        clawbackAmount: true,
        commissionAmount: true,
        orderId: true,
        status: true,
      },
    });

    if (pendingCommissions.length === 0) {
      this.logger.log(
        `Employee ${employeeLabel} ${newStatus}: no pending commissions to claw back`,
      );
      return;
    }

    const totalClawback = pendingCommissions.reduce((sum, c) => sum + Number(c.clawbackAmount), 0);

    const totalOriginal = pendingCommissions.reduce(
      (sum, c) => sum + Number(c.commissionAmount),
      0,
    );

    // Mark commission records as CLAWBACK_PENDING
    await this.prisma.commissionRecord.updateMany({
      where: {
        id: { in: pendingCommissions.map((c) => c.id) },
      },
      data: {
        status: 'ON_HOLD', // Hold for clawback review
      },
    });

    const statusLabel = newStatus === 'RESIGNED' ? 'nghỉ việc' : 'bị chấm dứt hợp đồng';
    const notificationBody =
      `Nhân viên ${employeeLabel} đã ${statusLabel}. ` +
      `Có ${pendingCommissions.length} khoản hoa hồng cần thu hồi:\n` +
      `- Tổng hoa hồng gốc: ${totalOriginal.toLocaleString()} VND\n` +
      `- Tổng cần thu hồi: ${totalClawback.toLocaleString()} VND\n` +
      `Vui lòng xử lý thu hồi và quyết toán.`;

    // Alert Chief Accountant
    await this.notificationService.sendToRole(UserRole.CHIEF_ACCOUNTANT, {
      title: `Thu hồi hoa hồng - ${employeeLabel}`,
      body: notificationBody,
      type: 'COMMISSION_CLAWBACK',
      referenceId: employeeId,
      isUrgent: true,
    });

    // Alert HR Manager
    await this.notificationService.sendToRole(UserRole.HR_MANAGER, {
      title: `Thu hồi hoa hồng - ${employeeLabel}`,
      body: notificationBody,
      type: 'COMMISSION_CLAWBACK',
      referenceId: employeeId,
      isUrgent: true,
    });

    this.logger.warn(
      `Employee ${employeeLabel} ${newStatus}: ${pendingCommissions.length} commission records marked ON_HOLD for clawback, total: ${totalClawback.toLocaleString()} VND`,
    );
  }
}
