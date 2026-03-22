import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@core/database/prisma.service';
import {
  RetentionPolicyDto,
  RetentionReportDto,
  UserDataExportDto,
} from './dto/retention-policy.dto';

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // Scheduled Execution — Runs daily at midnight
  // =========================================================================

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'data-retention-cleanup',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async executeRetentionPolicies(
    executedBy?: string,
    entities?: string[],
  ): Promise<RetentionReportDto> {
    const startTime = Date.now();
    const errors: string[] = [];

    this.logger.log('Starting data retention policy execution...');

    let auditLogsArchived = 0;
    let sessionsDeleted = 0;
    let ordersArchived = 0;
    let tempFilesDeleted = 0;
    let notificationsDeleted = 0;
    let tokensDeleted = 0;
    let usersAnonymized = 0;

    const shouldRun = (entity: string) => !entities || entities.includes(entity);

    // 1. Archive old audit logs (> 2 years)
    if (shouldRun('AuditLog')) {
      try {
        auditLogsArchived = await this.archiveAuditLogs();
        this.logger.log(`Archived ${auditLogsArchived} audit logs`);
      } catch (error) {
        const msg = `Failed to archive audit logs: ${error.message}`;
        this.logger.error(msg, error.stack);
        errors.push(msg);
      }
    }

    // 2. Delete expired sessions (> 30 days inactive)
    if (shouldRun('Session')) {
      try {
        sessionsDeleted = await this.cleanExpiredSessions();
        this.logger.log(`Deleted ${sessionsDeleted} expired sessions`);
      } catch (error) {
        const msg = `Failed to clean expired sessions: ${error.message}`;
        this.logger.error(msg, error.stack);
        errors.push(msg);
      }
    }

    // 3. Archive completed orders (> 5 years, per Vietnamese tax law — Luat Ke toan 2015, Art. 41)
    if (shouldRun('Order')) {
      try {
        ordersArchived = await this.flagOldOrders();
        this.logger.log(`Flagged ${ordersArchived} old orders for archive review`);
      } catch (error) {
        const msg = `Failed to process old orders: ${error.message}`;
        this.logger.error(msg, error.stack);
        errors.push(msg);
      }
    }

    // 4. Clean temporary files/uploads (> 30 days)
    if (shouldRun('TempFile')) {
      try {
        tempFilesDeleted = await this.cleanTempFiles();
        this.logger.log(`Deleted ${tempFilesDeleted} temporary files`);
      } catch (error) {
        const msg = `Failed to clean temp files: ${error.message}`;
        this.logger.error(msg, error.stack);
        errors.push(msg);
      }
    }

    // 5. Clean old read notifications (> 90 days)
    if (shouldRun('Notification')) {
      try {
        notificationsDeleted = await this.cleanOldNotifications();
        this.logger.log(`Deleted ${notificationsDeleted} old notifications`);
      } catch (error) {
        const msg = `Failed to clean old notifications: ${error.message}`;
        this.logger.error(msg, error.stack);
        errors.push(msg);
      }
    }

    // 6. Clean expired password reset tokens (> 1 day)
    if (shouldRun('PasswordResetToken')) {
      try {
        tokensDeleted = await this.cleanExpiredResetTokens();
        this.logger.log(`Cleaned ${tokensDeleted} expired reset tokens`);
      } catch (error) {
        const msg = `Failed to clean expired tokens: ${error.message}`;
        this.logger.error(msg, error.stack);
        errors.push(msg);
      }
    }

    // 7. Anonymize soft-deleted users
    if (shouldRun('AnonymizedUser')) {
      try {
        usersAnonymized = await this.anonymizeDeletedUsers();
        this.logger.log(`Anonymized ${usersAnonymized} deleted users`);
      } catch (error) {
        const msg = `Failed to anonymize deleted users: ${error.message}`;
        this.logger.error(msg, error.stack);
        errors.push(msg);
      }
    }

    const durationMs = Date.now() - startTime;

    // Persist the report
    const report = await this.prisma.dataRetentionReport.create({
      data: {
        executedBy: executedBy || null,
        trigger: executedBy ? 'MANUAL' : 'SCHEDULED',
        auditLogsArchived,
        sessionsDeleted,
        ordersArchived,
        tempFilesDeleted,
        notificationsDeleted,
        tokensDeleted,
        usersAnonymized,
        durationMs,
        errors: errors.length > 0 ? JSON.stringify(errors) : null,
      },
    });

    this.logger.log(
      `Data retention policy execution completed in ${durationMs}ms. Report ID: ${report.id}`,
    );

    return report as RetentionReportDto;
  }

  // =========================================================================
  // Individual Retention Operations
  // =========================================================================

  /**
   * Archive audit logs older than 2 years.
   * Moves records from audit_logs to audit_log_archives, then deletes originals.
   * Retention: 2 years in active table, indefinite in archive.
   */
  private async archiveAuditLogs(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);

    // Process in batches to avoid memory issues
    const batchSize = 1000;
    let totalArchived = 0;

    while (true) {
      const oldLogs = await this.prisma.auditLog.findMany({
        where: { createdAt: { lt: cutoffDate } },
        take: batchSize,
      });

      if (oldLogs.length === 0) break;

      await this.prisma.$transaction(async (tx) => {
        // Insert into archive table
        await tx.auditLogArchive.createMany({
          data: oldLogs.map((log) => ({
            id: log.id,
            userId: log.userId ?? undefined,
            action: log.action,
            entity: log.entity,
            entityId: log.entityId,
            oldData: log.oldData ?? undefined,
            newData: log.newData ?? undefined,
            ipAddress: log.ipAddress,
            createdAt: log.createdAt,
          })),
          skipDuplicates: true,
        });

        // Delete from main table
        await tx.auditLog.deleteMany({
          where: { id: { in: oldLogs.map((l) => l.id) } },
        });
      });

      totalArchived += oldLogs.length;

      // Safety: if we got less than batch size, we're done
      if (oldLogs.length < batchSize) break;
    }

    return totalArchived;
  }

  /**
   * Delete sessions that have expired more than 30 days ago.
   */
  private async cleanExpiredSessions(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const result = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: cutoffDate } },
    });

    return result.count;
  }

  /**
   * Flag old completed orders for review.
   * NOTE: Vietnamese tax law (Luật Kế toán 2015, Điều 41) requires financial records
   * to be kept for a minimum of 5 years. Orders older than 5 years with COMPLETED
   * status are flagged. Financial records (invoices, payment vouchers) are NEVER deleted.
   */
  private async flagOldOrders(): Promise<number> {
    // Use 5 years (not 3) to comply with Vietnamese tax law
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 5);

    // We only count completed orders older than 5 years for reporting.
    // Actual deletion is NOT performed — financial records must be retained.
    const count = await this.prisma.order.count({
      where: {
        status: 'COMPLETED',
        createdAt: { lt: cutoffDate },
      },
    });

    // Log for compliance review — no automatic deletion of financial data
    if (count > 0) {
      this.logger.warn(
        `Found ${count} completed orders older than 5 years. ` +
          `Per Vietnamese tax law (Luật Kế toán 2015, Art. 41), these records are retained. ` +
          `Manual review recommended.`,
      );
    }

    return count;
  }

  /**
   * Clean temporary file records older than 30 days.
   * Only removes soft-deleted documents and orphaned temp records.
   */
  private async cleanTempFiles(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const result = await this.prisma.document.deleteMany({
      where: {
        isDeleted: true,
        updatedAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  /**
   * Delete read notifications older than 90 days.
   */
  private async cleanOldNotifications(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const result = await this.prisma.notification.deleteMany({
      where: {
        isRead: true,
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  /**
   * Clean expired password reset tokens (older than 1 day).
   * Nullifies resetToken and resetTokenExpiry fields.
   */
  private async cleanExpiredResetTokens(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 1);

    const result = await this.prisma.user.updateMany({
      where: {
        resetTokenExpiry: { lt: cutoffDate },
        resetToken: { not: null },
      },
      data: {
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return result.count;
  }

  /**
   * Anonymize inactive users who have been deactivated for more than 30 days.
   * Per NĐ 13/2023/NĐ-CP Article 16 — Right to deletion/anonymization.
   * Financial records (orders, invoices, payments) are preserved with anonymized references
   * to comply with Vietnamese tax law requirements.
   */
  private async anonymizeDeletedUsers(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    // Find users who are inactive and were updated more than 30 days ago
    const usersToAnonymize = await this.prisma.user.findMany({
      where: {
        isActive: false,
        updatedAt: { lt: cutoffDate },
        // Only process users whose email is not already anonymized
        NOT: { email: { startsWith: 'anonymized_' } },
      },
      select: { id: true },
    });

    let anonymizedCount = 0;

    for (const user of usersToAnonymize) {
      try {
        await this.anonymizeUserData(
          user.id,
          'Automated retention policy — 30-day inactive threshold',
        );
        anonymizedCount++;
      } catch (error) {
        this.logger.error(`Failed to anonymize user ${user.id}: ${error.message}`);
      }
    }

    return anonymizedCount;
  }

  // =========================================================================
  // GDPR / NĐ 13 Compliance Operations
  // =========================================================================

  /**
   * Anonymize a specific user's personal data.
   * NĐ 13/2023/NĐ-CP Article 16 — Right to deletion.
   *
   * Personal data is replaced with anonymized values.
   * Financial and transaction records are RETAINED (tax law requirement)
   * but PII is removed from them.
   */
  async anonymizeUserData(userId: string, reason: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const anonymizedSuffix = userId.substring(0, 8);
    const anonymizedEmail = `anonymized_${anonymizedSuffix}@deleted.local`;
    const anonymizedName = `Anonymized User ${anonymizedSuffix}`;

    await this.prisma.$transaction(async (tx) => {
      // 1. Anonymize user record
      await tx.user.update({
        where: { id: userId },
        data: {
          email: anonymizedEmail,
          phone: null,
          fullName: anonymizedName,
          passwordHash: 'ANONYMIZED',
          isActive: false,
          is2FAEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: [],
          phoneNumber: null,
          resetToken: null,
          resetTokenExpiry: null,
          saleCode: null,
        },
      });

      // 2. Delete all active sessions
      await tx.session.deleteMany({
        where: { userId },
      });

      // 3. Revoke all consents
      await tx.userConsent.updateMany({
        where: { userId, granted: true },
        data: {
          granted: false,
          revokedAt: new Date(),
        },
      });

      // 4. Anonymize employee record if exists
      const employee = await tx.employee.findFirst({
        where: { userId },
      });

      if (employee) {
        await tx.employee.update({
          where: { id: employee.id },
          data: {
            fullName: anonymizedName,
            email: null,
            phone: null,
            bankAccount: null,
            bankName: null,
            taxCode: null,
            insuranceId: null,
          },
        });
      }

      // 5. Create audit log for the anonymization action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'ANONYMIZE',
          entity: 'User',
          entityId: userId,
          newData: {
            reason,
            anonymizedAt: new Date().toISOString(),
            legalBasis: 'NĐ 13/2023/NĐ-CP Article 16 — Right to deletion',
          },
          ipAddress: 'SYSTEM',
        },
      });
    });

    this.logger.log(`User ${userId} data anonymized. Reason: ${reason}`);
  }

  /**
   * Export all data related to a user.
   * NĐ 13/2023/NĐ-CP Article 14 — Right to data portability.
   *
   * Returns a structured JSON export of all user data across the system.
   */
  async exportUserData(userId: string, exportedBy: string): Promise<UserDataExportDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        role: true,
        branch: true,
        saleCode: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        // Exclude sensitive fields: passwordHash, twoFactorSecret, twoFactorBackupCodes
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Collect related data
    const [sessions, auditLogs, consents, orders, tasks, notifications] = await Promise.all([
      this.prisma.session.findMany({
        where: { userId },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
      this.prisma.auditLog.findMany({
        where: { userId },
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          ipAddress: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1000, // Limit to most recent 1000
      }),
      this.prisma.userConsent.findMany({
        where: { userId },
        select: {
          id: true,
          consentType: true,
          granted: true,
          grantedAt: true,
          revokedAt: true,
          version: true,
          createdAt: true,
        },
      }),
      this.prisma.order.findMany({
        where: { saleId: userId },
        select: {
          id: true,
          code: true,
          serviceType: true,
          status: true,
          branch: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      this.prisma.task.findMany({
        where: { assigneeId: userId },
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      this.prisma.notification.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          body: true,
          type: true,
          isRead: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);

    const totalRecords =
      1 + // user profile
      sessions.length +
      auditLogs.length +
      consents.length +
      orders.length +
      tasks.length +
      notifications.length;

    // Log the export action for compliance audit trail
    await this.prisma.auditLog.create({
      data: {
        userId: exportedBy,
        action: 'EXPORT_USER_DATA',
        entity: 'User',
        entityId: userId,
        newData: {
          exportedAt: new Date().toISOString(),
          totalRecords,
          legalBasis: 'NĐ 13/2023/NĐ-CP Article 14 — Right to data portability',
        },
        ipAddress: 'SYSTEM',
      },
    });

    return {
      profile: user,
      sessions,
      auditLogs,
      consents,
      orders,
      tasks,
      notifications,
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedBy,
        format: 'JSON',
        totalRecords,
      },
    };
  }

  // =========================================================================
  // Policy Configuration
  // =========================================================================

  /**
   * Returns the configured data retention policies.
   * These align with:
   * - Vietnamese tax law (Luật Kế toán 2015, Art. 41): 5-year minimum for financial records
   * - NĐ 13/2023/NĐ-CP: Data minimization and right to deletion
   * - ISO 27001 A.8 Asset Management: Data lifecycle management
   */
  getRetentionPolicies(): RetentionPolicyDto[] {
    return [
      {
        entity: 'AuditLog',
        retentionDays: 730,
        action: 'archive',
        description:
          'Audit logs archived after 2 years. Archives retained indefinitely for compliance.',
        legalBasis: 'ISO 27001 A.12 Operations Security; NĐ 13/2023 Article 26',
      },
      {
        entity: 'Session',
        retentionDays: 30,
        action: 'delete',
        description: 'Expired sessions cleaned 30 days after expiration.',
        legalBasis: 'NĐ 13/2023 Article 11 — Data minimization',
      },
      {
        entity: 'Order',
        retentionDays: 1825,
        action: 'archive',
        description:
          'Completed orders retained for minimum 5 years per Vietnamese tax law. No automatic deletion.',
        legalBasis: 'Luật Kế toán 2015, Điều 41 — Thời hạn lưu trữ chứng từ kế toán',
      },
      {
        entity: 'TempFile',
        retentionDays: 30,
        action: 'delete',
        description: 'Soft-deleted temporary files/documents cleaned after 30 days.',
        legalBasis: 'NĐ 13/2023 Article 11 — Data minimization',
      },
      {
        entity: 'Notification',
        retentionDays: 90,
        action: 'delete',
        description: 'Read notifications cleaned after 90 days.',
        legalBasis: 'NĐ 13/2023 Article 11 — Data minimization',
      },
      {
        entity: 'PasswordResetToken',
        retentionDays: 1,
        action: 'delete',
        description: 'Expired password reset tokens cleaned daily.',
        legalBasis: 'ISO 27001 A.9 Access Control — Credential lifecycle',
      },
      {
        entity: 'FinancialRecord',
        retentionDays: 3650,
        action: 'archive',
        description:
          'Financial records (invoices, payment vouchers, receipts) retained for minimum 10 years. No automatic deletion.',
        legalBasis: 'Luật Kế toán 2015, Điều 41 — Chứng từ kế toán có tính lịch sử',
      },
      {
        entity: 'AnonymizedUser',
        retentionDays: 30,
        action: 'delete',
        description:
          'Inactive users anonymized 30 days after deactivation. Transaction records retained.',
        legalBasis: 'NĐ 13/2023 Article 16 — Right to deletion/anonymization',
      },
    ];
  }

  // =========================================================================
  // Reports
  // =========================================================================

  /**
   * Get past retention execution reports.
   */
  async getReports(
    page = 1,
    limit = 20,
  ): Promise<{
    data: RetentionReportDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.dataRetentionReport.findMany({
        orderBy: { executedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.dataRetentionReport.count(),
    ]);

    return {
      data: data as RetentionReportDto[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
