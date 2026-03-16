import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface AllocationResult {
  orderId: string;
  orderCode: string;
  weight: number;
  volume: number;
  proportion: number;
  allocatedAmount: number;
}

/**
 * Service for allocating container costs to individual orders/packages.
 * Supports multiple allocation strategies: by weight, by volume, or evenly.
 */
@Injectable()
export class CostAllocationService {
  private readonly logger = new Logger(CostAllocationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Allocates container costs proportionally by chargeable weight.
   * Formula: orderCost = (orderWeight / totalWeight) * totalContainerCost
   */
  async allocateByWeight(containerId: string): Promise<AllocationResult[]> {
    const { container, orders, totalCost } = await this.getContainerData(containerId);

    if (orders.length === 0) {
      throw new BadRequestException(
        `Container ${container.code} has no orders to allocate costs to`,
      );
    }

    // Calculate total chargeable weight using rounded values to avoid floating-point drift
    const totalWeight = orders.reduce((sum, o) => {
      const weight = o.totalChargeableWeight ? Number(o.totalChargeableWeight) : 0;
      return sum + Math.round(weight * 10000) / 10000;
    }, 0);

    if (totalWeight === 0) {
      throw new BadRequestException(
        'Total chargeable weight is 0. Cannot allocate by weight. ' +
          'Ensure packages have been weighed.',
      );
    }

    let sumAllocated = 0;
    const allocations: AllocationResult[] = orders.map((order, index) => {
      const weight = order.totalChargeableWeight ? Number(order.totalChargeableWeight) : 0;
      const proportion = weight / totalWeight;
      let allocatedAmount: number;

      if (index === orders.length - 1) {
        // Give remainder to the last order to avoid rounding differences
        allocatedAmount = totalCost - sumAllocated;
      } else {
        allocatedAmount = Math.round(totalCost * proportion);
        sumAllocated += allocatedAmount;
      }

      return {
        orderId: order.id,
        orderCode: order.code,
        weight,
        volume: 0,
        proportion: Math.round(proportion * 10000) / 10000,
        allocatedAmount,
      };
    });

    // Save allocations
    await this.saveAllocations(containerId, allocations, 'WEIGHT');

    this.logger.log(
      `Cost allocated by weight for container ${container.code}: ` +
        `${totalCost} VND across ${orders.length} orders`,
    );

    return allocations;
  }

  /**
   * Allocates container costs proportionally by volume.
   * Uses package dimensions (L x W x H) to determine volumetric space.
   */
  async allocateByVolume(containerId: string): Promise<AllocationResult[]> {
    const { container, orders, totalCost } = await this.getContainerData(containerId);

    if (orders.length === 0) {
      throw new BadRequestException(
        `Container ${container.code} has no orders to allocate costs to`,
      );
    }

    // Get packages with dimensions for each order
    const orderVolumes = await Promise.all(
      orders.map(async (order) => {
        const packages = await this.prisma.package.findMany({
          where: { orderId: order.id, containerId },
          select: { length: true, width: true, height: true },
        });

        const volume = packages.reduce((sum, pkg) => {
          const l = pkg.length ? Number(pkg.length) : 0;
          const w = pkg.width ? Number(pkg.width) : 0;
          const h = pkg.height ? Number(pkg.height) : 0;
          // Round to 4 decimal places to avoid floating-point drift in volume calculations
          const volumeM3 = Math.round(((l * w * h) / 1_000_000) * 10000) / 10000;
          return sum + volumeM3;
        }, 0);

        return { orderId: order.id, orderCode: order.code, volume };
      }),
    );

    const totalVolume = orderVolumes.reduce((sum, o) => sum + o.volume, 0);

    if (totalVolume === 0) {
      throw new BadRequestException(
        'Total volume is 0. Cannot allocate by volume. ' +
          'Ensure packages have dimensions recorded.',
      );
    }

    let sumAllocated = 0;
    const allocations: AllocationResult[] = orderVolumes.map((ov, index) => {
      const proportion = ov.volume / totalVolume;
      let allocatedAmount: number;

      if (index === orderVolumes.length - 1) {
        // Give remainder to the last order to avoid rounding differences
        allocatedAmount = totalCost - sumAllocated;
      } else {
        allocatedAmount = Math.round(totalCost * proportion);
        sumAllocated += allocatedAmount;
      }

      return {
        orderId: ov.orderId,
        orderCode: ov.orderCode,
        weight: 0,
        volume: Math.round(ov.volume * 10000) / 10000,
        proportion: Math.round(proportion * 10000) / 10000,
        allocatedAmount,
      };
    });

    await this.saveAllocations(containerId, allocations, 'VOLUME');

    this.logger.log(
      `Cost allocated by volume for container ${container.code}: ` +
        `${totalCost} VND across ${orders.length} orders`,
    );

    return allocations;
  }

  /**
   * Allocates container costs evenly across all orders.
   */
  async allocateEvenly(containerId: string): Promise<AllocationResult[]> {
    const { container, orders, totalCost } = await this.getContainerData(containerId);

    if (orders.length === 0) {
      throw new BadRequestException(
        `Container ${container.code} has no orders to allocate costs to`,
      );
    }

    const perOrderAmount = Math.round(totalCost / orders.length);
    const proportion = 1 / orders.length;

    const allocations: AllocationResult[] = orders.map((order, index) => ({
      orderId: order.id,
      orderCode: order.code,
      weight: 0,
      volume: 0,
      proportion: Math.round(proportion * 10000) / 10000,
      // Give any remainder to the last order to avoid rounding differences
      allocatedAmount:
        index === orders.length - 1
          ? totalCost - perOrderAmount * (orders.length - 1)
          : perOrderAmount,
    }));

    await this.saveAllocations(containerId, allocations, 'EVEN');

    this.logger.log(
      `Cost allocated evenly for container ${container.code}: ` +
        `${perOrderAmount} VND per order across ${orders.length} orders`,
    );

    return allocations;
  }

  /**
   * Fetches container, its orders, and total operation costs.
   */
  private async getContainerData(containerId: string) {
    const container = await this.prisma.container.findUnique({
      where: { id: containerId },
      select: { id: true, code: true },
    });

    if (!container) {
      throw new NotFoundException(`Container with ID ${containerId} not found`);
    }

    const orders = await this.prisma.order.findMany({
      where: { containerId },
      select: {
        id: true,
        code: true,
        totalChargeableWeight: true,
      },
    });

    // Sum all costs for this container
    const costAgg = await this.prisma.operationCost.aggregate({
      where: { containerId },
      _sum: { amount: true },
    });

    const totalCost = costAgg._sum.amount ? Number(costAgg._sum.amount) : 0;

    if (totalCost === 0) {
      throw new BadRequestException(`No operation costs recorded for container ${container.code}`);
    }

    return { container, orders, totalCost };
  }

  /**
   * Persists cost allocations to the database.
   */
  private async saveAllocations(
    containerId: string,
    allocations: AllocationResult[],
    method: string,
  ) {
    // Delete existing allocations for this container (replace strategy)
    await this.prisma.costAllocation.deleteMany({
      where: { containerId },
    });

    // Create new allocations
    await this.prisma.costAllocation.createMany({
      data: allocations.map((a) => ({
        containerId,
        orderId: a.orderId,
        method,
        proportion: new Decimal(a.proportion),
        allocatedAmount: new Decimal(a.allocatedAmount),
      })),
    });
  }
}
