import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Branch, OrderStatus, Prisma } from '@prisma/client';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get a high-level overview: total orders, revenue, customers for the period.
   */
  async getOverview(query: DashboardQueryDto) {
    const { start, end } = query.getDateRange();
    const branchFilter: Prisma.OrderWhereInput = query.branch
      ? { branch: query.branch }
      : {};

    const [
      totalOrders,
      totalRevenue,
      newCustomers,
      completedOrders,
    ] = await Promise.all([
      // Total orders created in period
      this.prisma.order.count({
        where: {
          createdAt: { gte: start, lte: end },
          ...branchFilter,
        },
      }),

      // Total revenue (sum of totalAmount for completed orders)
      this.prisma.order.aggregate({
        where: {
          completedAt: { gte: start, lte: end },
          status: OrderStatus.COMPLETED,
          ...branchFilter,
        },
        _sum: { totalAmount: true },
      }),

      // New customers created in period
      this.prisma.customer.count({
        where: {
          createdAt: { gte: start, lte: end },
          ...(query.branch ? { branch: query.branch } : {}),
        },
      }),

      // Completed orders in period
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
  }

  /**
   * Get order statistics: breakdown by status and service type.
   */
  async getOrderStats(query: DashboardQueryDto) {
    const { start, end } = query.getDateRange();
    const branchFilter: Prisma.OrderWhereInput = query.branch
      ? { branch: query.branch }
      : {};

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
  }

  /**
   * Get finance statistics: AR/AP totals, overdue amounts, cash flow.
   */
  async getFinanceStats(query: DashboardQueryDto) {
    const branchFilter = query.branch;

    const [
      arOpen,
      arOverdue,
      apOpen,
      apOverdue,
      cashIn,
      cashOut,
      pendingVouchers,
    ] = await Promise.all([
      // Total open AR
      this.prisma.accountReceivable.aggregate({
        where: { status: { in: ['OPEN', 'PARTIAL'] } },
        _sum: { amount: true, paidAmount: true },
        _count: true,
      }),

      // Overdue AR
      this.prisma.accountReceivable.aggregate({
        where: {
          status: { in: ['OPEN', 'PARTIAL'] },
          dueDate: { lt: new Date() },
        },
        _sum: { amount: true, paidAmount: true },
        _count: true,
      }),

      // Total open AP
      this.prisma.accountPayable.aggregate({
        where: { status: { in: ['OPEN', 'PARTIAL'] } },
        _sum: { amount: true, paidAmount: true },
        _count: true,
      }),

      // Overdue AP
      this.prisma.accountPayable.aggregate({
        where: {
          status: { in: ['OPEN', 'PARTIAL'] },
          dueDate: { lt: new Date() },
        },
        _sum: { amount: true, paidAmount: true },
        _count: true,
      }),

      // Cash inflow this month
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

      // Cash outflow this month
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

      // Pending vouchers
      this.prisma.paymentVoucher.count({
        where: { status: 'PENDING' },
      }),
    ]);

    const arOutstanding =
      (arOpen._sum.amount?.toNumber() ?? 0) -
      (arOpen._sum.paidAmount?.toNumber() ?? 0);
    const arOverdueAmount =
      (arOverdue._sum.amount?.toNumber() ?? 0) -
      (arOverdue._sum.paidAmount?.toNumber() ?? 0);
    const apOutstanding =
      (apOpen._sum.amount?.toNumber() ?? 0) -
      (apOpen._sum.paidAmount?.toNumber() ?? 0);
    const apOverdueAmount =
      (apOverdue._sum.amount?.toNumber() ?? 0) -
      (apOverdue._sum.paidAmount?.toNumber() ?? 0);

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
        netFlow:
          (cashIn._sum.amount?.toNumber() ?? 0) -
          (cashOut._sum.amount?.toNumber() ?? 0),
        inflowCount: cashIn._count,
        outflowCount: cashOut._count,
      },
      pendingVouchers,
    };
  }

  /**
   * Get warehouse statistics: packages in transit, pending delivery, etc.
   */
  async getWarehouseStats(query: DashboardQueryDto) {
    const branchFilter = query.branch;

    const [
      inTransit,
      pendingDelivery,
      warehouseCN,
      warehouseVN,
      delivering,
    ] = await Promise.all([
      // Orders in transit
      this.prisma.order.count({
        where: {
          status: OrderStatus.IN_TRANSIT,
          ...(branchFilter ? { branch: branchFilter } : {}),
        },
      }),

      // Orders in VN warehouse waiting for delivery
      this.prisma.order.count({
        where: {
          status: OrderStatus.WAREHOUSE_VN,
          ...(branchFilter ? { branch: branchFilter } : {}),
        },
      }),

      // Orders in CN warehouse
      this.prisma.order.count({
        where: {
          status: OrderStatus.WAREHOUSE_CN,
          ...(branchFilter ? { branch: branchFilter } : {}),
        },
      }),

      // Orders at VN warehouse (received)
      this.prisma.order.count({
        where: {
          status: OrderStatus.WAREHOUSE_VN,
          ...(branchFilter ? { branch: branchFilter } : {}),
        },
      }),

      // Orders currently being delivered
      this.prisma.order.count({
        where: {
          status: OrderStatus.DELIVERING,
          ...(branchFilter ? { branch: branchFilter } : {}),
        },
      }),
    ]);

    // Packages at customs
    const atCustoms = await this.prisma.order.count({
      where: {
        status: OrderStatus.CUSTOMS,
        ...(branchFilter ? { branch: branchFilter } : {}),
      },
    });

    // Packing / consolidation
    const [packing, consolidation] = await Promise.all([
      this.prisma.order.count({
        where: {
          status: OrderStatus.PACKING,
          ...(branchFilter ? { branch: branchFilter } : {}),
        },
      }),
      this.prisma.order.count({
        where: {
          status: OrderStatus.CONSOLIDATION,
          ...(branchFilter ? { branch: branchFilter } : {}),
        },
      }),
    ]);

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
          warehouseCN +
          packing +
          consolidation +
          inTransit +
          atCustoms +
          warehouseVN +
          delivering,
      },
    };
  }
}
