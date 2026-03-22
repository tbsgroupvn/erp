import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '@modules/notification/notification.service';
import { ContainerStatus, WarehouseCNStatus, WarehouseVNStatus } from '@prisma/client';

@Injectable()
export class WarehouseSyncService {
  private readonly logger = new Logger(WarehouseSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Every 2 hours: detect packages stuck in transit > 7 days.
   * These may indicate lost shipments or tracking failures.
   * Looks for packages that have been SHIPPED from CN warehouse
   * but not yet RECEIVED at VN warehouse.
   */
  @Cron('0 */2 * * *', { name: 'warehouse-stale-package-check' })
  async checkStalePackages(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

    const stalePackages = await this.prisma.package.findMany({
      where: {
        warehouseCNStatus: WarehouseCNStatus.SHIPPED,
        warehouseVNStatus: null,
        updatedAt: { lt: sevenDaysAgo },
      },
      select: {
        id: true,
        trackingNumberCN: true,
        orderId: true,
        warehouseCNStatus: true,
        updatedAt: true,
      },
      take: 100,
    });

    if (stalePackages.length === 0) return;

    this.logger.warn(
      `Found ${stalePackages.length} packages stuck in transit >7 days`,
    );

    const trackingSummary = stalePackages
      .slice(0, 5)
      .map((p) => p.trackingNumberCN ?? p.id)
      .join(', ');
    const suffix = stalePackages.length > 5 ? '...' : '';

    const notification = {
      title: `${stalePackages.length} kien hang qua han van chuyen`,
      body:
        `Co ${stalePackages.length} kien hang dang o trang thai van chuyen hon 7 ngay. ` +
        `Tracking: ${trackingSummary}${suffix}`,
      type: 'WAREHOUSE',
      referenceId: 'stale-packages',
      isUrgent: true,
    };

    await Promise.all([
      this.notificationService.sendToRole('WAREHOUSE_MANAGER', notification),
      this.notificationService.sendToRole('LOGISTICS_MANAGER', notification),
      this.notificationService.sendToRole('COO', notification),
    ]);
  }

  /**
   * Daily at 2:00 AM VN time (19:00 UTC): inventory reconciliation.
   * Compare expected vs actual package counts per container.
   * Find containers that are COMPLETED but still have packages
   * not in final VN warehouse state (DELIVERED).
   */
  @Cron('0 19 * * *', { name: 'inventory-reconciliation' })
  async reconcileInventory(): Promise<void> {
    this.logger.log('Running daily inventory reconciliation');

    const anomalies = await this.prisma.container.findMany({
      where: {
        status: ContainerStatus.COMPLETED,
        packages: {
          some: {
            warehouseVNStatus: {
              notIn: [WarehouseVNStatus.DELIVERED],
            },
          },
        },
      },
      select: {
        id: true,
        code: true,
        _count: {
          select: { packages: true },
        },
        packages: {
          where: {
            warehouseVNStatus: {
              notIn: [WarehouseVNStatus.DELIVERED],
            },
          },
          select: {
            id: true,
            trackingNumberCN: true,
            warehouseCNStatus: true,
            warehouseVNStatus: true,
          },
          take: 10,
        },
      },
      take: 50,
    });

    if (anomalies.length === 0) {
      this.logger.log('Inventory reconciliation complete - no anomalies');
      return;
    }

    this.logger.warn(
      `Found ${anomalies.length} containers with unresolved packages`,
    );

    for (const container of anomalies) {
      const notification = {
        title: `Container ${container.code} - kien hang chua hoan tat`,
        body:
          `Container ${container.code} da COMPLETED nhung con ${container.packages.length} kien chua giao. Kiem tra kho.`,
        type: 'WAREHOUSE',
        referenceId: container.id,
        isUrgent: false,
      };

      await Promise.all([
        this.notificationService.sendToRole('WAREHOUSE_MANAGER', notification),
        this.notificationService.sendToRole(
          'WAREHOUSE_VN_MANAGER',
          notification,
        ),
      ]);
    }
  }

  /**
   * Every 6 hours: detect weight variance between CN and VN warehouses.
   * Significant differences (>10%) may indicate tampering or measurement errors.
   */
  @Cron('0 */6 * * *', { name: 'weight-variance-check' })
  async checkWeightVariance(): Promise<void> {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);

    // Find packages with both CN and VN weights recorded recently
    const packages = await this.prisma.package.findMany({
      where: {
        cnWeight: { not: null },
        vnWeight: { not: null },
        updatedAt: { gte: threeDaysAgo },
      },
      select: {
        id: true,
        trackingNumberCN: true,
        orderId: true,
        cnWeight: true,
        vnWeight: true,
      },
    });

    const variances = packages.filter((p) => {
      if (!p.cnWeight || !p.vnWeight) return false;
      const cn = Number(p.cnWeight);
      const vn = Number(p.vnWeight);
      if (cn === 0) return false;
      const variance = Math.abs(cn - vn) / cn;
      return variance > 0.1; // >10% variance
    });

    if (variances.length === 0) return;

    this.logger.warn(
      `Found ${variances.length} packages with weight variance >10%`,
    );

    const notification = {
      title: `${variances.length} kien hang chenh lech can nang >10%`,
      body:
        `Co ${variances.length} kien hang chenh lech can nang giua kho TQ va kho VN qua 10%. Can kiem tra lai.`,
      type: 'WAREHOUSE',
      referenceId: 'weight-variance',
      isUrgent: true,
    };

    await Promise.all([
      this.notificationService.sendToRole('WAREHOUSE_MANAGER', notification),
      this.notificationService.sendToRole('WAREHOUSE_CN_AGENT', notification),
      this.notificationService.sendToRole(
        'WAREHOUSE_VN_MANAGER',
        notification,
      ),
    ]);
  }
}
