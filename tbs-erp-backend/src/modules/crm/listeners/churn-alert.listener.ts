import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationChannel, NotificationType } from '@prisma/client';
import { ChurnAlertEvent } from '../domain/customer-analytics.service';

// Nguong canh bao chi gui thong bao khi muc rui ro tang (tranh spam)
const HIGH_RISK_LEVELS = new Set(['HIGH', 'CRITICAL']);

@Injectable()
export class ChurnAlertListener {
  private readonly logger = new Logger(ChurnAlertListener.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Xu ly su kien canh bao roi bo hang loat sau khi cron job tinh xong.
   * Chi gui thong bao neu:
   *   1. Muc rui ro la HIGH hoac CRITICAL
   *   2. Khach hang co Sale phu trach (saleId != null)
   */
  @OnEvent('crm.churn.alert.batch')
  async handleChurnAlertBatch(alerts: ChurnAlertEvent[]): Promise<void> {
    if (!alerts || alerts.length === 0) return;

    this.logger.log(`Xu ly ${alerts.length} canh bao roi bo khach hang...`);

    let sent = 0;
    let skipped = 0;

    for (const alert of alerts) {
      try {
        // Bo qua neu khong co Sale phu trach
        if (!alert.saleId) {
          skipped++;
          this.logger.debug(
            `Bo qua canh bao KH ${alert.customerId}: khong co Sale phu trach`,
          );
          continue;
        }

        // Kiem tra Sale ton tai va dang hoat dong
        const saleUser = await this.prisma.user.findUnique({
          where: { id: alert.saleId },
          select: { id: true, isActive: true },
        });

        if (!saleUser || !saleUser.isActive) {
          skipped++;
          this.logger.debug(
            `Bo qua canh bao KH ${alert.customerId}: Sale ${alert.saleId} khong hoat dong`,
          );
          continue;
        }

        // Tranh gui trung: kiem tra da co thong bao tuong tu trong 24 gio qua chua
        const recentAlert = await this.prisma.notification.findFirst({
          where: {
            userId: alert.saleId,
            referenceId: alert.customerId,
            type: NotificationType.ALERT,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });

        if (recentAlert) {
          skipped++;
          this.logger.debug(
            `Bo qua canh bao KH ${alert.customerId}: da gui trong 24 gio qua`,
          );
          continue;
        }

        // Tao noi dung thong bao
        const riskLabel = alert.churnRisk === 'CRITICAL' ? 'NGUY HIEM' : 'CAO';
        const title = `Canh bao roi bo: ${alert.customerName}`;
        const body =
          `[${riskLabel}] KH ${alert.customerName} co nguy co roi bo (${alert.churnRisk}). ` +
          `Da ${alert.daysSinceLastOrder} ngay chua dat hang.`;

        // Luu thong bao vao DB (APP_PUSH channel)
        await this.prisma.notification.create({
          data: {
            userId: alert.saleId,
            title,
            body,
            type: NotificationType.ALERT,
            channel: NotificationChannel.APP_PUSH,
            referenceId: alert.customerId,
            isUrgent: alert.churnRisk === 'CRITICAL',
            isRead: false,
            data: {
              churnRisk: alert.churnRisk,
              daysSinceLastOrder: alert.daysSinceLastOrder,
              customerId: alert.customerId,
            } as any,
          },
        });

        sent++;
        this.logger.log(
          `Gui canh bao roi bo toi Sale ${alert.saleId} ve KH ${alert.customerName} (${alert.churnRisk})`,
        );
      } catch (err) {
        this.logger.error(
          `Loi gui canh bao roi bo cho KH ${alert.customerId}: ${err.message}`,
          err.stack,
        );
      }
    }

    this.logger.log(
      `Hoan thanh xu ly canh bao roi bo: ${sent} da gui, ${skipped} bo qua`,
    );
  }
}
