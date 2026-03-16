import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { AccountReceivable, Prisma } from '@prisma/client';
import { ArQueryDto, ArStatus } from './dto/ar-query.dto';

export interface AgingBucket {
  range: string;
  count: number;
  totalAmount: number;
}

export interface CustomerDebtSummary {
  customerId: string;
  customerCode: string;
  customerName: string;
  companyName: string | null;
  totalDebt: number;
  overdueDebt: number;
  arCount: number;
  oldestDueDate: Date | null;
  /** Max days since any linked order reached COMPLETED status (null if no order has completedAt) */
  maxDaysSinceCompletion: number | null;
}

@Injectable()
export class AccountsReceivableRepository {
  private readonly logger = new Logger(AccountsReceivableRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a unique AR code: TBS-AR-000001
   */
  async generateCode(): Promise<string> {
    const last = await this.prisma.accountReceivable.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    let nextNumber = 1;
    if (last?.code) {
      const match = last.code.match(/TBS-AR-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `TBS-AR-${String(nextNumber).padStart(6, '0')}`;
  }

  async create(data: Prisma.AccountReceivableUncheckedCreateInput): Promise<AccountReceivable> {
    return this.prisma.accountReceivable.create({ data });
  }

  async findById(id: string): Promise<AccountReceivable | null> {
    return this.prisma.accountReceivable.findUnique({
      where: { id },
      include: { customer: true, order: true },
    });
  }

  async findMany(query: ArQueryDto): Promise<{ data: AccountReceivable[]; total: number }> {
    const where: Prisma.AccountReceivableWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        {
          customer: {
            fullName: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (query.isOverdue) {
      where.dueDate = { lt: new Date() };
      where.status = { in: [ArStatus.OPEN, ArStatus.PARTIAL] };
    }

    const [data, total] = await Promise.all([
      this.prisma.accountReceivable.findMany({
        where,
        include: { customer: true, order: true },
        orderBy: query.orderBy,
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.accountReceivable.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Get all overdue receivables (past due date and not fully paid).
   */
  async findOverdue(): Promise<AccountReceivable[]> {
    return this.prisma.accountReceivable.findMany({
      where: {
        dueDate: { lt: new Date() },
        status: { in: [ArStatus.OPEN, ArStatus.PARTIAL] },
      },
      include: { customer: true, order: true },
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * Get all receivables for a specific customer.
   */
  async findByCustomer(customerId: string): Promise<AccountReceivable[]> {
    return this.prisma.accountReceivable.findMany({
      where: { customerId },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update an AR record (payment, status change, etc.).
   */
  async update(id: string, data: Prisma.AccountReceivableUpdateInput): Promise<AccountReceivable> {
    return this.prisma.accountReceivable.update({
      where: { id },
      data,
      include: { customer: true, order: true },
    });
  }

  /**
   * Get aging report: group overdue receivables by days overdue.
   */
  async getAgingReport(): Promise<AgingBucket[]> {
    const now = new Date();
    const openReceivables = await this.prisma.accountReceivable.findMany({
      where: {
        status: { in: [ArStatus.OPEN, ArStatus.PARTIAL] },
      },
      select: {
        amount: true,
        paidAmount: true,
        dueDate: true,
      },
    });

    const buckets: Record<string, { count: number; totalAmount: number }> = {
      'Current (not due)': { count: 0, totalAmount: 0 },
      '1-30 days': { count: 0, totalAmount: 0 },
      '31-60 days': { count: 0, totalAmount: 0 },
      '61-90 days': { count: 0, totalAmount: 0 },
      '90+ days': { count: 0, totalAmount: 0 },
    };

    for (const ar of openReceivables) {
      const outstanding = ar.amount.toNumber() - ar.paidAmount.toNumber();
      const daysOverdue = Math.floor(
        (now.getTime() - ar.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      let bucket: string;
      if (daysOverdue <= 0) {
        bucket = 'Current (not due)';
      } else if (daysOverdue <= 30) {
        bucket = '1-30 days';
      } else if (daysOverdue <= 60) {
        bucket = '31-60 days';
      } else if (daysOverdue <= 90) {
        bucket = '61-90 days';
      } else {
        bucket = '90+ days';
      }

      buckets[bucket].count += 1;
      buckets[bucket].totalAmount += outstanding;
    }

    return Object.entries(buckets).map(([range, data]) => ({
      range,
      ...data,
    }));
  }

  /**
   * Get total outstanding debt for a customer.
   */
  async getCustomerDebt(
    customerId: string,
  ): Promise<{ totalDebt: number; overdueDebt: number; receivablesCount: number }> {
    const receivables = await this.prisma.accountReceivable.findMany({
      where: {
        customerId,
        status: { in: [ArStatus.OPEN, ArStatus.PARTIAL] },
      },
      select: {
        amount: true,
        paidAmount: true,
        dueDate: true,
      },
    });

    const now = new Date();
    let totalDebt = 0;
    let overdueDebt = 0;

    for (const ar of receivables) {
      const outstanding = ar.amount.toNumber() - ar.paidAmount.toNumber();
      totalDebt += outstanding;
      if (ar.dueDate < now) {
        overdueDebt += outstanding;
      }
    }

    return {
      totalDebt,
      overdueDebt,
      receivablesCount: receivables.length,
    };
  }

  /**
   * Aggregate all OPEN/PARTIAL AR records grouped by customer.
   * Prisma groupBy does not support joins, so we fetch with customer include
   * and aggregate in JS. Result is sorted by totalDebt descending.
   */
  async getCustomerSummary(): Promise<CustomerDebtSummary[]> {
    const now = new Date();

    const records = await this.prisma.accountReceivable.findMany({
      where: {
        status: { in: [ArStatus.OPEN, ArStatus.PARTIAL] },
      },
      select: {
        customerId: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
        order: {
          select: { completedAt: true },
        },
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
          },
        },
      },
    });

    const map = new Map<string, CustomerDebtSummary>();

    for (const ar of records) {
      const outstanding = ar.amount.toNumber() - ar.paidAmount.toNumber();
      const isOverdue = ar.dueDate < now;

      // Calculate days since order completion
      let daysSinceCompletion: number | null = null;
      if (ar.order?.completedAt) {
        daysSinceCompletion = Math.floor(
          (now.getTime() - ar.order.completedAt.getTime()) / (1000 * 60 * 60 * 24),
        );
      }

      const existing = map.get(ar.customerId);

      if (existing) {
        existing.totalDebt += outstanding;
        if (isOverdue) {
          existing.overdueDebt += outstanding;
        }
        existing.arCount += 1;
        if (
          existing.oldestDueDate === null ||
          ar.dueDate < existing.oldestDueDate
        ) {
          existing.oldestDueDate = ar.dueDate;
        }
        // Keep the max daysSinceCompletion across all ARs for this customer
        if (
          daysSinceCompletion !== null &&
          (existing.maxDaysSinceCompletion === null ||
            daysSinceCompletion > existing.maxDaysSinceCompletion)
        ) {
          existing.maxDaysSinceCompletion = daysSinceCompletion;
        }
      } else {
        map.set(ar.customerId, {
          customerId: ar.customerId,
          customerCode: ar.customer.code,
          customerName: ar.customer.fullName,
          companyName: ar.customer.companyName ?? null,
          totalDebt: outstanding,
          overdueDebt: isOverdue ? outstanding : 0,
          arCount: 1,
          oldestDueDate: ar.dueDate,
          maxDaysSinceCompletion: daysSinceCompletion,
        });
      }
    }

    // Sort: highest daysSinceCompletion first (urgency), then by totalDebt descending
    return Array.from(map.values()).sort((a, b) => {
      const aDays = a.maxDaysSinceCompletion ?? -1;
      const bDays = b.maxDaysSinceCompletion ?? -1;
      if (aDays !== bDays) return bDays - aDays;
      return b.totalDebt - a.totalDebt;
    });
  }
}
