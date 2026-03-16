import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { AccountStatus, OrderStatus, Prisma } from '@prisma/client';

/** Cache TTL for sales dashboard queries (5 minutes in milliseconds). */
const SALES_DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Shape returned by getSalesPipeline().
 */
export interface SalesPipelineResult {
  pipeline: {
    consulting: number;
    quotation: number;
    pendingDeposit: number;
    sourcing: number;
    warehouseCN: number;
    inTransit: number;
    warehouseVN: number;
    delivering: number;
    settlement: number;
    completed: number;
    totalActive: number;
  };
  pendingDeposits: {
    count: number;
    totalDepositRequired: number;
  };
  vnArrivalsNeedingNotification: number;
  overdueAR: {
    count: number;
    totalOutstanding: number;
  };
  verifiedRevenue: {
    orderCount: number;
    totalAmount: number;
    totalDepositPaid: number;
  };
  period: {
    from: Date | null;
    to: Date | null;
  };
}

/**
 * Sales Dashboard Service.
 *
 * Provides aggregated pipeline data for sales personnel. When a saleId
 * is supplied the data is scoped to that sale's orders and customers;
 * otherwise it returns company-wide totals (for sales directors / BGD).
 */
@Injectable()
export class SalesDashboardService {
  private readonly logger = new Logger(SalesDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get the sales pipeline summary.
   *
   * @param saleId  Optional - scope data to a specific sale user
   * @param dateFrom Optional - filter orders created from this date
   * @param dateTo  Optional - filter orders created up to this date
   */
  async getSalesPipeline(
    saleId?: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<SalesPipelineResult> {
    const cacheKey = this.buildCacheKey('salesPipeline', saleId, dateFrom, dateTo);

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.computeSalesPipeline(saleId, dateFrom, dateTo),
      SALES_DASHBOARD_CACHE_TTL_MS,
    );
  }

  /**
   * Compute the pipeline data from the database.
   */
  private async computeSalesPipeline(
    saleId?: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<SalesPipelineResult> {
    // Base filter scoped by sale and date range
    const baseWhere: Prisma.OrderWhereInput = {
      ...(saleId ? { saleId } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };

    // 1. Count orders by status
    const statusCounts = await this.prisma.order.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { id: true },
    });

    const countByStatus = (status: OrderStatus): number => {
      const entry = statusCounts.find((s) => s.status === status);
      return entry?._count.id ?? 0;
    };

    const consulting = countByStatus(OrderStatus.CONSULTING);
    const quotation = countByStatus(OrderStatus.QUOTATION);
    const pendingDeposit = countByStatus(OrderStatus.PENDING_DEPOSIT);
    const sourcing = countByStatus(OrderStatus.SOURCING);
    const warehouseCN = countByStatus(OrderStatus.WAREHOUSE_CN);
    const inTransit = countByStatus(OrderStatus.IN_TRANSIT);
    const warehouseVN = countByStatus(OrderStatus.WAREHOUSE_VN);
    const delivering = countByStatus(OrderStatus.DELIVERING);
    const settlement = countByStatus(OrderStatus.SETTLEMENT);
    const completed = countByStatus(OrderStatus.COMPLETED);

    const totalActive =
      consulting +
      quotation +
      pendingDeposit +
      sourcing +
      warehouseCN +
      inTransit +
      warehouseVN +
      delivering +
      settlement;

    // 2. Pending deposits: orders where deposit is not yet paid
    const pendingDepositAgg = await this.prisma.order.aggregate({
      where: {
        ...baseWhere,
        isDepositPaid: false,
        status: {
          notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.RETURNED],
        },
      },
      _count: { id: true },
      _sum: { depositRequired: true },
    });

    // 3. VN arrivals needing customer notification
    // Orders at WAREHOUSE_VN status that haven't moved to DELIVERING yet
    const vnArrivalsNeedingNotification = await this.prisma.order.count({
      where: {
        ...baseWhere,
        status: OrderStatus.WAREHOUSE_VN,
      },
    });

    // 4. Overdue AR for the sale's customers
    const arFilter: Prisma.AccountReceivableWhereInput = {
      status: {
        in: [AccountStatus.OPEN, AccountStatus.PARTIAL, AccountStatus.OVERDUE],
      },
      dueDate: { lt: new Date() },
      ...(saleId
        ? {
            order: { saleId },
          }
        : {}),
    };

    const overdueArAgg = await this.prisma.accountReceivable.aggregate({
      where: arFilter,
      _count: { id: true },
      _sum: { amount: true, paidAmount: true },
    });

    const arTotalAmount = overdueArAgg._sum.amount?.toNumber() ?? 0;
    const arPaidAmount = overdueArAgg._sum.paidAmount?.toNumber() ?? 0;
    const arOutstanding = arTotalAmount - arPaidAmount;

    // 5. Verified revenue: only count orders with actual deposit paid > 0
    // This prevents counting orders that were promoted to SOURCING without real payment
    const verifiedRevenueAgg = await this.prisma.order.aggregate({
      where: {
        ...baseWhere,
        depositPaid: { gt: 0 },
        status: {
          notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED],
        },
      },
      _count: { id: true },
      _sum: { totalAmount: true, depositPaid: true },
    });

    return {
      pipeline: {
        consulting,
        quotation,
        pendingDeposit,
        sourcing,
        warehouseCN,
        inTransit,
        warehouseVN,
        delivering,
        settlement,
        completed,
        totalActive,
      },
      pendingDeposits: {
        count: pendingDepositAgg._count.id,
        totalDepositRequired: pendingDepositAgg._sum.depositRequired?.toNumber() ?? 0,
      },
      vnArrivalsNeedingNotification,
      overdueAR: {
        count: overdueArAgg._count.id,
        totalOutstanding: arOutstanding,
      },
      verifiedRevenue: {
        orderCount: verifiedRevenueAgg._count.id,
        totalAmount: verifiedRevenueAgg._sum.totalAmount?.toNumber() ?? 0,
        totalDepositPaid: verifiedRevenueAgg._sum.depositPaid?.toNumber() ?? 0,
      },
      period: {
        from: dateFrom ?? null,
        to: dateTo ?? null,
      },
    };
  }

  /**
   * Get SLA tracking data for customer service monitoring.
   *
   * Returns metrics on response time, resolution time, and SLA compliance
   * for customer-facing operations (order processing, delivery, support).
   */
  async getSlaTracking() {
    const cacheKey = 'dashboard:slaTracking';

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        // Count orders by how long they've been in each status
        const activeOrders = await this.prisma.order.findMany({
          where: {
            status: {
              notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
            },
          },
          select: {
            id: true,
            code: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        const now = new Date();
        const slaBreaches = activeOrders.filter((order) => {
          const daysSinceUpdate =
            (now.getTime() - order.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceUpdate > 3; // Orders stale for > 3 days
        });

        return {
          totalActiveOrders: activeOrders.length,
          slaBreaches: slaBreaches.length,
          complianceRate:
            activeOrders.length > 0
              ? ((activeOrders.length - slaBreaches.length) / activeOrders.length) * 100
              : 100,
          breachedOrders: slaBreaches.map((o) => ({
            id: o.id,
            code: o.code,
            status: o.status,
            daysSinceUpdate: Math.floor(
              (now.getTime() - o.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
            ),
          })),
        };
      },
      SALES_DASHBOARD_CACHE_TTL_MS,
    );
  }

  /**
   * Build a deterministic cache key from the query parameters.
   */
  private buildCacheKey(method: string, saleId?: string, dateFrom?: Date, dateTo?: Date): string {
    const parts = [
      'dashboard',
      method,
      saleId ?? 'all',
      dateFrom ? dateFrom.toISOString().slice(0, 10) : 'none',
      dateTo ? dateTo.toISOString().slice(0, 10) : 'none',
    ];
    return parts.join(':');
  }
}
