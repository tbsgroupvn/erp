import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { OrderStatus } from '@prisma/client';

/** Cache TTL for analytics queries (5 minutes in milliseconds). */
const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;

/** Supported metric types. */
type AnalyticsMetric = 'revenue' | 'orders' | 'containers';

/** Supported period types. */
type AnalyticsPeriod = '6m' | '12m' | '24m';

interface MonthlyDataPoint {
  year: number;
  month: number;
  value: number;
}

export interface MonthlyComparison {
  year: number;
  month: number;
  value: number;
  previousYearValue: number | null;
  yoyChangePercent: number | null;
  movingAverage3m: number | null;
}

export interface AnalyticsResult {
  metric: string;
  period: string;
  data: MonthlyComparison[];
  summary: {
    currentPeriodTotal: number;
    previousPeriodTotal: number;
    overallYoyChangePercent: number | null;
    latestMovingAverage: number | null;
  };
}

/**
 * Analytics Service (BGD-3 Predictive Analytics Phase 1).
 *
 * Provides YoY comparison data and trend analysis for key business
 * metrics: revenue, order count, and container fill rate.
 * All results are cached for 5 minutes.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get analytics for a given metric and period.
   *
   * @param metric  One of: 'revenue', 'orders', 'containers'
   * @param period  One of: '6m', '12m', '24m' (how far back to look)
   */
  async getAnalytics(metric: string, period: string = '12m'): Promise<AnalyticsResult> {
    const validMetric = this.validateMetric(metric);
    const validPeriod = this.validatePeriod(period);
    const cacheKey = `analytics:${validMetric}:${validPeriod}`;

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.computeAnalytics(validMetric, validPeriod),
      ANALYTICS_CACHE_TTL_MS,
    );
  }

  /**
   * Compute analytics from the database for the given metric and period.
   */
  private async computeAnalytics(
    metric: AnalyticsMetric,
    period: AnalyticsPeriod,
  ): Promise<AnalyticsResult> {
    // We need current period + 1 year prior for YoY comparison
    const monthsBack = this.periodToMonths(period);
    const now = new Date();

    // Include an extra 12 months for YoY comparison data
    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack - 12, 1);

    let rawData: MonthlyDataPoint[];

    switch (metric) {
      case 'revenue':
        rawData = await this.getMonthlyRevenue(startDate);
        break;
      case 'orders':
        rawData = await this.getMonthlyOrderCount(startDate);
        break;
      case 'containers':
        rawData = await this.getMonthlyContainerFillRate(startDate);
        break;
    }

    // Build comparison data for the requested period only
    const periodStart = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);

    const comparisons = this.buildComparisons(rawData, periodStart, now);

    // Calculate summary
    const currentPeriodTotal = comparisons.reduce((sum, d) => sum + d.value, 0);
    const previousPeriodTotal = comparisons.reduce((sum, d) => sum + (d.previousYearValue ?? 0), 0);

    const overallYoyChangePercent =
      previousPeriodTotal > 0
        ? ((currentPeriodTotal - previousPeriodTotal) / previousPeriodTotal) * 100
        : null;

    const latestComparison = comparisons[comparisons.length - 1];

    return {
      metric,
      period,
      data: comparisons,
      summary: {
        currentPeriodTotal: Math.round(currentPeriodTotal * 100) / 100,
        previousPeriodTotal: Math.round(previousPeriodTotal * 100) / 100,
        overallYoyChangePercent:
          overallYoyChangePercent !== null ? Math.round(overallYoyChangePercent * 100) / 100 : null,
        latestMovingAverage: latestComparison?.movingAverage3m ?? null,
      },
    };
  }

  /**
   * Query monthly revenue from completed orders grouped by year/month.
   */
  private async getMonthlyRevenue(since: Date): Promise<MonthlyDataPoint[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.COMPLETED,
        completedAt: { gte: since, not: null },
      },
      select: {
        completedAt: true,
        totalAmount: true,
      },
    });

    const buckets = new Map<string, number>();

    for (const order of orders) {
      if (!order.completedAt) continue;
      const year = order.completedAt.getFullYear();
      const month = order.completedAt.getMonth() + 1;
      const key = `${year}-${month}`;
      const current = buckets.get(key) ?? 0;
      buckets.set(key, current + (order.totalAmount?.toNumber() ?? 0));
    }

    return this.bucketsToDataPoints(buckets);
  }

  /**
   * Query monthly order count grouped by year/month.
   */
  private async getMonthlyOrderCount(since: Date): Promise<MonthlyDataPoint[]> {
    const results = await this.prisma.order.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: since },
      },
      _count: { id: true },
    });

    // Re-aggregate by year/month since groupBy on DateTime gives exact timestamps
    const buckets = new Map<string, number>();

    for (const row of results) {
      const year = row.createdAt.getFullYear();
      const month = row.createdAt.getMonth() + 1;
      const key = `${year}-${month}`;
      const current = buckets.get(key) ?? 0;
      buckets.set(key, current + row._count.id);
    }

    return this.bucketsToDataPoints(buckets);
  }

  /**
   * Query monthly average container fill rate.
   */
  private async getMonthlyContainerFillRate(since: Date): Promise<MonthlyDataPoint[]> {
    const containers = await this.prisma.container.findMany({
      where: {
        createdAt: { gte: since },
        fillRate: { not: null },
      },
      select: {
        createdAt: true,
        fillRate: true,
      },
    });

    // Aggregate: average fill rate per month
    const sums = new Map<string, { total: number; count: number }>();

    for (const container of containers) {
      const year = container.createdAt.getFullYear();
      const month = container.createdAt.getMonth() + 1;
      const key = `${year}-${month}`;
      const entry = sums.get(key) ?? { total: 0, count: 0 };
      entry.total += container.fillRate?.toNumber() ?? 0;
      entry.count += 1;
      sums.set(key, entry);
    }

    const dataPoints: MonthlyDataPoint[] = [];
    for (const [key, entry] of sums.entries()) {
      const [yearStr, monthStr] = key.split('-');
      dataPoints.push({
        year: parseInt(yearStr, 10),
        month: parseInt(monthStr, 10),
        value: entry.count > 0 ? Math.round((entry.total / entry.count) * 100) / 100 : 0,
      });
    }

    return dataPoints.sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month));
  }

  /**
   * Build YoY comparison and 3-month moving average from raw data points.
   */
  private buildComparisons(
    rawData: MonthlyDataPoint[],
    periodStart: Date,
    periodEnd: Date,
  ): MonthlyComparison[] {
    // Index raw data for O(1) lookup
    const dataMap = new Map<string, number>();
    for (const dp of rawData) {
      dataMap.set(`${dp.year}-${dp.month}`, dp.value);
    }

    const comparisons: MonthlyComparison[] = [];
    const current = new Date(periodStart);

    while (current <= periodEnd) {
      const year = current.getFullYear();
      const month = current.getMonth() + 1;

      const value = dataMap.get(`${year}-${month}`) ?? 0;
      const previousYearValue = dataMap.get(`${year - 1}-${month}`) ?? null;

      const yoyChangePercent =
        previousYearValue !== null && previousYearValue > 0
          ? Math.round(((value - previousYearValue) / previousYearValue) * 10000) / 100
          : null;

      // 3-month moving average
      const prev1 = this.getValueForOffset(dataMap, year, month, -1);
      const prev2 = this.getValueForOffset(dataMap, year, month, -2);
      const movingAverage3m =
        prev1 !== null && prev2 !== null
          ? Math.round(((value + prev1 + prev2) / 3) * 100) / 100
          : null;

      comparisons.push({
        year,
        month,
        value,
        previousYearValue,
        yoyChangePercent,
        movingAverage3m,
      });

      // Advance to next month
      current.setMonth(current.getMonth() + 1);
    }

    return comparisons;
  }

  /**
   * Get a data value for a month offset from the given year/month.
   */
  private getValueForOffset(
    dataMap: Map<string, number>,
    year: number,
    month: number,
    offsetMonths: number,
  ): number | null {
    const d = new Date(year, month - 1 + offsetMonths, 1);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const val = dataMap.get(key);
    return val !== undefined ? val : null;
  }

  /**
   * Convert a Map<"year-month", value> to sorted MonthlyDataPoint[].
   */
  private bucketsToDataPoints(buckets: Map<string, number>): MonthlyDataPoint[] {
    const dataPoints: MonthlyDataPoint[] = [];

    for (const [key, value] of buckets.entries()) {
      const [yearStr, monthStr] = key.split('-');
      dataPoints.push({
        year: parseInt(yearStr, 10),
        month: parseInt(monthStr, 10),
        value,
      });
    }

    return dataPoints.sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month));
  }

  /**
   * Validate and normalize the metric parameter.
   */
  private validateMetric(metric: string): AnalyticsMetric {
    const validMetrics: AnalyticsMetric[] = ['revenue', 'orders', 'containers'];
    const normalized = metric.toLowerCase() as AnalyticsMetric;

    if (!validMetrics.includes(normalized)) {
      this.logger.warn(`Invalid analytics metric "${metric}", defaulting to "revenue"`);
      return 'revenue';
    }

    return normalized;
  }

  /**
   * Validate and normalize the period parameter.
   */
  private validatePeriod(period: string): AnalyticsPeriod {
    const validPeriods: AnalyticsPeriod[] = ['6m', '12m', '24m'];
    const normalized = period.toLowerCase() as AnalyticsPeriod;

    if (!validPeriods.includes(normalized)) {
      this.logger.warn(`Invalid analytics period "${period}", defaulting to "12m"`);
      return '12m';
    }

    return normalized;
  }

  /**
   * Convert a period string to the number of months.
   */
  private periodToMonths(period: AnalyticsPeriod): number {
    const map: Record<AnalyticsPeriod, number> = {
      '6m': 6,
      '12m': 12,
      '24m': 24,
    };
    return map[period];
  }
}
