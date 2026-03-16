import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateCostDto } from './dto/create-cost.dto';
import { CostQueryDto } from './dto/cost-query.dto';
import { CostAllocationService, AllocationResult } from './domain/cost-allocation.service';

@Injectable()
export class OperationCostService {
  private readonly logger = new Logger(OperationCostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly costAllocation: CostAllocationService,
  ) {}

  /**
   * Records a new operation cost for a container/trip.
   */
  async recordCost(dto: CreateCostDto) {
    // Validate container exists
    const container = await this.prisma.container.findUnique({
      where: { id: dto.containerId },
      select: { id: true, code: true },
    });

    if (!container) {
      throw new NotFoundException(`Container with ID ${dto.containerId} not found`);
    }

    const cost = await this.prisma.operationCost.create({
      data: {
        containerId: dto.containerId,
        costType: dto.costType,
        amount: new Decimal(dto.amount),
        currency: dto.currency ?? 'VND',
        description: dto.description,
        invoiceRef: dto.invoiceRef,
        estimatedAmount: dto.estimatedAmount ? new Decimal(dto.estimatedAmount) : null,
        note: dto.note,
      },
    });

    this.eventEmitter.emit('operation-cost.recorded', {
      costId: cost.id,
      containerId: dto.containerId,
      containerCode: container.code,
      costType: dto.costType,
      amount: dto.amount,
    });

    this.logger.log(
      `Operation cost ${dto.costType} recorded for container ${container.code}: ${dto.amount} ${dto.currency ?? 'VND'}`,
    );

    return cost;
  }

  /**
   * Lists operation costs with pagination and filters.
   */
  async findAll(query: CostQueryDto) {
    const where: any = {};

    if (query.costType) {
      where.costType = query.costType;
    }

    if (query.containerId) {
      where.containerId = query.containerId;
    }

    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { invoiceRef: { contains: query.search, mode: 'insensitive' } },
        {
          container: {
            code: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (query.startDate || query.endDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (query.startDate) {
        dateFilter.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const endOfDay = new Date(query.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter.lte = endOfDay;
      }
      where.createdAt = dateFilter;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.operationCost.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy as any,
        include: {
          container: {
            select: {
              id: true,
              code: true,
              shippingRoute: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.operationCost.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets all costs for a specific container.
   */
  async getContainerCosts(containerId: string) {
    const container = await this.prisma.container.findUnique({
      where: { id: containerId },
      select: {
        id: true,
        code: true,
        shippingRoute: true,
        totalWeight: true,
        totalPackages: true,
      },
    });

    if (!container) {
      throw new NotFoundException(`Container with ID ${containerId} not found`);
    }

    const costs = await this.prisma.operationCost.findMany({
      where: { containerId },
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate by cost type
    const byType = await this.prisma.operationCost.groupBy({
      by: ['costType'],
      where: { containerId },
      _sum: { amount: true },
      _count: { id: true },
    });

    const totalAmount = costs.reduce((sum, c) => sum + Number(c.amount), 0);

    return {
      container,
      costs,
      summary: {
        totalAmount,
        totalRecords: costs.length,
        byType: byType.map((t) => ({
          costType: t.costType,
          totalAmount: t._sum.amount ? Number(t._sum.amount) : 0,
          count: t._count.id,
        })),
      },
    };
  }

  /**
   * Distributes container costs to individual orders/packages by weight ratio.
   * Delegates to CostAllocationService.
   */
  async allocateCosts(
    containerId: string,
    method: 'WEIGHT' | 'VOLUME' | 'EVEN' = 'WEIGHT',
  ): Promise<AllocationResult[]> {
    switch (method) {
      case 'WEIGHT':
        return this.costAllocation.allocateByWeight(containerId);
      case 'VOLUME':
        return this.costAllocation.allocateByVolume(containerId);
      case 'EVEN':
        return this.costAllocation.allocateEvenly(containerId);
      default:
        return this.costAllocation.allocateByWeight(containerId);
    }
  }

  /**
   * Calculates cost per kg for a container.
   * Formula: totalCost / totalChargeableWeight
   */
  async getCostPerKg(containerId: string) {
    const container = await this.prisma.container.findUnique({
      where: { id: containerId },
      select: {
        id: true,
        code: true,
        totalWeight: true,
        shippingRoute: true,
      },
    });

    if (!container) {
      throw new NotFoundException(`Container with ID ${containerId} not found`);
    }

    // Get total chargeable weight from packages
    const weightAgg = await this.prisma.package.aggregate({
      where: { containerId },
      _sum: { chargeableWeight: true, actualWeight: true },
      _count: { id: true },
    });

    const totalChargeableWeight = weightAgg._sum.chargeableWeight
      ? Number(weightAgg._sum.chargeableWeight)
      : 0;
    const totalActualWeight = weightAgg._sum.actualWeight ? Number(weightAgg._sum.actualWeight) : 0;
    const totalPackages = weightAgg._count.id;

    // Get total costs
    const costAgg = await this.prisma.operationCost.aggregate({
      where: { containerId },
      _sum: { amount: true },
    });

    const totalCost = costAgg._sum.amount ? Number(costAgg._sum.amount) : 0;

    const costPerKg = totalChargeableWeight > 0 ? Math.round(totalCost / totalChargeableWeight) : 0;

    const costPerKgActual = totalActualWeight > 0 ? Math.round(totalCost / totalActualWeight) : 0;

    return {
      containerId,
      containerCode: container.code,
      shippingRoute: container.shippingRoute,
      totalCost,
      totalChargeableWeight,
      totalActualWeight,
      totalPackages,
      costPerKg,
      costPerKgActual,
    };
  }

  /**
   * Gets total allocated costs for a specific order.
   */
  async getOrderCost(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        code: true,
        containerId: true,
        totalChargeableWeight: true,
        totalActualWeight: true,
        totalAmount: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Get allocated costs
    const allocations = await this.prisma.costAllocation.findMany({
      where: { orderId },
    });

    const totalAllocatedCost = allocations.reduce((sum, a) => sum + Number(a.allocatedAmount), 0);

    // Fetch container codes for the allocations
    const allocationContainerIds = [...new Set(allocations.map((a) => a.containerId))];
    const allocationContainers = await this.prisma.container.findMany({
      where: { id: { in: allocationContainerIds } },
      select: { id: true, code: true },
    });
    const allocationContainerMap = new Map(allocationContainers.map((c) => [c.id, c]));

    // Cost per kg for this order
    const chargeableWeight = order.totalChargeableWeight ? Number(order.totalChargeableWeight) : 0;
    const orderCostPerKg =
      chargeableWeight > 0 ? Math.round(totalAllocatedCost / chargeableWeight) : 0;

    // Profit margin estimate
    const revenue = Number(order.totalAmount);
    const margin =
      revenue > 0 ? Math.round(((revenue - totalAllocatedCost) / revenue) * 10000) / 100 : 0;

    return {
      orderId: order.id,
      orderCode: order.code,
      totalAllocatedCost,
      chargeableWeight,
      orderCostPerKg,
      revenue,
      estimatedMarginPercent: margin,
      allocations: allocations.map((a) => ({
        containerId: a.containerId,
        containerCode: allocationContainerMap.get(a.containerId)?.code,
        method: a.method,
        proportion: Number(a.proportion),
        allocatedAmount: Number(a.allocatedAmount),
      })),
    };
  }

  /**
   * Generates a variance report comparing estimated vs actual costs for a container.
   */
  async getVarianceReport(containerId: string) {
    const container = await this.prisma.container.findUnique({
      where: { id: containerId },
      select: { id: true, code: true },
    });

    if (!container) {
      throw new NotFoundException(`Container with ID ${containerId} not found`);
    }

    const costs = await this.prisma.operationCost.findMany({
      where: { containerId },
      orderBy: { costType: 'asc' },
    });

    const variances = costs.map((cost) => {
      const actual = Number(cost.amount);
      const estimated = cost.estimatedAmount ? Number(cost.estimatedAmount) : 0;
      const variance = actual - estimated;
      const variancePercent = estimated > 0 ? Math.round((variance / estimated) * 10000) / 100 : 0;

      return {
        costId: cost.id,
        costType: cost.costType,
        estimatedAmount: estimated,
        actualAmount: actual,
        variance,
        variancePercent,
        hasEstimate: !!cost.estimatedAmount,
        isOverBudget: variance > 0,
      };
    });

    const totals = variances.reduce(
      (acc, v) => ({
        totalEstimated: acc.totalEstimated + v.estimatedAmount,
        totalActual: acc.totalActual + v.actualAmount,
        totalVariance: acc.totalVariance + v.variance,
      }),
      { totalEstimated: 0, totalActual: 0, totalVariance: 0 },
    );

    const totalVariancePercent =
      totals.totalEstimated > 0
        ? Math.round((totals.totalVariance / totals.totalEstimated) * 10000) / 100
        : 0;

    return {
      containerId,
      containerCode: container.code,
      variances,
      totals: {
        ...totals,
        totalVariancePercent,
        isOverBudget: totals.totalVariance > 0,
      },
      costItemCount: costs.length,
      itemsWithEstimate: variances.filter((v) => v.hasEstimate).length,
      overBudgetItems: variances.filter((v) => v.hasEstimate && v.isOverBudget).length,
    };
  }

  /**
   * Gets cost summary aggregated by cost type, route, and period.
   */
  async getCostSummary(dateRange?: { startDate?: string; endDate?: string }) {
    const where: any = {};

    if (dateRange?.startDate || dateRange?.endDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (dateRange.startDate) {
        dateFilter.gte = new Date(dateRange.startDate);
      }
      if (dateRange.endDate) {
        const endOfDay = new Date(dateRange.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter.lte = endOfDay;
      }
      where.createdAt = dateFilter;
    }

    // By cost type
    const byCostType = await this.prisma.operationCost.groupBy({
      by: ['costType'],
      where,
      _sum: { amount: true },
      _count: { id: true },
      _avg: { amount: true },
    });

    // By currency
    const byCurrency = await this.prisma.operationCost.groupBy({
      by: ['currency'],
      where,
      _sum: { amount: true },
      _count: { id: true },
    });

    // Total
    const totalAgg = await this.prisma.operationCost.aggregate({
      where,
      _sum: { amount: true },
      _count: { id: true },
    });

    // By container (top 10 by cost)
    const byContainer = await this.prisma.operationCost.groupBy({
      by: ['containerId'],
      where,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    });

    // Fetch container codes for the top containers
    const containerIds = byContainer.map((c) => c.containerId).filter((id): id is string => id !== null);
    const containers = await this.prisma.container.findMany({
      where: { id: { in: containerIds } },
      select: { id: true, code: true, shippingRoute: true },
    });
    const containerMap = new Map(containers.map((c) => [c.id, c]));

    return {
      totalCost: totalAgg._sum.amount ? Number(totalAgg._sum.amount) : 0,
      totalRecords: totalAgg._count.id,
      byCostType: byCostType.map((t) => ({
        costType: t.costType,
        totalAmount: t._sum.amount ? Number(t._sum.amount) : 0,
        count: t._count.id,
        avgAmount: t._avg.amount ? Math.round(Number(t._avg.amount)) : 0,
      })),
      byCurrency: byCurrency.map((c) => ({
        currency: c.currency,
        totalAmount: c._sum.amount ? Number(c._sum.amount) : 0,
        count: c._count.id,
      })),
      topContainers: byContainer.map((c) => {
        const container = c.containerId ? containerMap.get(c.containerId) : undefined;
        return {
          containerId: c.containerId,
          containerCode: container?.code,
          shippingRoute: container?.shippingRoute,
          totalCost: c._sum.amount ? Number(c._sum.amount) : 0,
          costCount: c._count.id,
        };
      }),
    };
  }
}
