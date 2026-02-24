import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';

/** Cache TTL: 5 minutes in milliseconds. */
const FINANCE_SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * CQRS Read Model - Optimized read queries for Finance domain.
 * Uses aggregation queries and caching to provide fast dashboard summaries
 * without loading full entity graphs.
 */
@Injectable()
export class FinanceReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * AR/AP summary for dashboard.
   * Aggregates receivables, payables, overdue counts, and cash flow
   * within a given date range. Cached for 5 minutes.
   */
  async getFinanceSummary(dateFrom: Date, dateTo: Date) {
    const cacheKey = `finance:summary:${dateFrom.toISOString().slice(0, 10)}:${dateTo.toISOString().slice(0, 10)}`;

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const [arTotal, apTotal, arOverdue, cashFlow] = await Promise.all([
          this.prisma.accountReceivable.aggregate({
            where: { createdAt: { gte: dateFrom, lte: dateTo } },
            _sum: { amount: true, paidAmount: true },
            _count: true,
          }),
          this.prisma.accountPayable.aggregate({
            where: { createdAt: { gte: dateFrom, lte: dateTo } },
            _sum: { amount: true, paidAmount: true },
            _count: true,
          }),
          this.prisma.accountReceivable.count({
            where: {
              status: { in: ['OPEN', 'PARTIAL'] },
              dueDate: { lt: new Date() },
            },
          }),
          this.prisma.cashTransaction.aggregate({
            where: { createdAt: { gte: dateFrom, lte: dateTo } },
            _sum: { amount: true },
          }),
        ]);

        return {
          ar: {
            totalAmount: arTotal._sum.amount ?? 0,
            totalPaid: arTotal._sum.paidAmount ?? 0,
            count: arTotal._count,
            overdueCount: arOverdue,
          },
          ap: {
            totalAmount: apTotal._sum.amount ?? 0,
            totalPaid: apTotal._sum.paidAmount ?? 0,
            count: apTotal._count,
          },
          cashFlow: cashFlow._sum.amount ?? 0,
        };
      },
      FINANCE_SUMMARY_CACHE_TTL_MS,
    );
  }
}
