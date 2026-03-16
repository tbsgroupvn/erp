import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

@Injectable()
export class PeriodClosingService {
  private readonly logger = new Logger(PeriodClosingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Formats a period label as YYYY-MM.
   */
  private formatPeriod(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  /**
   * KT-5: Get the period-closing checklist for a given month.
   *
   * Counts:
   * - pendingApprovals: approvals with status PENDING
   * - unreconciledAR: account receivables with status OPEN or PARTIAL
   * - unallocatedCosts: payment vouchers with status PENDING in the period
   * - unpostedJournals: journal entries with isPosted=false in the period
   *
   * Returns { items, allClear } where allClear = true if all counts are 0.
   */
  async getChecklist(year: number, month: number) {
    const periodLabel = this.formatPeriod(year, month);

    // Define start/end of the period
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const [pendingApprovals, unreconciledAR, unallocatedCosts, unpostedJournals] =
      await Promise.all([
        // Pending approvals
        this.prisma.approval.count({
          where: {
            status: 'PENDING',
            createdAt: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
        }),

        // Unreconciled AR (OPEN or PARTIAL)
        this.prisma.accountReceivable.count({
          where: {
            status: { in: ['OPEN', 'PARTIAL'] },
            createdAt: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
        }),

        // Unallocated costs (pending payment vouchers in period)
        this.prisma.paymentVoucher.count({
          where: {
            status: 'PENDING',
            createdAt: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
        }),

        // Unposted journal entries in the period
        this.prisma.journalEntry.count({
          where: {
            periodYear: year,
            periodMonth: month,
            isPosted: false,
          },
        }),
      ]);

    const items = [
      {
        key: 'pendingApprovals',
        label: 'Pending approvals',
        count: pendingApprovals,
        clear: pendingApprovals === 0,
      },
      {
        key: 'unreconciledAR',
        label: 'Unreconciled AR (OPEN/PARTIAL)',
        count: unreconciledAR,
        clear: unreconciledAR === 0,
      },
      {
        key: 'unallocatedCosts',
        label: 'Unallocated costs (pending vouchers)',
        count: unallocatedCosts,
        clear: unallocatedCosts === 0,
      },
      {
        key: 'unpostedJournals',
        label: 'Unposted journal entries',
        count: unpostedJournals,
        clear: unpostedJournals === 0,
      },
    ];

    const allClear = items.every((item) => item.clear);

    this.logger.log(
      `Period ${periodLabel} checklist: ${
        allClear
          ? 'ALL CLEAR'
          : items
              .filter((i) => !i.clear)
              .map((i) => `${i.key}=${i.count}`)
              .join(', ')
      }`,
    );

    return { period: periodLabel, items, allClear };
  }

  /**
   * KT-5: Close an accounting period.
   *
   * Requires either all checklist items to be clear (allClear=true)
   * or bypassReasons to be provided for outstanding items.
   *
   * Creates a ClosedPeriod record to prevent further journal entries.
   */
  async closePeriod(
    year: number,
    month: number,
    closedBy: string,
    bypassReasons?: Record<string, string>,
  ) {
    const periodLabel = this.formatPeriod(year, month);

    // Check if already closed
    const existing = await this.prisma.closedPeriod.findUnique({
      where: { year_month: { year, month } },
    });

    if (existing) {
      throw new BadRequestException(`Period ${periodLabel} is already closed.`);
    }

    // Run checklist
    const checklist = await this.getChecklist(year, month);

    if (!checklist.allClear) {
      if (!bypassReasons) {
        throw new BadRequestException(
          `Period ${periodLabel} has outstanding items. ` +
            `Provide bypassReasons for: ${checklist.items
              .filter((i) => !i.clear)
              .map((i) => i.key)
              .join(', ')}`,
        );
      }

      // Validate that bypass reasons are provided for all non-clear items
      const unclearedKeys = checklist.items.filter((item) => !item.clear).map((item) => item.key);

      const missingReasons = unclearedKeys.filter(
        (key) => !bypassReasons[key] || bypassReasons[key].trim() === '',
      );

      if (missingReasons.length > 0) {
        throw new BadRequestException(`Bypass reasons required for: ${missingReasons.join(', ')}`);
      }
    }

    const closedPeriod = await this.prisma.closedPeriod.create({
      data: {
        year,
        month,
        closedBy,
        bypassReasons: bypassReasons || undefined,
      },
    });

    this.logger.log(
      `Period ${periodLabel} closed by ${closedBy}` +
        (bypassReasons ? ` with bypass reasons: ${JSON.stringify(bypassReasons)}` : ''),
    );

    return closedPeriod;
  }
}
