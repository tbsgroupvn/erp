import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '@modules/notification/notification.service';

@Injectable()
export class CustomsReminderService {
  private readonly logger = new Logger(CustomsReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Daily 8:00 AM VN time (01:00 UTC): check declarations needing action.
   * 1. DRAFT declarations older than 3 days -> warn XNK team
   * 2. Arrived containers without declaration -> critical alert
   * 3. RED channel declarations stale > 5 days -> escalate to management
   */
  @Cron('0 1 * * *', { name: 'customs-declaration-reminder' })
  async checkPendingDeclarations(): Promise<void> {
    this.logger.log('Running customs declaration reminder check');

    await Promise.all([
      this.checkStaleDrafts(),
      this.checkContainersWithoutDeclaration(),
      this.checkRedChannelStale(),
    ]);
  }

  /**
   * Every 4 hours: check SLA for submitted declarations without channel assignment.
   * P2-1: Auto-reject declarations >48h without channel (SLA expiry).
   */
  @Cron('0 */4 * * *', { name: 'customs-sla-warning' })
  async checkSLAApproaching(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 3600_000);
    const twoDaysAgo = new Date(Date.now() - 48 * 3600_000);

    const noChannel = await this.prisma.customsDeclaration.findMany({
      where: {
        status: 'SUBMITTED',
        channel: null,
        updatedAt: { lt: oneDayAgo },
      },
      select: { id: true, code: true, updatedAt: true },
      take: 50,
    });

    if (noChannel.length === 0) return;

    // Split: >48h → auto-reject, 24-48h → warning only
    const expiredDecls = noChannel.filter((d) => d.updatedAt < twoDaysAgo);
    const warningDecls = noChannel.filter((d) => d.updatedAt >= twoDaysAgo);

    // P2-1: Auto-reject expired declarations (>48h without channel)
    if (expiredDecls.length > 0) {
      this.logger.warn(
        `Auto-rejecting ${expiredDecls.length} declarations >48h without channel assignment`,
      );

      for (const decl of expiredDecls) {
        try {
          await this.prisma.customsDeclaration.update({
            where: { id: decl.id },
            data: {
              status: 'REJECTED',
              note: 'Tự động từ chối: quá 48h chưa phân kênh hải quan. Vui lòng tạo lại tờ khai.',
            },
          });
        } catch (err) {
          this.logger.error(`Failed to auto-reject declaration ${decl.code}: ${err.message}`);
        }
      }

      const rejectNotification = {
        title: `${expiredDecls.length} tờ khai bị tự động từ chối`,
        body:
          `${expiredDecls.length} tờ khai đã quá 48h chưa phân kênh và bị tự động từ chối. ` +
          `Mã: ${expiredDecls.map((d) => d.code).join(', ')}. Vui lòng tạo lại.`,
        type: 'CUSTOMS',
        referenceId: 'customs-sla-expired',
        isUrgent: true,
      };

      await Promise.all([
        this.notificationService.sendToRole('XNK_MANAGER', rejectNotification),
        this.notificationService.sendToRole('LOGISTICS_MANAGER', rejectNotification),
      ]);
    }

    // Warning for 24-48h declarations
    if (warningDecls.length > 0) {
      this.logger.warn(
        `${warningDecls.length} declarations submitted >24h without channel assignment`,
      );

      const notification = {
        title: `${warningDecls.length} tờ khai chưa phân kênh`,
        body: `Có ${warningDecls.length} tờ khai đã gửi hơn 24h nhưng chưa được phân kênh. Kiểm tra hệ thống ECUS.`,
        type: 'CUSTOMS',
        referenceId: 'customs-sla',
      };

      await Promise.all([
        this.notificationService.sendToRole('XNK_MANAGER', notification),
        this.notificationService.sendToRole('XNK_STAFF', notification),
      ]);
    }
  }

  private async checkStaleDrafts(): Promise<void> {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400_000);

    const staleDrafts = await this.prisma.customsDeclaration.findMany({
      where: {
        status: 'DRAFT',
        createdAt: { lt: threeDaysAgo },
      },
      select: { id: true, code: true },
      take: 50,
    });

    if (staleDrafts.length === 0) return;

    this.logger.warn(
      `${staleDrafts.length} customs declarations stuck in DRAFT >3 days`,
    );

    for (const decl of staleDrafts) {
      const notification = {
        title: `Tờ khai ${decl.code} quá hạn soạn`,
        body: `Tờ khai ${decl.code} đã ở trạng thái DRAFT hơn 3 ngày. Vui lòng xử lý.`,
        type: 'CUSTOMS',
        referenceId: decl.id,
      };

      await Promise.all([
        this.notificationService.sendToRole('XNK_MANAGER', notification),
        this.notificationService.sendToRole('XNK_STAFF', notification),
      ]);
    }
  }

  private async checkContainersWithoutDeclaration(): Promise<void> {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400_000);

    // Containers that arrived >2 days ago but have no linked customs declaration
    const containers = await this.prisma.container.findMany({
      where: {
        status: 'ARRIVED',
        actualArrivalAt: { lt: twoDaysAgo },
        customsDeclarations: { none: {} },
      },
      select: { id: true, code: true },
      take: 50,
    });

    if (containers.length === 0) return;

    this.logger.warn(
      `${containers.length} arrived containers without customs declaration`,
    );

    for (const container of containers) {
      const notification = {
        title: `Container ${container.code} chưa có tờ khai`,
        body: `Container ${container.code} đã đến cảng hơn 2 ngày nhưng chưa tạo tờ khai hải quan.`,
        type: 'CUSTOMS',
        referenceId: container.id,
      };

      await Promise.all([
        this.notificationService.sendToRole('XNK_MANAGER', notification),
        this.notificationService.sendToRole('XNK_STAFF', notification),
        this.notificationService.sendToRole('LOGISTICS_MANAGER', notification),
      ]);
    }
  }

  private async checkRedChannelStale(): Promise<void> {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400_000);

    const redChannelStale = await this.prisma.customsDeclaration.findMany({
      where: {
        channel: 'RED',
        status: { in: ['SUBMITTED', 'INSPECTING'] },
        updatedAt: { lt: fiveDaysAgo },
      },
      select: { id: true, code: true },
      take: 50,
    });

    if (redChannelStale.length === 0) return;

    this.logger.warn(
      `${redChannelStale.length} RED channel declarations stale >5 days`,
    );

    for (const decl of redChannelStale) {
      const notification = {
        title: `Tờ khai ${decl.code} kênh ĐỎ chậm xử lý`,
        body: `Tờ khai ${decl.code} (kênh ĐỎ) đang chờ xử lý hơn 5 ngày. Cần can thiệp.`,
        type: 'CUSTOMS',
        referenceId: decl.id,
        isUrgent: true,
      };

      await Promise.all([
        this.notificationService.sendToRole('XNK_MANAGER', notification),
        this.notificationService.sendToRole('LOGISTICS_MANAGER', notification),
        this.notificationService.sendToRole('COO', notification),
      ]);
    }
  }
}
