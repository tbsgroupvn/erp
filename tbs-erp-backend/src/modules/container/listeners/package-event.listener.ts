import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface PackagePackedEvent {
  packageId: string;
  orderId: string;
  chargeableWeight: number;
  shippingRoute: string;
}

export interface PackageRemovedFromContainerEvent {
  packageId: string;
  containerId: string;
}

/**
 * Listens for package lifecycle events that affect containers.
 *
 * - When a package is packed and ready, it becomes eligible for consolidation
 * - When a package is removed from a container, recalculate totals
 */
@Injectable()
export class PackageEventListener {
  private readonly logger = new Logger(PackageEventListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * When a package is packed at Warehouse CN, log it for consolidation planning.
   */
  @OnEvent('warehouse.package.packed')
  async handlePackagePacked(event: PackagePackedEvent): Promise<void> {
    this.logger.log(
      `Package ${event.packageId} packed and ready for consolidation ` +
        `(weight=${event.chargeableWeight}kg, route=${event.shippingRoute})`,
    );

    // No direct action needed -- consolidation plan query will pick up
    // PACKED packages without containers. This is logged for audit purposes.
  }

  /**
   * When a package is removed from a container, recalculate the container totals.
   */
  @OnEvent('container.package.removed')
  async handlePackageRemoved(event: PackageRemovedFromContainerEvent): Promise<void> {
    this.logger.log(`Package ${event.packageId} removed from container ${event.containerId}`);

    try {
      // Recalculate container totals
      const packages = await this.prisma.package.findMany({
        where: { containerId: event.containerId },
        select: { chargeableWeight: true },
      });

      const totalPackages = packages.length;
      let totalWeightDecimal = new Decimal(0);
      for (const p of packages) {
        if (p.chargeableWeight) {
          totalWeightDecimal = totalWeightDecimal.add(p.chargeableWeight);
        }
      }

      const container = await this.prisma.container.findUnique({
        where: { id: event.containerId },
        select: { maxCapacity: true },
      });

      const maxCapacity = container?.maxCapacity
        ? new Decimal(container.maxCapacity)
        : new Decimal(0);
      const fillRate = maxCapacity.greaterThan(0)
        ? totalWeightDecimal.div(maxCapacity).mul(100).toDecimalPlaces(2)
        : new Decimal(0);

      await this.prisma.container.update({
        where: { id: event.containerId },
        data: {
          totalPackages,
          totalWeight: totalWeightDecimal,
          fillRate,
        },
      });

      // Invalidate all container caches that reflect package membership / totals
      await Promise.all([
        this.cacheService.del(`container:detail:${event.containerId}`),
        this.cacheService.del(`container:packages:${event.containerId}`),
        this.cacheService.del(`container:weight-recon:${event.containerId}`),
        this.cacheService.invalidateByPrefix('container:list:'),
      ]);

      this.logger.log(
        `Container ${event.containerId} recalculated: ${totalPackages} packages, ${totalWeightDecimal}kg, ${fillRate}% full`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to recalculate container ${event.containerId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
