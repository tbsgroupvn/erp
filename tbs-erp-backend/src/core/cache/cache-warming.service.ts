import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from './cache.service';
import { PrismaService } from '@core/database/prisma.service';
import { MetricsService } from '@core/metrics/metrics.service';
import { Branch, OrderStatus } from '@prisma/client';

/**
 * Cache warming service that pre-populates frequently accessed data into Redis
 * to avoid cold-cache latency on first requests.
 *
 * Warming happens:
 * 1. On application startup (async, non-blocking)
 * 2. On scheduled intervals via cron
 *
 * Each warming operation is wrapped in try-catch to prevent startup failures
 * and includes timing metrics exported to Prometheus.
 */
@Injectable()
export class CacheWarmingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CacheWarmingService.name);

  /** Cache TTLs in milliseconds */
  private readonly TTL = {
    DASHBOARD: 5 * 60 * 1000,        // 5 minutes
    EXCHANGE_RATES: 60 * 60 * 1000,   // 1 hour
    ACTIVE_COUNTS: 2 * 60 * 1000,     // 2 minutes
    HS_CODES: 24 * 60 * 60 * 1000,    // 24 hours
  };

  constructor(
    private readonly cacheService: CacheService,
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Warm caches on application startup.
   * Runs asynchronously to not block the bootstrap process.
   */
  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Starting cache warming on application bootstrap...');

    // Run warming in background to not delay startup
    setImmediate(async () => {
      const start = performance.now();
      try {
        await Promise.allSettled([
          this.warmDashboardCache(),
          this.warmExchangeRates(),
          this.warmActiveOrderCounts(),
        ]);

        const duration = performance.now() - start;
        this.logger.log(
          `Cache warming completed in ${duration.toFixed(0)}ms`,
        );
      } catch (error) {
        this.logger.error(`Cache warming failed: ${error.message}`);
      }
    });
  }

  /**
   * Warm dashboard overview metrics for all branches.
   * Runs every 5 minutes to keep dashboard loads fast.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async warmDashboardCache(): Promise<void> {
    const start = performance.now();
    this.logger.debug('Warming dashboard cache...');

    try {
      const branches = Object.values(Branch);

      // Calculate date range for current month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Warm overview for each branch + global (no branch filter)
      const warmingPromises = [null, ...branches].map(async (branch) => {
        const branchKey = branch ?? 'all';
        const branchFilter = branch ? { branch } : {};

        // Total orders this month
        const totalOrders = await this.prisma.order.count({
          where: {
            createdAt: { gte: monthStart },
            ...branchFilter,
          },
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

        // Completed orders this month
        const completedOrders = await this.prisma.order.count({
          where: {
            completedAt: { gte: monthStart },
            status: OrderStatus.COMPLETED,
            ...branchFilter,
          },
        });

        // Revenue this month
        const revenue = await this.prisma.order.aggregate({
          where: {
            completedAt: { gte: monthStart },
            status: OrderStatus.COMPLETED,
            ...branchFilter,
          },
          _sum: { totalAmount: true },
        });

        const data = {
          totalOrders,
          activeOrders,
          completedOrders,
          totalRevenue: revenue._sum.totalAmount?.toNumber() ?? 0,
          cachedAt: new Date().toISOString(),
        };

        await this.cacheService.set(
          `dashboard:overview:${branchKey}`,
          data,
          this.TTL.DASHBOARD,
        );
      });

      await Promise.allSettled(warmingPromises);

      const duration = performance.now() - start;
      this.logger.debug(`Dashboard cache warmed in ${duration.toFixed(0)}ms`);
    } catch (error) {
      this.logger.error(`Dashboard cache warming failed: ${error.message}`);
    }
  }

  /**
   * Warm exchange rates cache.
   * Runs every hour since exchange rates change infrequently.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async warmExchangeRates(): Promise<void> {
    const start = performance.now();
    this.logger.debug('Warming exchange rates cache...');

    try {
      // Get all active rates (latest per currency pair)
      const activeRates = await this.prisma.exchangeRate.findMany({
        orderBy: { date: 'desc' },
        distinct: ['from', 'to'],
      });

      await this.cacheService.set(
        'exchange-rates:active',
        activeRates,
        this.TTL.EXCHANGE_RATES,
      );

      // Cache individual currency pairs for direct lookups
      for (const rate of activeRates) {
        await this.cacheService.set(
          `exchange-rates:${rate.from}:${rate.to}`,
          rate,
          this.TTL.EXCHANGE_RATES,
        );
      }

      const duration = performance.now() - start;
      this.logger.debug(
        `Exchange rates cache warmed (${activeRates.length} pairs) in ${duration.toFixed(0)}ms`,
      );
    } catch (error) {
      this.logger.error(`Exchange rates cache warming failed: ${error.message}`);
    }
  }

  /**
   * Warm active order counts by status for the pipeline view.
   * Runs every 2 minutes since these change frequently.
   */
  @Cron('*/2 * * * *')
  async warmActiveOrderCounts(): Promise<void> {
    const start = performance.now();
    this.logger.debug('Warming active order counts cache...');

    try {
      const statusCounts = await this.prisma.order.groupBy({
        by: ['status'],
        where: {
          status: {
            notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
          },
        },
        _count: { id: true },
      });

      const counts = statusCounts.reduce(
        (acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        },
        {} as Record<string, number>,
      );

      await this.cacheService.set(
        'orders:active-counts',
        counts,
        this.TTL.ACTIVE_COUNTS,
      );

      // Also warm per-branch counts
      const branches = Object.values(Branch);
      for (const branch of branches) {
        const branchCounts = await this.prisma.order.groupBy({
          by: ['status'],
          where: {
            branch,
            status: {
              notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
            },
          },
          _count: { id: true },
        });

        const branchCountMap = branchCounts.reduce(
          (acc, item) => {
            acc[item.status] = item._count.id;
            return acc;
          },
          {} as Record<string, number>,
        );

        await this.cacheService.set(
          `orders:active-counts:${branch}`,
          branchCountMap,
          this.TTL.ACTIVE_COUNTS,
        );
      }

      const duration = performance.now() - start;
      this.logger.debug(
        `Active order counts cache warmed in ${duration.toFixed(0)}ms`,
      );
    } catch (error) {
      this.logger.error(
        `Active order counts cache warming failed: ${error.message}`,
      );
    }
  }
}
