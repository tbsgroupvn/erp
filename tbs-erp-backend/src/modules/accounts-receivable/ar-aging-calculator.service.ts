import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { ArStatus } from './dto/ar-query.dto';

export interface AgingBuckets {
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
  totalOutstanding: number;
  totalOverdue: number;
}

export interface BucketCounts {
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CustomerAgingResult {
  customerId: string;
  aging: AgingBuckets;
  counts: BucketCounts;
  maxOverdueDays: number;
  riskLevel: RiskLevel;
  shouldBlock: boolean;
  blockReason?: string;
}

@Injectable()
export class ARAgingCalculatorService {
  private readonly logger = new Logger(ARAgingCalculatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate aging for a single customer at a specific date
   */
  async calculateCustomerAging(
    customerId: string,
    asOfDate: Date = new Date(),
  ): Promise<CustomerAgingResult> {
    // Fetch customer with payment terms
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        paymentTermDays: true,
        gracePeriodDays: true,
        creditLimit: true,
        currentDebt: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    // Fetch all OPEN/PARTIAL AR records for customer
    const receivables = await this.prisma.accountReceivable.findMany({
      where: {
        customerId,
        status: {
          in: [ArStatus.OPEN, ArStatus.PARTIAL, ArStatus.OVERDUE],
        },
      },
      select: {
        id: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
      },
    });

    // Initialize aging buckets
    const aging: AgingBuckets = {
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      days90Plus: 0,
      totalOutstanding: 0,
      totalOverdue: 0,
    };

    const counts: BucketCounts = {
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      days90Plus: 0,
    };

    let maxOverdueDays = 0;

    // Process each receivable
    for (const ar of receivables) {
      const outstanding = ar.amount.toNumber() - ar.paidAmount.toNumber();
      if (outstanding <= 0) continue;

      aging.totalOutstanding += outstanding;

      // Calculate days overdue (considering grace period)
      const effectiveDueDate = new Date(ar.dueDate);
      effectiveDueDate.setDate(
        effectiveDueDate.getDate() + customer.gracePeriodDays,
      );

      const daysOverdue = Math.floor(
        (asOfDate.getTime() - effectiveDueDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      // Classify into bucket
      if (daysOverdue <= 0) {
        // Not due yet (current)
        aging.current += outstanding;
        counts.current++;
      } else {
        aging.totalOverdue += outstanding;
        maxOverdueDays = Math.max(maxOverdueDays, daysOverdue);

        if (daysOverdue <= 30) {
          aging.days1_30 += outstanding;
          counts.days1_30++;
        } else if (daysOverdue <= 60) {
          aging.days31_60 += outstanding;
          counts.days31_60++;
        } else if (daysOverdue <= 90) {
          aging.days61_90 += outstanding;
          counts.days61_90++;
        } else {
          aging.days90Plus += outstanding;
          counts.days90Plus++;
        }
      }
    }

    // Calculate risk level
    const riskLevel = this.calculateRiskLevel(aging);

    // Determine if should block
    const blockResult = this.shouldBlockCustomer(aging, customer);

    return {
      customerId,
      aging,
      counts,
      maxOverdueDays,
      riskLevel,
      shouldBlock: blockResult.shouldBlock,
      blockReason: blockResult.reason,
    };
  }

  /**
   * Calculate aging for all customers (for daily snapshot)
   */
  async calculateAllCustomersAging(
    asOfDate: Date = new Date(),
  ): Promise<CustomerAgingResult[]> {
    // Get all customers with open receivables
    const customers = await this.prisma.customer.findMany({
      where: {
        receivables: {
          some: {
            status: {
              in: [ArStatus.OPEN, ArStatus.PARTIAL, ArStatus.OVERDUE],
            },
          },
        },
      },
      select: { id: true },
    });

    this.logger.log(
      `Calculating aging for ${customers.length} customers as of ${asOfDate.toISOString()}`,
    );

    // Process each customer
    const results: CustomerAgingResult[] = [];
    for (const customer of customers) {
      try {
        const result = await this.calculateCustomerAging(
          customer.id,
          asOfDate,
        );
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed to calculate aging for customer ${customer.id}:`,
          error,
        );
      }
    }

    return results;
  }

  /**
   * Determine risk level based on aging profile
   */
  private calculateRiskLevel(aging: AgingBuckets): RiskLevel {
    const { days61_90, days90Plus, days31_60, totalOutstanding } = aging;

    if (totalOutstanding === 0) return 'LOW';

    // CRITICAL: >50% of debt is 90+ days overdue
    if (days90Plus / totalOutstanding > 0.5) return 'CRITICAL';

    // HIGH: >30% of debt is 60+ days overdue
    const days60Plus = days61_90 + days90Plus;
    if (days60Plus / totalOutstanding > 0.3) return 'HIGH';

    // MEDIUM: >20% of debt is 30+ days overdue
    const days30Plus = days31_60 + days61_90 + days90Plus;
    if (days30Plus / totalOutstanding > 0.2) return 'MEDIUM';

    return 'LOW';
  }

  /**
   * Determine if customer should be blocked
   */
  private shouldBlockCustomer(
    aging: AgingBuckets,
    customer: {
      creditLimit: Prisma.Decimal;
      currentDebt: Prisma.Decimal;
    },
  ): { shouldBlock: boolean; reason?: string } {
    // Rule 1: Over 100% credit limit
    const creditLimit = customer.creditLimit.toNumber();
    const currentDebt = customer.currentDebt.toNumber();

    if (currentDebt > creditLimit && creditLimit > 0) {
      return {
        shouldBlock: true,
        reason: `Vượt hạn mức tín dụng (${currentDebt.toLocaleString('vi-VN')} / ${creditLimit.toLocaleString('vi-VN')} VND)`,
      };
    }

    // Rule 2: Has debt 90+ days overdue
    if (aging.days90Plus > 0) {
      return {
        shouldBlock: true,
        reason: `Có công nợ quá hạn >90 ngày (${aging.days90Plus.toLocaleString('vi-VN')} VND)`,
      };
    }

    // Rule 3: More than 60% of debt is 60+ days overdue
    const days60Plus = aging.days61_90 + aging.days90Plus;
    if (
      aging.totalOutstanding > 0 &&
      days60Plus / aging.totalOutstanding > 0.6
    ) {
      const percentage = Math.round(
        (days60Plus / aging.totalOutstanding) * 100,
      );
      return {
        shouldBlock: true,
        reason: `${percentage}% công nợ quá hạn >60 ngày (${days60Plus.toLocaleString('vi-VN')} VND)`,
      };
    }

    return { shouldBlock: false };
  }
}
