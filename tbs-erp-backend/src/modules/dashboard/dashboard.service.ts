import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { ContainerStatus, OrderStatus, Prisma } from '@prisma/client';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DrillDownQueryDto } from './dto/drill-down.dto';

/** Cache TTL for dashboard queries (5 minutes in milliseconds). */
const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Generates a cache key for dashboard queries based on method and query params.
   */
  private getDashboardCacheKey(method: string, query: DashboardQueryDto): string {
    const { start, end } = query.getDateRange();
    return `dashboard:${method}:${query.branch ?? 'all'}:${start.toISOString()}:${end.toISOString()}`;
  }

  /**
   * Get a high-level overview: total orders, revenue, customers for the period.
   * Results are cached for 5 minutes to reduce database load.
   */
  async getOverview(query: DashboardQueryDto) {
    const cacheKey = this.getDashboardCacheKey('overview', query);

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const { start, end } = query.getDateRange();
        const branchFilter: Prisma.OrderWhereInput = query.branch ? { branch: query.branch } : {};

        const [totalOrders, totalRevenue, newCustomers, completedOrders] = await Promise.all([
          this.prisma.order.count({
            where: {
              createdAt: { gte: start, lte: end },
              ...branchFilter,
            },
          }),
          this.prisma.order.aggregate({
            where: {
              completedAt: { gte: start, lte: end },
              status: OrderStatus.COMPLETED,
              ...branchFilter,
            },
            _sum: { totalAmount: true },
          }),
          this.prisma.customer.count({
            where: {
              createdAt: { gte: start, lte: end },
              ...(query.branch ? { branch: query.branch } : {}),
            },
          }),
          this.prisma.order.count({
            where: {
              completedAt: { gte: start, lte: end },
              status: OrderStatus.COMPLETED,
              ...branchFilter,
            },
          }),
        ]);

        return {
          period: { start, end },
          totalOrders,
          completedOrders,
          totalRevenue: totalRevenue._sum.totalAmount?.toNumber() ?? 0,
          newCustomers,
        };
      },
      DASHBOARD_CACHE_TTL_MS,
    );
  }

  /**
   * Get order statistics: breakdown by status and service type.
   * Results are cached for 5 minutes to reduce database load.
   */
  async getOrderStats(query: DashboardQueryDto) {
    const cacheKey = this.getDashboardCacheKey('orderStats', query);

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const { start, end } = query.getDateRange();
        const branchFilter: Prisma.OrderWhereInput = query.branch ? { branch: query.branch } : {};

        const dateFilter: Prisma.OrderWhereInput = {
          createdAt: { gte: start, lte: end },
          ...branchFilter,
        };

        // Orders by status
        const byStatus = await this.prisma.order.groupBy({
          by: ['status'],
          where: dateFilter,
          _count: { id: true },
          _sum: { totalAmount: true },
        });

        // Orders by service type
        const byServiceType = await this.prisma.order.groupBy({
          by: ['serviceType'],
          where: dateFilter,
          _count: { id: true },
          _sum: { totalAmount: true },
        });

        // Active orders (not completed/cancelled)
        const activeOrders = await this.prisma.order.count({
          where: {
            status: {
              notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
            },
            ...branchFilter,
          },
        });

        // Orders pending deposit
        const pendingDeposit = await this.prisma.order.count({
          where: {
            status: OrderStatus.PENDING_DEPOSIT,
            ...branchFilter,
          },
        });

        return {
          period: { start, end },
          byStatus: byStatus.map((s) => ({
            status: s.status,
            count: s._count.id,
            totalAmount: s._sum.totalAmount?.toNumber() ?? 0,
          })),
          byServiceType: byServiceType.map((s) => ({
            serviceType: s.serviceType,
            count: s._count.id,
            totalAmount: s._sum.totalAmount?.toNumber() ?? 0,
          })),
          activeOrders,
          pendingDeposit,
        };
      },
      DASHBOARD_CACHE_TTL_MS,
    );
  }

  /**
   * Get finance statistics: AR/AP totals, overdue amounts, cash flow.
   * Results are cached for 5 minutes to reduce database load.
   */
  async getFinanceStats(query: DashboardQueryDto) {
    const cacheKey = this.getDashboardCacheKey('financeStats', query);

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const branchFilter = query.branch;

        const [arOpen, arOverdue, apOpen, apOverdue, cashIn, cashOut, pendingVouchers] =
          await Promise.all([
            this.prisma.accountReceivable.aggregate({
              where: {
                status: { in: ['OPEN', 'PARTIAL'] },
                ...(branchFilter ? { order: { branch: branchFilter } } : {}),
              },
              _sum: { amount: true, paidAmount: true },
              _count: true,
            }),
            this.prisma.accountReceivable.aggregate({
              where: {
                status: { in: ['OPEN', 'PARTIAL'] },
                dueDate: { lt: new Date() },
                ...(branchFilter ? { order: { branch: branchFilter } } : {}),
              },
              _sum: { amount: true, paidAmount: true },
              _count: true,
            }),
            this.prisma.accountPayable.aggregate({
              where: { status: { in: ['OPEN', 'PARTIAL'] } },
              _sum: { amount: true, paidAmount: true },
              _count: true,
            }),
            this.prisma.accountPayable.aggregate({
              where: {
                status: { in: ['OPEN', 'PARTIAL'] },
                dueDate: { lt: new Date() },
              },
              _sum: { amount: true, paidAmount: true },
              _count: true,
            }),
            this.prisma.cashTransaction.aggregate({
              where: {
                type: 'IN',
                createdAt: {
                  gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                },
              },
              _sum: { amount: true },
              _count: true,
            }),
            this.prisma.cashTransaction.aggregate({
              where: {
                type: 'OUT',
                createdAt: {
                  gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                },
              },
              _sum: { amount: true },
              _count: true,
            }),
            this.prisma.paymentVoucher.count({
              where: {
                status: 'PENDING',
                ...(branchFilter ? { order: { branch: branchFilter } } : {}),
              },
            }),
          ]);

        const arOutstanding =
          (arOpen._sum.amount?.toNumber() ?? 0) - (arOpen._sum.paidAmount?.toNumber() ?? 0);
        const arOverdueAmount =
          (arOverdue._sum.amount?.toNumber() ?? 0) - (arOverdue._sum.paidAmount?.toNumber() ?? 0);
        const apOutstanding =
          (apOpen._sum.amount?.toNumber() ?? 0) - (apOpen._sum.paidAmount?.toNumber() ?? 0);
        const apOverdueAmount =
          (apOverdue._sum.amount?.toNumber() ?? 0) - (apOverdue._sum.paidAmount?.toNumber() ?? 0);

        return {
          accountsReceivable: {
            totalOutstanding: arOutstanding,
            overdueAmount: arOverdueAmount,
            openCount: arOpen._count,
            overdueCount: arOverdue._count,
          },
          accountsPayable: {
            totalOutstanding: apOutstanding,
            overdueAmount: apOverdueAmount,
            openCount: apOpen._count,
            overdueCount: apOverdue._count,
          },
          cashFlow: {
            monthlyInflow: cashIn._sum.amount?.toNumber() ?? 0,
            monthlyOutflow: cashOut._sum.amount?.toNumber() ?? 0,
            netFlow: (cashIn._sum.amount?.toNumber() ?? 0) - (cashOut._sum.amount?.toNumber() ?? 0),
            inflowCount: cashIn._count,
            outflowCount: cashOut._count,
          },
          pendingVouchers,
        };
      },
      DASHBOARD_CACHE_TTL_MS,
    );
  }

  /**
   * Get warehouse statistics: packages in transit, pending delivery, etc.
   * Results are cached for 5 minutes to reduce database load.
   */
  async getWarehouseStats(query: DashboardQueryDto) {
    const cacheKey = this.getDashboardCacheKey('warehouseStats', query);

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const branchFilter = query.branch;

        // Consolidate 7 separate count() calls into a single groupBy query
        const warehouseStatuses = [
          OrderStatus.WAREHOUSE_CN,
          OrderStatus.PACKING,
          OrderStatus.CONSOLIDATION,
          OrderStatus.IN_TRANSIT,
          OrderStatus.CUSTOMS,
          OrderStatus.WAREHOUSE_VN,
          OrderStatus.DELIVERING,
        ];

        const grouped = await this.prisma.order.groupBy({
          by: ['status'],
          where: {
            status: { in: warehouseStatuses },
            ...(branchFilter ? { branch: branchFilter } : {}),
          },
          _count: { id: true },
        });

        // Build a lookup map from the single query result
        const countByStatus = new Map(grouped.map((g) => [g.status, g._count.id]));
        const get = (s: OrderStatus) => countByStatus.get(s) ?? 0;

        const warehouseCN  = get(OrderStatus.WAREHOUSE_CN);
        const packing      = get(OrderStatus.PACKING);
        const consolidation = get(OrderStatus.CONSOLIDATION);
        const inTransit    = get(OrderStatus.IN_TRANSIT);
        const atCustoms    = get(OrderStatus.CUSTOMS);
        const warehouseVN  = get(OrderStatus.WAREHOUSE_VN);
        const delivering   = get(OrderStatus.DELIVERING);
        // pendingDelivery is an alias for DELIVERING per original logic
        const pendingDelivery = delivering;

        return {
          warehouseCN,
          packing,
          consolidation,
          inTransit,
          atCustoms,
          warehouseVN,
          pendingDelivery,
          delivering,
          pipeline: {
            total:
              warehouseCN + packing + consolidation + inTransit + atCustoms + warehouseVN + delivering,
          },
        };
      },
      DASHBOARD_CACHE_TTL_MS,
    );
  }

  /**
   * Get HR statistics: headcount, by department, by role, new hires.
   * Results are cached for 5 minutes to reduce database load.
   */
  async getHRStats(query: DashboardQueryDto) {
    const cacheKey = this.getDashboardCacheKey('hrStats', query);

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const { start, end } = query.getDateRange();
        const branchFilter = query.branch;

        const baseWhere: Prisma.EmployeeWhereInput = {
          status: 'ACTIVE',
          ...(branchFilter ? { branch: branchFilter } : {}),
        };

        const [totalEmployees, byDepartment, newHires, resignedCount] = await Promise.all([
          this.prisma.employee.count({ where: baseWhere }),
          this.prisma.employee.groupBy({
            by: ['departmentCode'],
            where: baseWhere,
            _count: true,
          }),
          this.prisma.employee.count({
            where: {
              ...baseWhere,
              joinDate: { gte: start, lte: end },
            },
          }),
          this.prisma.employee.count({
            where: {
              status: { not: 'ACTIVE' },
              updatedAt: { gte: start, lte: end },
              ...(branchFilter ? { branch: branchFilter } : {}),
            },
          }),
        ]);

        return {
          period: { start, end },
          totalEmployees,
          newHires,
          resigned: resignedCount,
          byDepartment: byDepartment.map((d) => ({
            department: d.departmentCode,
            count: d._count,
          })),
        };
      },
      DASHBOARD_CACHE_TTL_MS,
    );
  }

  /**
   * Invalidate all dashboard caches.
   * Useful when significant data changes occur (e.g., bulk order updates).
   */
  async invalidateDashboardCaches(): Promise<void> {
    await this.cacheService.invalidateByPrefix('dashboard:');
    this.logger.debug('All dashboard caches invalidated');
  }

  /**
   * Drill-down: lay danh sach ban ghi thuc te dang sau mot KPI.
   * Ho tro: total_orders | ar_outstanding | containers_in_transit | active_customers
   */
  async getDrillDown(query: DrillDownQueryDto) {
    const { metric, branch } = query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const branchFilter = branch ? { branch: branch as any } : {};

    switch (metric) {
      case 'total_orders': {
        // Lay don hang gan nhat (tat ca trang thai)
        const [data, total] = await Promise.all([
          this.prisma.order.findMany({
            where: { ...branchFilter },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            select: {
              id: true,
              code: true,
              status: true,
              serviceType: true,
              totalAmount: true,
              currency: true,
              branch: true,
              createdAt: true,
              customer: { select: { id: true, fullName: true, code: true } },
            },
          }),
          this.prisma.order.count({ where: { ...branchFilter } }),
        ]);

        return {
          metric,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          data: data.map((o) => ({
            ...o,
            totalAmount: o.totalAmount.toNumber(),
          })),
        };
      }

      case 'ar_outstanding': {
        // Lay AR dang con no (OPEN + PARTIAL), chua qua han hoac qua han
        const where: Prisma.AccountReceivableWhereInput = {
          status: { in: ['OPEN', 'PARTIAL'] as any[] },
          ...(branch ? { order: { branch: branch as any } } : {}),
        };

        const [data, total] = await Promise.all([
          this.prisma.accountReceivable.findMany({
            where,
            orderBy: { dueDate: 'asc' },
            skip,
            take: limit,
            select: {
              id: true,
              code: true,
              amount: true,
              paidAmount: true,
              currency: true,
              dueDate: true,
              status: true,
              createdAt: true,
              customer: { select: { id: true, fullName: true, code: true } },
              order: { select: { id: true, code: true } },
            },
          }),
          this.prisma.accountReceivable.count({ where }),
        ]);

        return {
          metric,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          data: data.map((ar) => ({
            ...ar,
            amount: ar.amount.toNumber(),
            paidAmount: ar.paidAmount.toNumber(),
            outstanding: ar.amount.sub(ar.paidAmount).toNumber(),
            isOverdue: ar.dueDate < new Date(),
          })),
        };
      }

      case 'containers_in_transit': {
        // Lay container dang IN_TRANSIT
        const where: Prisma.ContainerWhereInput = {
          status: ContainerStatus.IN_TRANSIT,
        };

        const [data, total] = await Promise.all([
          this.prisma.container.findMany({
            where,
            orderBy: { updatedAt: 'asc' },
            skip,
            take: limit,
            select: {
              id: true,
              code: true,
              status: true,
              shippingRoute: true,
              carrier: true,
              containerNumber: true,
              vesselName: true,
              voyageNumber: true,
              portOfLoading: true,
              portOfDischarge: true,
              estimatedDepartureAt: true,
              estimatedArrivalAt: true,
              actualArrivalAt: true,
              updatedAt: true,
            },
          }),
          this.prisma.container.count({ where }),
        ]);

        return {
          metric,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          data,
        };
      }

      case 'active_customers': {
        // Lay khach hang dang hoat dong, chua bi khoa
        const where: Prisma.CustomerWhereInput = {
          isActive: true,
          isBlocked: false,
          ...branchFilter,
        };

        const [data, total] = await Promise.all([
          this.prisma.customer.findMany({
            where,
            orderBy: { totalRevenue: 'desc' },
            skip,
            take: limit,
            select: {
              id: true,
              code: true,
              fullName: true,
              companyName: true,
              phone: true,
              tier: true,
              totalOrders: true,
              totalRevenue: true,
              currentDebt: true,
              branch: true,
              createdAt: true,
            },
          }),
          this.prisma.customer.count({ where }),
        ]);

        return {
          metric,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          data: data.map((c) => ({
            ...c,
            totalRevenue: c.totalRevenue.toNumber(),
            currentDebt: c.currentDebt.toNumber(),
          })),
        };
      }

      default:
        return { metric, total: 0, page, limit, totalPages: 0, data: [] };
    }
  }
}
