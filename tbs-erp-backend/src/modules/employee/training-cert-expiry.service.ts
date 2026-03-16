import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '@modules/notification/notification.service';
import { UserRole } from '@prisma/client';

/**
 * NS-4: Scheduled task to check for training certificates expiring within 30 days
 * and notify HR Manager and the employee's manager.
 */
@Injectable()
export class TrainingCertExpiryService {
  private readonly logger = new Logger(TrainingCertExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Runs daily at 08:00 to check for certificates expiring within 30 days.
   */
  @Cron('0 8 * * *')
  async checkExpiringCertificates() {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringRecords = await this.prisma.trainingRecord.findMany({
      where: {
        certificateExpiry: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            code: true,
            fullName: true,
            managerId: true,
            userId: true,
            manager: {
              select: { userId: true, fullName: true },
            },
          },
        },
      },
    });

    if (expiringRecords.length === 0) {
      this.logger.log('No training certificates expiring within 30 days');
      return;
    }

    this.logger.log(
      `Found ${expiringRecords.length} training certificates expiring within 30 days`,
    );

    for (const record of expiringRecords) {
      const daysUntilExpiry = Math.ceil(
        (record.certificateExpiry!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      const employee = record.employee;
      const expiryDate = record.certificateExpiry!.toLocaleDateString('vi-VN');

      const notificationBody =
        `Chung chi "${record.courseName}" cua nhan vien ${employee.fullName} (${employee.code}) ` +
        `se het han vao ngay ${expiryDate} (con ${daysUntilExpiry} ngay). ` +
        `Vui long sap xep gia han hoac dao tao lai.`;

      // Notify HR Manager
      await this.notificationService.sendToRole(UserRole.HR_MANAGER, {
        title: `Chung chi sap het han - ${employee.fullName}`,
        body: notificationBody,
        type: 'TRAINING_CERT_EXPIRY',
        referenceId: record.id,
        isUrgent: daysUntilExpiry <= 7,
      });

      // Notify the employee's direct manager if they have a userId
      if (employee.manager?.userId) {
        await this.notificationService.send({
          userId: employee.manager.userId,
          title: `Chung chi sap het han - ${employee.fullName}`,
          body: notificationBody,
          type: 'TRAINING_CERT_EXPIRY',
          referenceId: record.id,
          isUrgent: daysUntilExpiry <= 7,
        });
      }
    }

    this.logger.log(
      `Sent expiry notifications for ${expiringRecords.length} training certificates`,
    );
  }
}
