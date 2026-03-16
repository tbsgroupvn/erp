import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@core/database/prisma.service';
import { OrderStatus, ContainerStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Ten metric duoc ho tro
type MetricKey =
  | 'total_orders'
  | 'total_orders_today'
  | 'revenue_month'
  | 'ar_outstanding'
  | 'ar_overdue'
  | 'containers_in_transit'
  | 'packages_in_warehouse_cn'
  | 'packages_in_warehouse_vn'
  | 'active_customers';

export interface MetricDataPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

@Injectable()
export class MetricSnapshotService {
  private readonly logger = new Logger(MetricSnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lay gia tri tung metric tu DB.
   * branch=undefined nghia la tinh toan cho tat ca chi nhanh.
   */
  private async computeMetric(metric: MetricKey, branch?: string): Promise<Decimal> {
    const branchFilter = branch ? { branch: branch as any } : {};
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (metric) {
      case 'total_orders': {
        const count = await this.prisma.order.count({ where: { ...branchFilter } });
        return new Decimal(count);
      }

      case 'total_orders_today': {
        const count = await this.prisma.order.count({
          where: {
            createdAt: { gte: startOfDay },
            ...branchFilter,
          },
        });
        return new Decimal(count);
      }

      case 'revenue_month': {
        const result = await this.prisma.order.aggregate({
          where: {
            status: OrderStatus.COMPLETED,
            completedAt: { gte: startOfMonth },
            ...branchFilter,
          },
          _sum: { totalAmount: true },
        });
        return result._sum.totalAmount ?? new Decimal(0);
      }

      case 'ar_outstanding': {
        const result = await this.prisma.accountReceivable.aggregate({
          where: {
            status: { in: ['OPEN', 'PARTIAL'] as any[] },
            ...(branch ? { order: { branch: branch as any } } : {}),
          },
          _sum: { amount: true, paidAmount: true },
        });
        const total = result._sum.amount ?? new Decimal(0);
        const paid = result._sum.paidAmount ?? new Decimal(0);
        return total.sub(paid).greaterThan(0) ? total.sub(paid) : new Decimal(0);
      }

      case 'ar_overdue': {
        const result = await this.prisma.accountReceivable.aggregate({
          where: {
            status: { in: ['OPEN', 'PARTIAL'] as any[] },
            dueDate: { lt: now },
            ...(branch ? { order: { branch: branch as any } } : {}),
          },
          _sum: { amount: true, paidAmount: true },
        });
        const total = result._sum.amount ?? new Decimal(0);
        const paid = result._sum.paidAmount ?? new Decimal(0);
        return total.sub(paid).greaterThan(0) ? total.sub(paid) : new Decimal(0);
      }

      case 'containers_in_transit': {
        const count = await this.prisma.container.count({
          where: { status: ContainerStatus.IN_TRANSIT },
        });
        return new Decimal(count);
      }

      case 'packages_in_warehouse_cn': {
        const count = await this.prisma.package.count({
          where: {
            warehouseCNStatus: { not: null },
            warehouseVNStatus: null,
          },
        });
        return new Decimal(count);
      }

      case 'packages_in_warehouse_vn': {
        const count = await this.prisma.package.count({
          where: {
            warehouseVNStatus: { not: null },
            deliveredAt: null,
          },
        });
        return new Decimal(count);
      }

      case 'active_customers': {
        const count = await this.prisma.customer.count({
          where: {
            isActive: true,
            isBlocked: false,
            ...branchFilter,
          },
        });
        return new Decimal(count);
      }

      default:
        return new Decimal(0);
    }
  }

  /**
   * Chup anh KPI hang ngay — duoc goi boi cron 23:00 moi ngay.
   * Co the goi thu cong qua endpoint POST /dashboard/capture-snapshot.
   */
  @Cron('0 23 * * *', { name: 'daily-metric-snapshot' })
  async captureDaily(): Promise<void> {
    this.logger.log('Bat dau chup anh KPI hang ngay...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const metrics: MetricKey[] = [
      'total_orders',
      'total_orders_today',
      'revenue_month',
      'ar_outstanding',
      'ar_overdue',
      'containers_in_transit',
      'packages_in_warehouse_cn',
      'packages_in_warehouse_vn',
      'active_customers',
    ];

    let successCount = 0;
    let errorCount = 0;

    for (const metric of metrics) {
      try {
        const value = await this.computeMetric(metric, undefined);

        await this.prisma.dailyMetricSnapshot.upsert({
          where: {
            date_metric_branch: {
              date: today,
              metric,
              branch: 'ALL',
            },
          },
          update: { value },
          create: {
            date: today,
            metric,
            value,
            branch: 'ALL',
            metadata: { capturedAt: new Date().toISOString() },
          },
        });

        successCount++;
      } catch (err) {
        this.logger.error(`Loi chup anh metric "${metric}": ${(err as Error).message}`);
        errorCount++;
      }
    }

    this.logger.log(
      `Hoan thanh chup anh KPI: ${successCount} thanh cong, ${errorCount} loi`,
    );
  }

  /**
   * Lay lich su metric theo so ngay.
   * Tra ve mang {date, value} de ve bieu do.
   */
  async getMetricHistory(
    metric: string,
    days: number = 30,
    branch?: string,
  ): Promise<MetricDataPoint[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const rows = await this.prisma.dailyMetricSnapshot.findMany({
      where: {
        metric,
        date: { gte: since },
        ...(branch ? { branch } : { branch: 'ALL' }),
      },
      orderBy: { date: 'asc' },
      select: { date: true, value: true },
    });

    return rows.map((r: { date: Date; value: { toNumber: () => number } }) => ({
      date: r.date.toISOString().slice(0, 10),
      value: r.value.toNumber(),
    }));
  }
}
