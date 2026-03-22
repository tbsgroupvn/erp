import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { ContainerStatus, OrderStatus, Prisma } from '@prisma/client';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DrillDownQueryDto } from './dto/drill-down.dto';

// ---------------------------------------------------------------------------
// Raw query result types for finance stats
// ---------------------------------------------------------------------------

interface ArStatsRaw {
  open_count: bigint;
  open_amount: string | null;
  open_paid: string | null;
  overdue_count: bigint;
  overdue_amount: string | null;
  overdue_paid: string | null;
}

interface ApStatsRaw {
  open_count: bigint;
  open_amount: string | null;
  open_paid: string | null;
  overdue_count: bigint;
  overdue_amount: string | null;
  overdue_paid: string | null;
}

interface CashStatsRaw {
  type: string;
  total_amount: string | null;
  tx_count: bigint;
}

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
   *
   * Optimization: collapsed 7 separate aggregate queries into 3 queries using
   * SQL FILTER clauses (AR, AP, cash) plus 1 count for pending vouchers = 4 total
   * instead of the previous 7.
   */
  async getFinanceStats(query: DashboardQueryDto) {
    const cacheKey = this.getDashboardCacheKey('financeStats', query);

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const t0 = Date.now();
        const branchFilter = query.branch;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // ------------------------------------------------------------------
        // Query 1: AR stats — open count/amounts + overdue count/amounts in 1
        // query using FILTER (WHERE ...) aggregates.
        // Branch filter is applied via a JOIN to the orders table when set.
        // ------------------------------------------------------------------
        const arRows = branchFilter
          ? await this.prisma.$queryRaw<ArStatsRaw[]>`
              SELECT
                COUNT(*) FILTER (WHERE ar.status IN ('OPEN', 'PARTIAL'))                                      AS open_count,
                SUM(ar.amount)      FILTER (WHERE ar.status IN ('OPEN', 'PARTIAL'))                           AS open_amount,
                SUM(ar.paid_amount) FILTER (WHERE ar.status IN ('OPEN', 'PARTIAL'))                           AS open_paid,
                COUNT(*) FILTER (WHERE ar.status IN ('OPEN', 'PARTIAL') AND ar.due_date < ${now})             AS overdue_count,
                SUM(ar.amount)      FILTER (WHERE ar.status IN ('OPEN', 'PARTIAL') AND ar.due_date < ${now})  AS overdue_amount,
                SUM(ar.paid_amount) FILTER (WHERE ar.status IN ('OPEN', 'PARTIAL') AND ar.due_date < ${now})  AS overdue_paid
              FROM account_receivables ar
              INNER JOIN orders o ON o.id = ar.order_id
              WHERE o.branch = ${branchFilter}
            `
          : await this.prisma.$queryRaw<ArStatsRaw[]>`
              SELECT
                COUNT(*) FILTER (WHERE status IN ('OPEN', 'PARTIAL'))                                      AS open_count,
                SUM(amount)       FILTER (WHERE status IN ('OPEN', 'PARTIAL'))                             AS open_amount,
                SUM(paid_amount)  FILTER (WHERE status IN ('OPEN', 'PARTIAL'))                             AS open_paid,
                COUNT(*) FILTER (WHERE status IN ('OPEN', 'PARTIAL') AND due_date < ${now})                AS overdue_count,
                SUM(amount)       FILTER (WHERE status IN ('OPEN', 'PARTIAL') AND due_date < ${now})       AS overdue_amount,
                SUM(paid_amount)  FILTER (WHERE status IN ('OPEN', 'PARTIAL') AND due_date < ${now})       AS overdue_paid
              FROM account_receivables
            `;

        // ------------------------------------------------------------------
        // Query 2: AP stats — same FILTER pattern, no branch filter on AP
        // (AP is vendor-side and not branch-scoped in the current schema)
        // ------------------------------------------------------------------
        const apRows = await this.prisma.$queryRaw<ApStatsRaw[]>`
          SELECT
            COUNT(*) FILTER (WHERE status IN ('OPEN', 'PARTIAL'))                                     AS open_count,
            SUM(amount)      FILTER (WHERE status IN ('OPEN', 'PARTIAL'))                             AS open_amount,
            SUM(paid_amount) FILTER (WHERE status IN ('OPEN', 'PARTIAL'))                             AS open_paid,
            COUNT(*) FILTER (WHERE status IN ('OPEN', 'PARTIAL') AND due_date < ${now})               AS overdue_count,
            SUM(amount)      FILTER (WHERE status IN ('OPEN', 'PARTIAL') AND due_date < ${now})       AS overdue_amount,
            SUM(paid_amount) FILTER (WHERE status IN ('OPEN', 'PARTIAL') AND due_date < ${now})       AS overdue_paid
          FROM account_payables
        `;

        // ------------------------------------------------------------------
        // Query 3: Cash stats — single groupBy on type (IN/OUT) for the
        // current month. Returns at most 2 rows instead of 2 aggregates.
        // ------------------------------------------------------------------
        const cashRows = await this.prisma.$queryRaw<CashStatsRaw[]>`
          SELECT
            type,
            SUM(amount) AS total_amount,
            COUNT(*)    AS tx_count
          FROM cash_transactions
          WHERE created_at >= ${monthStart}
          GROUP BY type
        `;

        // ------------------------------------------------------------------
        // Query 4: pending voucher count (simple COUNT, no aggregation needed)
        // ------------------------------------------------------------------
        const pendingVouchers = await this.prisma.paymentVoucher.count({
          where: {
            status: 'PENDING',
            ...(branchFilter ? { order: { branch: branchFilter } } : {}),
          },
        });

        // ------------------------------------------------------------------
        // Materialise results
        // ------------------------------------------------------------------
        const ar = arRows[0] ?? ({} as ArStatsRaw);
        const ap = apRows[0] ?? ({} as ApStatsRaw);

        const arOutstanding =
          parseFloat(ar.open_amount ?? '0') - parseFloat(ar.open_paid ?? '0');
        const arOverdueAmount =
          parseFloat(ar.overdue_amount ?? '0') - parseFloat(ar.overdue_paid ?? '0');
        const apOutstanding =
          parseFloat(ap.open_amount ?? '0') - parseFloat(ap.open_paid ?? '0');
        const apOverdueAmount =
          parseFloat(ap.overdue_amount ?? '0') - parseFloat(ap.overdue_paid ?? '0');

        const cashIn  = cashRows.find((r) => r.type === 'IN');
        const cashOut = cashRows.find((r) => r.type === 'OUT');
        const monthlyInflow  = parseFloat(cashIn?.total_amount  ?? '0');
        const monthlyOutflow = parseFloat(cashOut?.total_amount ?? '0');

        this.logger.debug(`getFinanceStats completed in ${Date.now() - t0}ms (4 queries)`);

        return {
          accountsReceivable: {
            totalOutstanding: arOutstanding,
            overdueAmount: arOverdueAmount,
            openCount: Number(ar.open_count ?? 0n),
            overdueCount: Number(ar.overdue_count ?? 0n),
          },
          accountsPayable: {
            totalOutstanding: apOutstanding,
            overdueAmount: apOverdueAmount,
            openCount: Number(ap.open_count ?? 0n),
            overdueCount: Number(ap.overdue_count ?? 0n),
          },
          cashFlow: {
            monthlyInflow,
            monthlyOutflow,
            netFlow: monthlyInflow - monthlyOutflow,
            inflowCount: Number(cashIn?.tx_count ?? 0n),
            outflowCount: Number(cashOut?.tx_count ?? 0n),
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
