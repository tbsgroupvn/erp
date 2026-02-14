import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ARAgingCalculatorService,
  CustomerAgingResult,
} from './ar-aging-calculator.service';
import { Prisma } from '@prisma/client';

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
  async getCustomerSnapshot(
    customerId: string,
    date: Date = new Date(),
  ): Promise<any | null> {
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
  async getCustomerAgingTrend(
    customerId: string,
    days: number = 30,
  ): Promise<any[]> {
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
   * Get company-wide aging summary
   */
  async getCompanyAgingSummary(date?: Date): Promise<AgingSummary> {
    const targetDate = date || new Date();
    targetDate.setHours(0, 0, 0, 0);

    // Aggregate all customer snapshots for the date
    const snapshots = await this.prisma.aRAgingSnapshot.findMany({
      where: { snapshotDate: targetDate },
    });

    // Sum up all buckets
    const summary = snapshots.reduce(
      (acc, snap) => ({
        current: acc.current + snap.current.toNumber(),
        days1_30: acc.days1_30 + snap.days1_30.toNumber(),
        days31_60: acc.days31_60 + snap.days31_60.toNumber(),
        days61_90: acc.days61_90 + snap.days61_90.toNumber(),
        days90Plus: acc.days90Plus + snap.days90Plus.toNumber(),
        totalOutstanding:
          acc.totalOutstanding + snap.totalOutstanding.toNumber(),
      }),
      {
        current: 0,
        days1_30: 0,
        days31_60: 0,
        days61_90: 0,
        days90Plus: 0,
        totalOutstanding: 0,
      },
    );

    return summary;
  }

  /**
   * Get historical aging trends (last N days)
   */
  async getAgingTrends(days: number = 30): Promise<any[]> {
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    // Get all snapshots within the date range
    const snapshots = await this.prisma.aRAgingSnapshot.findMany({
      where: {
        snapshotDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { snapshotDate: 'asc' },
    });

    // Group by date and aggregate
    const trendMap = new Map<string, AgingSummary>();

    for (const snap of snapshots) {
      const dateKey = snap.snapshotDate.toISOString().split('T')[0];
      const existing = trendMap.get(dateKey) || {
        current: 0,
        days1_30: 0,
        days31_60: 0,
        days61_90: 0,
        days90Plus: 0,
        totalOutstanding: 0,
      };

      trendMap.set(dateKey, {
        current: existing.current + snap.current.toNumber(),
        days1_30: existing.days1_30 + snap.days1_30.toNumber(),
        days31_60: existing.days31_60 + snap.days31_60.toNumber(),
        days61_90: existing.days61_90 + snap.days61_90.toNumber(),
        days90Plus: existing.days90Plus + snap.days90Plus.toNumber(),
        totalOutstanding:
          existing.totalOutstanding + snap.totalOutstanding.toNumber(),
      });
    }

    // Convert to array
    return Array.from(trendMap.entries()).map(([date, summary]) => ({
      snapshotDate: new Date(date),
      ...summary,
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
      orderBy: [
        { riskLevel: 'desc' },
        { totalOutstanding: 'desc' },
      ],
    });

    return snapshots;
  }

  /**
   * Process auto-block actions for high-risk customers
   */
  private async processBlockActions(
    agingResults: CustomerAgingResult[],
  ): Promise<void> {
    const customersToBlock = agingResults.filter((r) => r.shouldBlock);

    if (customersToBlock.length === 0) {
      this.logger.log('No customers need to be blocked');
      return;
    }

    this.logger.log(`Processing auto-block for ${customersToBlock.length} customers`);

    for (const result of customersToBlock) {
      try {
        // Check if already blocked
        const customer = await this.prisma.customer.findUnique({
          where: { id: result.customerId },
          select: { isBlocked: true, code: true, fullName: true },
        });

        if (customer?.isBlocked) {
          this.logger.debug(`Customer ${customer.code} already blocked, skipping`);
          continue;
        }

        // Block the customer
        await this.prisma.customer.update({
          where: { id: result.customerId },
          data: {
            isBlocked: true,
            blockReason: result.blockReason,
            blockedAt: new Date(),
          },
        });

        this.logger.warn(
          `Customer ${customer?.code} - ${customer?.fullName} auto-blocked: ${result.blockReason}`,
        );

        // Emit event for notifications
        this.eventEmitter.emit('customer.blocked', {
          customerId: result.customerId,
          customerCode: customer?.code,
          customerName: customer?.fullName,
          reason: result.blockReason,
          aging: result.aging,
        });
      } catch (error) {
        this.logger.error(
          `Failed to block customer ${result.customerId}:`,
          error,
        );
      }
    }
  }
}
