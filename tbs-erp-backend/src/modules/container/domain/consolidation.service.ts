import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { ShippingRoute, WarehouseCNStatus } from '@prisma/client';

export interface PackageGrouping {
  shippingRoute: ShippingRoute;
  packageIds: string[];
  totalWeight: number;
  totalPackages: number;
}

export interface ContainerPlanSuggestion {
  shippingRoute: ShippingRoute;
  suggestedContainers: number;
  totalWeight: number;
  totalPackages: number;
  fillRate: number;
  packages: Array<{
    id: string;
    code: string;
    chargeableWeight: number;
    orderId: string;
  }>;
}

export interface OptimalFillResult {
  containerId: string;
  currentWeight: number;
  maxCapacity: number;
  remainingCapacity: number;
  fillRate: number;
  canFitPackage: boolean;
}

/**
 * Consolidation Service.
 *
 * Handles the logistics of grouping packages into containers for shipping.
 * Provides:
 *  - Grouping unassigned packages by shipping route
 *  - Calculating optimal container fill rates
 *  - Suggesting container plans based on pending packages
 */
@Injectable()
export class ConsolidationService {
  private readonly logger = new Logger(ConsolidationService.name);

  // Default container capacities in kg by route type
  private readonly DEFAULT_CAPACITIES: Record<ShippingRoute, number> = {
    [ShippingRoute.SEA]: 20000, // 20 tons for sea container
    [ShippingRoute.ROAD]: 10000, // 10 tons for road truck
    [ShippingRoute.AIR]: 5000, // 5 tons for air cargo
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Groups unassigned packages by their order's shipping route.
   * Returns packages that are in PACKED status at Warehouse CN
   * but have not been assigned to a container yet.
   */
  async groupPackagesByRoute(): Promise<PackageGrouping[]> {
    const packages = await this.prisma.package.findMany({
      where: {
        containerId: null,
        warehouseCNStatus: WarehouseCNStatus.PACKED,
      },
      include: {
        order: {
          select: {
            id: true,
            shippingRoute: true,
          },
        },
      },
    });

    // Group by shipping route
    const groups = new Map<ShippingRoute, PackageGrouping>();

    for (const pkg of packages) {
      const route = pkg.order.shippingRoute;
      if (!route) continue;

      if (!groups.has(route)) {
        groups.set(route, {
          shippingRoute: route,
          packageIds: [],
          totalWeight: 0,
          totalPackages: 0,
        });
      }

      const group = groups.get(route)!;
      group.packageIds.push(pkg.id);
      group.totalWeight += pkg.chargeableWeight ? Number(pkg.chargeableWeight) : 0;
      group.totalPackages += 1;
    }

    return Array.from(groups.values());
  }

  /**
   * Calculates the optimal fill rate for a container given its current
   * packages and a candidate package to add.
   */
  async calculateOptimalFill(
    containerId: string,
    candidateWeight?: number,
  ): Promise<OptimalFillResult> {
    const container = await this.prisma.container.findUniqueOrThrow({
      where: { id: containerId },
      select: {
        id: true,
        totalWeight: true,
        maxCapacity: true,
        shippingRoute: true,
      },
    });

    const maxCapacity = container.maxCapacity
      ? Number(container.maxCapacity)
      : this.DEFAULT_CAPACITIES[container.shippingRoute];

    const currentWeight = Number(container.totalWeight);
    const remainingCapacity = Math.max(0, maxCapacity - currentWeight);
    const fillRate = maxCapacity > 0 ? (currentWeight / maxCapacity) * 100 : 0;
    const canFitPackage = candidateWeight
      ? candidateWeight <= remainingCapacity
      : remainingCapacity > 0;

    return {
      containerId,
      currentWeight,
      maxCapacity,
      remainingCapacity,
      fillRate: Math.round(fillRate * 100) / 100,
      canFitPackage,
    };
  }

  /**
   * Suggests a container plan based on pending unassigned packages.
   * Groups packages by route and estimates how many containers are needed.
   */
  async suggestContainerPlan(): Promise<ContainerPlanSuggestion[]> {
    const groups = await this.groupPackagesByRoute();
    const suggestions: ContainerPlanSuggestion[] = [];

    for (const group of groups) {
      const capacity = this.DEFAULT_CAPACITIES[group.shippingRoute];
      const suggestedContainers = Math.ceil(group.totalWeight / capacity);
      const fillRate =
        suggestedContainers > 0 ? (group.totalWeight / (suggestedContainers * capacity)) * 100 : 0;

      // Fetch package details for the suggestion
      const packages = await this.prisma.package.findMany({
        where: {
          id: { in: group.packageIds },
        },
        select: {
          id: true,
          code: true,
          chargeableWeight: true,
          orderId: true,
        },
      });

      suggestions.push({
        shippingRoute: group.shippingRoute,
        suggestedContainers,
        totalWeight: group.totalWeight,
        totalPackages: group.totalPackages,
        fillRate: Math.round(fillRate * 100) / 100,
        packages: packages.map((p) => ({
          id: p.id,
          code: p.code,
          chargeableWeight: p.chargeableWeight ? Number(p.chargeableWeight) : 0,
          orderId: p.orderId,
        })),
      });
    }

    this.logger.log(
      `Container plan suggested: ${suggestions.length} route group(s), ` +
        `total ${suggestions.reduce((s, g) => s + g.suggestedContainers, 0)} container(s)`,
    );

    return suggestions;
  }
}
