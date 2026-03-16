import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { OrderStatus } from '@prisma/client';

/**
 * KT-1: Financial Reports Service.
 *
 * Provides three core financial reports:
 *  - Order P&L (profit & loss per order)
 *  - Margin by shipping route
 *  - Cash flow forecast (AR/AP due within N days, grouped by week)
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Order-level Profit & Loss report.
   *
   * For each completed order in the date range:
   *   revenue  = sum of AccountReceivable amounts linked to the order
   *   cost     = sum of PaymentVoucher amounts + CostAllocation amounts + CustomsTaxAllocation amounts
   *   profit   = revenue - cost
   *   margin   = (profit / revenue) * 100
   *
   * When `orderId` is provided the report is scoped to a single order,
   * otherwise all completed orders within [dateFrom, dateTo] are included.
   */
  async getOrderPnL(orderId?: string, dateFrom?: Date, dateTo?: Date) {
    const where: any = {
      status: OrderStatus.COMPLETED,
    };

    if (orderId) {
      where.id = orderId;
    }

    if (dateFrom || dateTo) {
      where.completedAt = {};
      if (dateFrom) where.completedAt.gte = dateFrom;
      if (dateTo) where.completedAt.lte = dateTo;
    }

    const orders = await this.prisma.order.findMany({
      where,
      select: {
        id: true,
        code: true,
        receivables: {
          select: { amount: true },
        },
        paymentVouchers: {
          where: { status: 'APPROVED' },
          select: { amount: true },
        },
        costAllocations: {
          select: { allocatedAmount: true },
        },
        costAdjustments: {
          where: { status: 'APPROVED' },
          select: { amount: true },
        },
      },
    });

    // Batch-fetch customs tax allocations for all order IDs
    const orderIds = orders.map((o) => o.id);
    const taxAllocations = await this.prisma.customsTaxAllocation.findMany({
      where: { orderId: { in: orderIds } },
      select: { orderId: true, totalAllocated: true },
    });

    const taxByOrder = new Map<string, number>();
    for (const ta of taxAllocations) {
      const current = taxByOrder.get(ta.orderId) ?? 0;
      taxByOrder.set(ta.orderId, current + Number(ta.totalAllocated));
    }

    const results = orders.map((order) => {
      const revenue = order.receivables.reduce((sum, ar) => sum + Number(ar.amount), 0);

      const voucherCost = order.paymentVouchers.reduce((sum, pv) => sum + Number(pv.amount), 0);

      const operationCost = order.costAllocations.reduce(
        (sum, ca) => sum + Number(ca.allocatedAmount),
        0,
      );

      const adjustmentCost = order.costAdjustments.reduce(
        (sum, ca) => sum + Number(ca.amount),
        0,
      );

      const customsTax = taxByOrder.get(order.id) ?? 0;
      const cost = voucherCost + operationCost + customsTax + adjustmentCost;
      const netProfit = revenue - cost;
      const marginPercent = revenue > 0 ? Math.round((netProfit / revenue) * 10000) / 100 : 0;

      return {
        orderId: order.id,
        code: order.code,
        revenue,
        cost,
        netProfit,
        marginPercent,
      };
    });

    this.logger.log(`Order P&L report generated: ${results.length} order(s)`);

    return results;
  }

  /**
   * Margin analysis grouped by shipping route (SEA, ROAD, AIR).
   *
   * Aggregates completed orders within the date range and computes
   * total revenue, cost, and margin for each route.
   */
  async getMarginByRoute(dateFrom?: Date, dateTo?: Date) {
    const where: any = {
      status: OrderStatus.COMPLETED,
      shippingRoute: { not: null },
    };

    if (dateFrom || dateTo) {
      where.completedAt = {};
      if (dateFrom) where.completedAt.gte = dateFrom;
      if (dateTo) where.completedAt.lte = dateTo;
    }

    const orders = await this.prisma.order.findMany({
      where,
      select: {
        id: true,
        shippingRoute: true,
        receivables: {
          select: { amount: true },
        },
        paymentVouchers: {
          where: { status: 'APPROVED' },
          select: { amount: true },
        },
        costAllocations: {
          select: { allocatedAmount: true },
        },
        costAdjustments: {
          where: { status: 'APPROVED' },
          select: { amount: true },
        },
      },
    });

    // Batch-fetch customs tax allocations
    const orderIds = orders.map((o) => o.id);
    const taxAllocations = await this.prisma.customsTaxAllocation.findMany({
      where: { orderId: { in: orderIds } },
      select: { orderId: true, totalAllocated: true },
    });

    const taxByOrder = new Map<string, number>();
    for (const ta of taxAllocations) {
      const current = taxByOrder.get(ta.orderId) ?? 0;
      taxByOrder.set(ta.orderId, current + Number(ta.totalAllocated));
    }

    // Aggregate by route
    const routeMap = new Map<string, { orderCount: number; revenue: number; cost: number }>();

    for (const order of orders) {
      const route = order.shippingRoute!;
      const entry = routeMap.get(route) ?? {
        orderCount: 0,
        revenue: 0,
        cost: 0,
      };

      entry.orderCount++;

      entry.revenue += order.receivables.reduce((sum, ar) => sum + Number(ar.amount), 0);

      const voucherCost = order.paymentVouchers.reduce((sum, pv) => sum + Number(pv.amount), 0);
      const operationCost = order.costAllocations.reduce(
        (sum, ca) => sum + Number(ca.allocatedAmount),
        0,
      );
      const adjustmentCost = order.costAdjustments.reduce(
        (sum, ca) => sum + Number(ca.amount),
        0,
      );
      const customsTax = taxByOrder.get(order.id) ?? 0;

      entry.cost += voucherCost + operationCost + customsTax + adjustmentCost;

      routeMap.set(route, entry);
    }

    const routes = Array.from(routeMap.entries()).map(([route, data]) => {
      const margin = data.revenue - data.cost;
      const marginPercent =
        data.revenue > 0 ? Math.round((margin / data.revenue) * 10000) / 100 : 0;

      return {
        route,
        orderCount: data.orderCount,
        revenue: data.revenue,
        cost: data.cost,
        margin,
        marginPercent,
      };
    });

    this.logger.log(`Margin by route report generated: ${routes.length} route(s)`);

    return { routes };
  }

  /**
   * Cash flow forecast for the next N days.
   *
   * Groups outstanding AR (expected inflow) and AP (expected outflow) by
   * their due dates into weekly buckets, providing a forward-looking view
   * of cash position.
   */
  async getCashFlowForecast(days: number = 30) {
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + days);

    const [arRecords, apRecords] = await Promise.all([
      this.prisma.accountReceivable.findMany({
        where: {
          status: { in: ['OPEN', 'PARTIAL'] },
          dueDate: { gte: now, lte: horizon },
        },
        select: { amount: true, paidAmount: true, dueDate: true },
      }),
      this.prisma.accountPayable.findMany({
        where: {
          status: { in: ['OPEN', 'PARTIAL'] },
          dueDate: { gte: now, lte: horizon },
        },
        select: { amount: true, paidAmount: true, dueDate: true },
      }),
    ]);

    // Build weekly buckets
    const weeks: Array<{
      weekStart: Date;
      weekEnd: Date;
      inflow: number;
      outflow: number;
      netPosition: number;
    }> = [];

    const weekStart = new Date(now);
    // Align to Monday
    weekStart.setHours(0, 0, 0, 0);
    const dayOfWeek = weekStart.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + mondayOffset);

    const cursor = new Date(weekStart);
    while (cursor <= horizon) {
      const wStart = new Date(cursor);
      const wEnd = new Date(cursor);
      wEnd.setDate(wEnd.getDate() + 6);
      wEnd.setHours(23, 59, 59, 999);

      weeks.push({
        weekStart: wStart,
        weekEnd: wEnd,
        inflow: 0,
        outflow: 0,
        netPosition: 0,
      });

      cursor.setDate(cursor.getDate() + 7);
    }

    // Distribute AR into weekly buckets
    for (const ar of arRecords) {
      const outstanding = Number(ar.amount) - Number(ar.paidAmount);
      if (outstanding <= 0) continue;

      const week = weeks.find((w) => ar.dueDate >= w.weekStart && ar.dueDate <= w.weekEnd);
      if (week) {
        week.inflow += outstanding;
      }
    }

    // Distribute AP into weekly buckets
    for (const ap of apRecords) {
      const outstanding = Number(ap.amount) - Number(ap.paidAmount);
      if (outstanding <= 0) continue;

      const week = weeks.find((w) => ap.dueDate >= w.weekStart && ap.dueDate <= w.weekEnd);
      if (week) {
        week.outflow += outstanding;
      }
    }

    // Calculate net position per week
    for (const week of weeks) {
      week.inflow = Math.round(week.inflow * 100) / 100;
      week.outflow = Math.round(week.outflow * 100) / 100;
      week.netPosition = Math.round((week.inflow - week.outflow) * 100) / 100;
    }

    // Filter out weeks that are entirely outside the forecast window
    const relevantWeeks = weeks.filter((w) => w.weekEnd >= now && w.weekStart <= horizon);

    const totalInflow = relevantWeeks.reduce((s, w) => s + w.inflow, 0);
    const totalOutflow = relevantWeeks.reduce((s, w) => s + w.outflow, 0);

    this.logger.log(`Cash flow forecast generated: ${days} days, ${relevantWeeks.length} week(s)`);

    return {
      weeks: relevantWeeks,
      summary: {
        totalInflow: Math.round(totalInflow * 100) / 100,
        totalOutflow: Math.round(totalOutflow * 100) / 100,
        netPosition: Math.round((totalInflow - totalOutflow) * 100) / 100,
      },
    };
  }
}
