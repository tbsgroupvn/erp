import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ARAgingCalculatorService, CustomerAgingResult } from './ar-aging-calculator.service';
import { Prisma } from '@prisma/client';

// Raw row returned by the company-wide aggregate query
interface AgingSummaryRaw {
  current:          string | null;
  days1_30:         string | null;
  days31_60:        string | null;
  days61_90:        string | null;
  days90_plus:      string | null;
  total_outstanding: string | null;
}

// Raw row returned by the daily-trend aggregate query
interface AgingTrendRaw {
  snapshot_date:     Date;
  current:           string | null;
  days1_30:          string | null;
  days31_60:         string | null;
  days61_90:         string | null;
  days90_plus:       string | null;
  total_outstanding: string | null;
}

export interface AgingSummary {
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
  totalOutstanding: number;
}

@Injectable()
export class ARAgingSnapshotService {
  private readonly logger = new Logger(ARAgingSnapshotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: ARAgingCalculatorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create daily aging snapshots for all customers
   * Called by cron job every day at 1 AM
   */
  async createDailySnapshots(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.logger.log(`Creating daily AR aging snapshots for ${today.toISOString()}`);

    // Calculate aging for all customers
    const agingResults = await this.calculator.calculateAllCustomersAging(today);

    if (agingResults.length === 0) {
      this.logger.log('No customers with outstanding receivables. Skipping snapshot.');
      return;
    }

    // Save snapshots to database
    const snapshots = agingResults.map((result) => ({
      snapshotDate: today,
      customerId: result.customerId,
      current: new Prisma.Decimal(result.aging.current),
      days1_30: new Prisma.Decimal(result.aging.days1_30),
      days31_60: new Prisma.Decimal(result.aging.days31_60),
      days61_90: new Prisma.Decimal(result.aging.days61_90),
      days90Plus: new Prisma.Decimal(result.aging.days90Plus),
      totalOutstanding: new Prisma.Decimal(result.aging.totalOutstanding),
      totalOverdue: new Prisma.Decimal(result.aging.totalOverdue),
      maxOverdueDays: result.maxOverdueDays,
      countCurrent: result.counts.current,
      count1_30: result.counts.days1_30,
      count31_60: result.counts.days31_60,
      count61_90: result.counts.days61_90,
      count90Plus: result.counts.days90Plus,
      riskLevel: result.riskLevel,
      shouldBlock: result.shouldBlock,
      blockReason: result.blockReason,
    }));

    await this.prisma.aRAgingSnapshot.createMany({ data: snapshots });

    this.logger.log(`Created ${snapshots.length} aging snapshots`);

    // Auto-block high-risk customers
    await this.processBlockActions(agingResults);

    // Emit event for notifications
    const highRiskCount = snapshots.filter(
      (s) => s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL',
    ).length;

    this.eventEmitter.emit('ar.aging.snapshot.created', {
      date: today,
      totalCustomers: snapshots.length,
      highRiskCount,
    });

    this.logger.log(`Daily snapshot creation completed. High risk customers: ${highRiskCount}`);
  }

  /**
   * Get aging snapshot for a specific customer and date
   */
  async getCustomerSnapshot(customerId: string, date: Date = new Date()): Promise<any | null> {
    date.setHours(0, 0, 0, 0);

    // Find nearest snapshot before or on the date
    return this.prisma.aRAgingSnapshot.findFirst({
      where: {
        customerId,
        snapshotDate: { lte: date },
      },
      orderBy: { snapshotDate: 'desc' },
    });
  }

  /**
   * Get aging trend for a customer (last N days)
   */
  async getCustomerAgingTrend(customerId: string, days: number = 30): Promise<any[]> {
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    return this.prisma.aRAgingSnapshot.findMany({
      where: {
        customerId,
        snapshotDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { snapshotDate: 'asc' },
    });
  }

  /**
   * Get company-wide aging summary.
   *
   * Optimization: replaced the previous findMany + JS reduce (loading every
   * customer row into memory) with a single aggregate SQL query that lets
   * PostgreSQL do the summing server-side.
   */
  async getCompanyAgingSummary(date?: Date): Promise<AgingSummary> {
    const t0 = Date.now();
    const targetDate = date || new Date();
    targetDate.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<AgingSummaryRaw[]>`
      SELECT
        SUM(current)           AS current,
        SUM(days_1_30)         AS days1_30,
        SUM(days_31_60)        AS days31_60,
        SUM(days_61_90)        AS days61_90,
        SUM(days_90_plus)      AS days90_plus,
        SUM(total_outstanding) AS total_outstanding
      FROM ar_aging_snapshots
      WHERE snapshot_date = ${targetDate}
    `;

    this.logger.debug(
      `getCompanyAgingSummary (${targetDate.toISOString().split('T')[0]}) completed in ${Date.now() - t0}ms (1 query)`,
    );

    const row = rows[0] ?? ({} as AgingSummaryRaw);
    return {
      current:          parseFloat(row.current          ?? '0'),
      days1_30:         parseFloat(row.days1_30         ?? '0'),
      days31_60:        parseFloat(row.days31_60        ?? '0'),
      days61_90:        parseFloat(row.days61_90        ?? '0'),
      days90Plus:       parseFloat(row.days90_plus      ?? '0'),
      totalOutstanding: parseFloat(row.total_outstanding ?? '0'),
    };
  }

  /**
   * Get historical aging trends (last N days).
   *
   * Optimization: replaced the previous findMany (loading all per-customer
   * rows) + JS groupBy-and-sum with a single SQL GROUP BY snapshot_date query.
   * For 30 days with 500 customers that is 15 000 rows → 30 rows in memory.
   */
  async getAgingTrends(days: number = 30): Promise<any[]> {
    const t0 = Date.now();
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    const rows = await this.prisma.$queryRaw<AgingTrendRaw[]>`
      SELECT
        snapshot_date,
        SUM(current)           AS current,
        SUM(days_1_30)         AS days1_30,
        SUM(days_31_60)        AS days31_60,
        SUM(days_61_90)        AS days61_90,
        SUM(days_90_plus)      AS days90_plus,
        SUM(total_outstanding) AS total_outstanding
      FROM ar_aging_snapshots
      WHERE snapshot_date >= ${startDate}
        AND snapshot_date <= ${endDate}
      GROUP BY snapshot_date
      ORDER BY snapshot_date ASC
    `;

    this.logger.debug(
      `getAgingTrends (${days}d) completed in ${Date.now() - t0}ms (1 query, ${rows.length} date points)`,
    );

    return rows.map((r) => ({
      snapshotDate:     r.snapshot_date,
      current:          parseFloat(r.current          ?? '0'),
      days1_30:         parseFloat(r.days1_30         ?? '0'),
      days31_60:        parseFloat(r.days31_60        ?? '0'),
      days61_90:        parseFloat(r.days61_90        ?? '0'),
      days90Plus:       parseFloat(r.days90_plus      ?? '0'),
      totalOutstanding: parseFloat(r.total_outstanding ?? '0'),
    }));
  }

  /**
   * Get high-risk customers
   */
  async getHighRiskCustomers(): Promise<any[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snapshots = await this.prisma.aRAgingSnapshot.findMany({
      where: {
        snapshotDate: today,
        riskLevel: {
          in: ['HIGH', 'CRITICAL'],
        },
      },
      include: {
        customer: {
          select: {
            code: true,
            fullName: true,
            phone: true,
            email: true,
            isBlocked: true,
            creditLimit: true,
            currentDebt: true,
          },
        },
      },
      orderBy: [{ riskLevel: 'desc' }, { totalOutstanding: 'desc' }],
    });

    return snapshots;
  }

  /**
   * Process auto-block actions for high-risk customers.
   *
   * Uses a single updateMany for bulk blocking instead of 2 queries per customer,
   * then emits per-customer events using data fetched in one batch query.
   */
  private async processBlockActions(agingResults: CustomerAgingResult[]): Promise<void> {
    const customersToBlock = agingResults.filter((r) => r.shouldBlock);

    if (customersToBlock.length === 0) {
      this.logger.log('No customers need to be blocked');
      return;
    }

    this.logger.log(`Processing auto-block for ${customersToBlock.length} customers`);

    const customerIds = customersToBlock.map((r) => r.customerId);

    // Fetch current state of all candidates in one query
    const existingCustomers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, isBlocked: true, code: true, fullName: true },
    });

    const existingMap = new Map(existingCustomers.map((c) => [c.id, c]));

    // Filter to only those not already blocked
    const toBlock = customersToBlock.filter((r) => {
      const customer = existingMap.get(r.customerId);
      if (customer?.isBlocked) {
        this.logger.debug(`Customer ${customer.code} already blocked, skipping`);
        return false;
      }
      return true;
    });

    if (toBlock.length === 0) {
      this.logger.log('All candidates already blocked');
      return;
    }

    const blockedAt = new Date();

    // Bulk update — one query instead of N updates.
    // blockReason may differ per customer so we must do individual updates only when
    // block reasons differ; otherwise a single updateMany suffices.
    // Since blockReason is per-customer, we use updateMany per unique reason group.
    const reasonGroups = new Map<string, string[]>();
    for (const r of toBlock) {
      const reason = r.blockReason ?? '';
      const group = reasonGroups.get(reason) ?? [];
      group.push(r.customerId);
      reasonGroups.set(reason, group);
    }

    for (const [blockReason, ids] of reasonGroups) {
      await this.prisma.customer.updateMany({
        where: {
          id: { in: ids },
          isBlocked: false, // safety guard: only update unblocked customers
        },
        data: {
          isBlocked: true,
          blockReason,
          blockedAt,
        },
      });
    }

    this.logger.log(`Blocked ${toBlock.length} high-risk customers in batch`);

    // Emit per-customer events for notifications
    for (const result of toBlock) {
      const customer = existingMap.get(result.customerId);
      this.logger.warn(
        `Customer ${customer?.code} - ${customer?.fullName} auto-blocked: ${result.blockReason}`,
      );
      this.eventEmitter.emit('customer.blocked', {
        customerId: result.customerId,
        customerCode: customer?.code,
        customerName: customer?.fullName,
        reason: result.blockReason,
        aging: result.aging,
      });
    }
  }
}
