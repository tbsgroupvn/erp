import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '../notification.service';

/**
 * Listens for approval-related events not already handled by the
 * NotificationService's inline @OnEvent handlers.
 *
 * (approval.submitted, approval.completed, approval.overdue are handled in the service)
 * This listener handles: leave.requested, leave.approved
 */
@Injectable()
export class ApprovalEventsListener {
  private readonly logger = new Logger(ApprovalEventsListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('leave.requested')
  async handleLeaveRequested(event: {
    leaveId: string;
    employeeId: string;
    type: string;
    totalDays: number;
  }) {
    this.logger.log(`Leave requested: ${event.type} for ${event.totalDays} days`);

    // Find the employee's manager
    const employee = await this.prisma.employee.findUnique({
      where: { id: event.employeeId },
      select: { managerId: true, fullName: true, code: true, manager: { select: { userId: true } } },
    });

    if (employee?.manager?.userId) {
      await this.notificationService.send({
        userId: employee.manager.userId,
        title: 'Leave Request',
        body: `${employee.fullName} (${employee.code}) has submitted a ${event.type} leave request for ${event.totalDays} day(s).`,
        type: 'APPROVAL',
        referenceId: event.leaveId,
      });
    }
  }

  @OnEvent('leave.approved')
  async handleLeaveApproved(event: {
    leaveId: string;
    employeeId: string;
    approverId: string;
  }) {
    this.logger.log(`Leave approved: ${event.leaveId}`);

    const employee = await this.prisma.employee.findUnique({
      where: { id: event.employeeId },
      select: { userId: true },
    });

    if (employee?.userId) {
      await this.notificationService.send({
        userId: employee.userId,
        title: 'Leave Request Approved',
        body: 'Your leave request has been approved.',
        type: 'APPROVAL',
        referenceId: event.leaveId,
      });
    }
  }
}
