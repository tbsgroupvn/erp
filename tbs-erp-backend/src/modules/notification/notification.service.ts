import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationChannel } from '@prisma/client';

export interface SendNotificationDto {
  userId: string;
  title: string;
  body: string;
  type?: string;
  channel?: NotificationChannel;
  referenceId?: string;
  isUrgent?: boolean;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Route notification to appropriate channel(s) and persist in DB.
   */
  async send(notification: SendNotificationDto): Promise<void> {
    const channel = notification.channel ?? NotificationChannel.APP_PUSH;

    switch (channel) {
      case NotificationChannel.APP_PUSH:
        await this.sendAppPush(
          notification.userId,
          notification.title,
          notification.body,
          notification.type,
          notification.referenceId,
          notification.isUrgent,
          notification.data,
        );
        break;

      case NotificationChannel.EMAIL: {
        // Persist notification in DB with correct channel
        await this.persistNotification(
          notification.userId,
          notification.title,
          notification.body,
          NotificationChannel.EMAIL,
          notification.type,
          notification.referenceId,
          notification.isUrgent,
          notification.data,
        );
        // Send email
        const user = await this.prisma.user.findUnique({
          where: { id: notification.userId },
          select: { email: true },
        });
        if (user?.email) {
          await this.sendEmail(
            user.email,
            notification.title,
            notification.body,
          );
        }
        break;
      }

      case NotificationChannel.SMS: {
        // Persist notification in DB with correct channel
        await this.persistNotification(
          notification.userId,
          notification.title,
          notification.body,
          NotificationChannel.SMS,
          notification.type,
          notification.referenceId,
          notification.isUrgent,
          notification.data,
        );
        // Send SMS
        const smsUser = await this.prisma.user.findUnique({
          where: { id: notification.userId },
          select: { phone: true },
        });
        if (smsUser?.phone) {
          await this.sendSms(smsUser.phone, notification.body);
        }
        break;
      }

      default:
        await this.sendAppPush(
          notification.userId,
          notification.title,
          notification.body,
          notification.type,
          notification.referenceId,
          notification.isUrgent,
          notification.data,
        );
        break;
    }
  }

  /**
   * Persist a notification record in the database.
   */
  private async persistNotification(
    userId: string,
    title: string,
    body: string,
    channel: NotificationChannel,
    type?: string,
    referenceId?: string,
    isUrgent?: boolean,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.notificationRecord.create({
      data: {
        userId,
        title,
        body,
        type: type ?? 'SYSTEM',
        channel,
        data: (data as any) ?? undefined,
        isRead: false,
      },
    });

    this.logger.log(
      `${channel} notification sent to user ${userId}: ${title}`,
    );
  }

  /**
   * Store notification in DB for in-app push notifications.
   */
  async sendAppPush(
    userId: string,
    title: string,
    body: string,
    type?: string,
    referenceId?: string,
    isUrgent?: boolean,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await this.persistNotification(
      userId, title, body, NotificationChannel.APP_PUSH,
      type, referenceId, isUrgent, data,
    );
  }

  /**
   * Placeholder for email integration.
   * In production, this would integrate with an email provider (SES, SendGrid, etc.).
   */
  async sendEmail(
    email: string,
    subject: string,
    body: string,
  ): Promise<void> {
    // TODO: Integrate with email provider
    this.logger.log(
      `[Email Placeholder] To: ${email}, Subject: ${subject}`,
    );
  }

  /**
   * Placeholder for SMS integration.
   * In production, this would integrate with an SMS provider (Twilio, Zalo ZNS, etc.).
   */
  async sendSms(phone: string, message: string): Promise<void> {
    // TODO: Integrate with SMS provider
    this.logger.log(
      `[SMS Placeholder] To: ${phone}, Message: ${message.substring(0, 50)}...`,
    );
  }

  /**
   * Get paginated notifications for a user.
   */
  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.notificationRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notificationRecord.count({
        where: { userId },
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark a notification as read.
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notificationRecord.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification ${notificationId} not found`,
      );
    }

    if (notification.userId !== userId) {
      throw new NotFoundException(
        `Notification ${notificationId} not found`,
      );
    }

    return this.prisma.notificationRecord.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Get unread notification count for a user.
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notificationRecord.count({
      where: { userId, isRead: false },
    });

    return { count };
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notificationRecord.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return { updated: result.count };
  }

  /**
   * Send notification to all users with a specific role.
   */
  async sendToRole(role: string, notification: Omit<SendNotificationDto, 'userId'>) {
    const users = await this.prisma.user.findMany({
      where: { role: role as any, isActive: true },
      select: { id: true },
    });

    for (const user of users) {
      await this.send({ ...notification, userId: user.id });
    }

    this.logger.log(
      `Notification broadcast to role ${role}: ${users.length} users`,
    );

    return { sent: users.length, role };
  }

  /**
   * Send notification to multiple users.
   */
  async sendBulk(userIds: string[], notification: Omit<SendNotificationDto, 'userId'>) {
    for (const userId of userIds) {
      await this.send({ ...notification, userId });
    }

    this.logger.log(
      `Bulk notification sent to ${userIds.length} users: ${notification.title}`,
    );

    return { sent: userIds.length };
  }

  /**
   * Delete old read notifications (cleanup).
   */
  async deleteOld(daysOld: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.notificationRecord.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });

    this.logger.log(`Deleted ${result.count} old notifications (> ${daysOld} days)`);
    return { deleted: result.count };
  }

  // ---------------------------------------------------------------------------
  // Event Listeners — React to domain events and send notifications
  // ---------------------------------------------------------------------------

  @OnEvent('order.created')
  async handleOrderCreated(event: {
    orderId: string;
    code: string;
    createdBy: string;
    customerId: string;
  }): Promise<void> {
    await this.send({
      userId: event.createdBy,
      title: 'Order Created',
      body: `Order ${event.code} has been created successfully.`,
      type: 'ORDER',
      referenceId: event.orderId,
    });
  }

  @OnEvent('order.status.changed')
  async handleOrderStatusChanged(event: {
    orderId: string;
    code: string;
    changedBy: string;
    fromStatus: string;
    toStatus: string;
  }): Promise<void> {
    await this.send({
      userId: event.changedBy,
      title: 'Order Status Updated',
      body: `Order ${event.code} status changed from ${event.fromStatus} to ${event.toStatus}.`,
      type: 'ORDER',
      referenceId: event.orderId,
    });
  }

  @OnEvent('order.cancelled')
  async handleOrderCancelled(event: {
    orderId: string;
    code: string;
    cancelledBy: string;
    reason: string;
  }): Promise<void> {
    await this.send({
      userId: event.cancelledBy,
      title: 'Order Cancelled',
      body: `Order ${event.code} has been cancelled. Reason: ${event.reason}`,
      type: 'ORDER',
      referenceId: event.orderId,
      isUrgent: true,
    });
  }

  @OnEvent('ar.payment.recorded')
  async handlePaymentReceived(event: {
    arId: string;
    customerId: string;
    paymentAmount: number;
    isFullyPaid: boolean;
  }): Promise<void> {
    // Notify relevant finance staff — find ACCOUNTANT_AR users
    const accountants = await this.prisma.user.findMany({
      where: { role: 'ACCOUNTANT_AR', isActive: true },
      select: { id: true },
    });

    for (const user of accountants) {
      await this.send({
        userId: user.id,
        title: 'Payment Received',
        body: `Payment of ${event.paymentAmount.toLocaleString()} VND recorded. ${event.isFullyPaid ? 'Fully paid.' : 'Partial payment.'}`,
        type: 'PAYMENT',
        referenceId: event.arId,
      });
    }
  }

  @OnEvent('approval.submitted')
  async handleApprovalSubmitted(event: {
    approvalId: string;
    type: string;
    referenceId: string;
    requestedBy: string;
    currentStepRole: string;
  }): Promise<void> {
    // Notify users with the required role for the current step
    const approvers = await this.prisma.user.findMany({
      where: { role: event.currentStepRole as any, isActive: true },
      select: { id: true },
    });

    for (const user of approvers) {
      await this.send({
        userId: user.id,
        title: 'New Approval Request',
        body: `A new ${event.type} approval request is waiting for your review.`,
        type: 'APPROVAL',
        referenceId: event.approvalId,
        isUrgent: true,
      });
    }
  }

  @OnEvent('approval.completed')
  async handleApprovalCompleted(event: {
    approvalId: string;
    type: string;
    referenceId: string;
    status: string;
  }): Promise<void> {
    // Notify the requester
    const approval = await this.prisma.approval.findUnique({
      where: { id: event.approvalId },
      select: { requestedBy: true, referenceCode: true },
    });

    if (approval) {
      await this.send({
        userId: approval.requestedBy,
        title: `Approval ${event.status}`,
        body: `Your ${event.type} request (${approval.referenceCode ?? event.referenceId}) has been ${event.status.toLowerCase()}.`,
        type: 'APPROVAL',
        referenceId: event.approvalId,
        isUrgent: event.status === 'REJECTED',
      });
    }
  }

  @OnEvent('approval.overdue')
  async handleApprovalOverdue(event: {
    approvalId: string;
    type: string;
    referenceCode?: string;
    currentStepRole: string;
  }): Promise<void> {
    const approvers = await this.prisma.user.findMany({
      where: { role: event.currentStepRole as any, isActive: true },
      select: { id: true },
    });

    for (const user of approvers) {
      await this.send({
        userId: user.id,
        title: 'Overdue Approval Reminder',
        body: `Approval for ${event.type} (${event.referenceCode ?? event.approvalId}) is overdue. Please review.`,
        type: 'APPROVAL',
        referenceId: event.approvalId,
        isUrgent: true,
      });
    }
  }

  @OnEvent('sla.breached')
  async handleSLABreached(event: {
    type: string;
    referenceId: string;
    referenceCode: string;
    assignedTo?: string;
  }): Promise<void> {
    if (event.assignedTo) {
      await this.send({
        userId: event.assignedTo,
        title: 'SLA Breach Alert',
        body: `SLA breached for ${event.type} on order ${event.referenceCode}. Please take immediate action.`,
        type: 'ALERT',
        referenceId: event.referenceId,
        isUrgent: true,
      });
    }
  }

  @OnEvent('ar.aging.approaching')
  async handleArAgingApproaching(event: {
    arCode: string;
    saleId?: string;
    customerName?: string;
    outstanding: number;
    dueDate: Date;
  }): Promise<void> {
    if (event.saleId) {
      await this.send({
        userId: event.saleId,
        title: 'AR Due Date Approaching',
        body: `AR ${event.arCode} for ${event.customerName} (${event.outstanding.toLocaleString()} VND) is due on ${event.dueDate.toLocaleDateString()}.`,
        type: 'FINANCE',
        isUrgent: false,
      });
    }
  }

  @OnEvent('ar.aging.overdue')
  async handleArAgingOverdue(event: {
    arCode: string;
    saleId?: string;
    customerName?: string;
    outstanding: number;
    daysOverdue: number;
    notifyRoles: string[];
  }): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { role: { in: event.notifyRoles as any[] }, isActive: true },
      select: { id: true },
    });

    for (const user of users) {
      await this.send({
        userId: user.id,
        title: 'AR Overdue Alert',
        body: `AR ${event.arCode} for ${event.customerName} is ${event.daysOverdue} day(s) overdue. Outstanding: ${event.outstanding.toLocaleString()} VND.`,
        type: 'FINANCE',
        isUrgent: true,
      });
    }
  }

  @OnEvent('ar.aging.critical')
  async handleArAgingCritical(event: {
    arCode: string;
    customerName?: string;
    outstanding: number;
    daysOverdue: number;
    notifyRoles: string[];
  }): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { role: { in: event.notifyRoles as any[] }, isActive: true },
      select: { id: true },
    });

    for (const user of users) {
      await this.send({
        userId: user.id,
        title: 'CRITICAL: AR 30+ Days Overdue',
        body: `AR ${event.arCode} for ${event.customerName} is ${event.daysOverdue} day(s) overdue. Outstanding: ${event.outstanding.toLocaleString()} VND. Requires executive review.`,
        type: 'FINANCE',
        isUrgent: true,
      });
    }
  }

  @OnEvent('auth.password.reset.requested')
  async handlePasswordResetRequested(event: {
    userId: string;
    email: string;
    fullName: string;
    resetToken: string;
  }): Promise<void> {
    // In production, send actual email with reset link
    await this.sendEmail(
      event.email,
      'Password Reset Request',
      `Hello ${event.fullName}, use the following token to reset your password: ${event.resetToken}`,
    );
  }
}
