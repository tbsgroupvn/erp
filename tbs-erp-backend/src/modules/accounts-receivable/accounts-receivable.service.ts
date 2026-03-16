import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import { AccountsReceivableRepository, CustomerDebtSummary } from './accounts-receivable.repository';
import { CreateArDto } from './dto/create-ar.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { ArQueryDto, ArStatus } from './dto/ar-query.dto';
import { PaginatedResponse } from '@common/dto/base-response.dto';
import { ARAgingSnapshotService } from './ar-aging-snapshot.service';
import { ARAgingCalculatorService } from './ar-aging-calculator.service';

@Injectable()
export class AccountsReceivableService {
  private readonly logger = new Logger(AccountsReceivableService.name);

  constructor(
    private readonly arRepository: AccountsReceivableRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
    private readonly snapshotService: ARAgingSnapshotService,
    private readonly calculatorService: ARAgingCalculatorService,
  ) {}

  /**
   * Create a new accounts receivable record.
   */
  async createReceivable(dto: CreateArDto, createdBy: string) {
    const code = await this.arRepository.generateCode();

    const ar = await this.arRepository.create({
      code,
      customerId: dto.customerId,
      orderId: dto.orderId,
      amount: new Prisma.Decimal(dto.amount),
      currency: dto.currency ?? 'VND',
      dueDate: new Date(dto.dueDate),
      note: dto.note,
      createdBy,
    });

    this.eventEmitter.emit('ar.created', {
      arId: ar.id,
      customerId: dto.customerId,
      amount: dto.amount,
    });

    this.logger.log(`AR created: ${code}, customer=${dto.customerId}, amount=${dto.amount}`);
    return ar;
  }

  /**
   * Record a payment against an accounts receivable.
   */
  async recordPayment(arId: string, dto: RecordPaymentDto) {
    // Wrap in a serializable transaction to prevent double-payment race conditions.
    // The SELECT inside the transaction implicitly locks the row via serializable isolation,
    // so concurrent payments for the same AR are serialized and the outstanding check is atomic.
    const { updated, ar } = await this.prisma.$transaction(
      async (tx) => {
        const record = await tx.accountReceivable.findUnique({
          where: { id: arId },
          include: { customer: true, order: true },
        });

        if (!record) {
          throw new NotFoundException(`AR record ${arId} not found`);
        }

        if (record.status === ArStatus.PAID || record.status === ArStatus.NETTED) {
          throw new BadRequestException(
            `AR ${record.code} is already ${record.status}. Cannot record more payments.`,
          );
        }

        const outstanding = record.amount.toNumber() - (record.paidAmount?.toNumber() ?? 0);

        if (dto.amount > outstanding) {
          throw new BadRequestException(
            `Payment amount (${dto.amount}) exceeds outstanding balance (${outstanding})`,
          );
        }

        const newPaidAmount = (record.paidAmount?.toNumber() ?? 0) + dto.amount;
        const isFullyPaid = newPaidAmount >= record.amount.toNumber();

        const result = await tx.accountReceivable.update({
          where: { id: arId },
          data: {
            paidAmount: new Prisma.Decimal(newPaidAmount),
            status: isFullyPaid ? ArStatus.PAID : ArStatus.PARTIAL,
            note: dto.note ? `${record.note ?? ''}\n[Payment] ${dto.amount} - ${dto.note}` : record.note,
          },
          include: { customer: true, order: true },
        });

        return { updated: result, ar: record };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const isFullyPaid = updated.status === ArStatus.PAID;

    this.eventEmitter.emit('ar.payment.recorded', {
      arId: ar.id,
      customerId: ar.customerId,
      paymentAmount: dto.amount,
      isFullyPaid,
      reference: dto.reference,
    });

    this.logger.log(
      `AR payment recorded: ${ar.code}, amount=${dto.amount}, status=${updated.status}`,
    );

    return updated;
  }

  /**
   * Get a list of AR records with pagination and filters.
   */
  async findAll(query: ArQueryDto) {
    const { data, total } = await this.arRepository.findMany(query);
    return PaginatedResponse.paginate(data, total, query.page, query.limit);
  }

  /**
   * Get overdue receivables.
   */
  async getOverdueList() {
    return this.arRepository.findOverdue();
  }

  /**
   * Get all receivables for a specific customer, plus debt summary.
   */
  async getCustomerDebt(customerId: string) {
    const [receivables, debt] = await Promise.all([
      this.arRepository.findByCustomer(customerId),
      this.arRepository.getCustomerDebt(customerId),
    ]);

    return {
      ...debt,
      receivables,
    };
  }

  /**
   * Get overdue debt information for a customer.
   * Used by CreditCheckGuard to validate order creation.
   *
   * @param customerId - Customer ID to check
   * @returns Object containing total overdue amount, max overdue days, and count of overdue receivables
   */
  async getOverdueDebt(
    customerId: string,
  ): Promise<{ total: number; maxOverdueDays: number; count: number }> {
    const now = new Date();

    const overdueReceivables = await this.prisma.accountReceivable.findMany({
      where: {
        customerId,
        dueDate: { lt: now },
        status: { in: [ArStatus.OPEN, ArStatus.PARTIAL] },
      },
      select: {
        amount: true,
        paidAmount: true,
        dueDate: true,
      },
    });

    if (overdueReceivables.length === 0) {
      return { total: 0, maxOverdueDays: 0, count: 0 };
    }

    let totalOverdue = 0;
    let maxOverdueDays = 0;

    for (const ar of overdueReceivables) {
      const outstanding = ar.amount.toNumber() - (ar.paidAmount?.toNumber() ?? 0);
      totalOverdue += outstanding;

      const daysOverdue = Math.floor(
        (now.getTime() - ar.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysOverdue > maxOverdueDays) {
        maxOverdueDays = daysOverdue;
      }
    }

    return {
      total: totalOverdue,
      maxOverdueDays,
      count: overdueReceivables.length,
    };
  }

  /**
   * Get the aging report for all open receivables.
   */
  async getAgingReport() {
    return this.arRepository.getAgingReport();
  }

  /**
   * Get a single AR record by ID.
   */
  async findById(id: string) {
    const ar = await this.arRepository.findById(id);
    if (!ar) {
      throw new NotFoundException(`AR record ${id} not found`);
    }
    return ar;
  }

  /**
   * Get current aging for a specific customer.
   */
  async getCustomerAging(customerId: string) {
    return this.calculatorService.calculateCustomerAging(customerId);
  }

  /**
   * Get aging trend for a customer (last N days).
   */
  async getCustomerAgingTrend(customerId: string, days?: number) {
    return this.snapshotService.getCustomerAgingTrend(customerId, days || 30);
  }

  /**
   * Get company-wide aging summary.
   */
  async getAgingSummary(date?: string) {
    const targetDate = date ? new Date(date) : undefined;
    return this.snapshotService.getCompanyAgingSummary(targetDate);
  }

  /**
   * Get historical aging trends (last N days).
   */
  async getAgingTrends(days: number = 30) {
    return this.snapshotService.getAgingTrends(days);
  }

  /**
   * Get list of high-risk customers.
   */
  async getHighRiskCustomers() {
    return this.snapshotService.getHighRiskCustomers();
  }

  /**
   * Get total outstanding debt grouped by customer.
   * Returns all customers with OPEN/PARTIAL AR, sorted by totalDebt descending.
   */
  async getCustomerSummary(): Promise<CustomerDebtSummary[]> {
    return this.arRepository.getCustomerSummary();
  }

  /**
   * Cron job: Generate daily AR aging snapshots at 1 AM.
   * Creates historical snapshots for trend analysis and auto-blocks high-risk customers.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async generateDailyAgingSnapshots(): Promise<void> {
    this.logger.log('Starting daily AR aging snapshot generation...');

    try {
      await this.snapshotService.createDailySnapshots();
      this.logger.log('Daily AR aging snapshots generated successfully');
    } catch (error) {
      this.logger.error('Failed to generate daily AR aging snapshots:', error);
    }
  }

  /**
   * Cron job: Check aging alerts daily at 8 AM.
   *
   * Alert escalation rules:
   * - T-3 days before due: alert to Sale + Leader
   * - T+0 overdue: alert to Sale + Leader + Finance
   * - T+15 overdue: alert + GD KD (Sales Director)
   * - T+30 overdue: alert + BGD (COO/CEO)
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkAgingAlerts(): Promise<void> {
    const now = new Date();
    let alertCount = 0;

    // Process in cursor-based batches to avoid loading all AR records into memory at once
    const BATCH_SIZE = 500;
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const receivables = await this.prisma.accountReceivable.findMany({
        where: {
          status: { in: [ArStatus.OPEN, ArStatus.PARTIAL] },
        },
        include: {
          customer: {
            select: { id: true, fullName: true, code: true },
          },
          order: {
            select: { id: true, code: true, saleId: true },
          },
        },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      });

      if (receivables.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        cursor = receivables[receivables.length - 1].id;
      }

      for (const ar of receivables) {
        const outstanding = ar.amount.toNumber() - (ar.paidAmount?.toNumber() ?? 0);
        if (outstanding <= 0) continue;

        const daysUntilDue = Math.floor(
          (ar.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        const daysOverdue = -daysUntilDue;

        const basePayload = {
          arId: ar.id,
          arCode: ar.code,
          customerId: ar.customerId,
          customerName: ar.customer?.fullName,
          customerCode: (ar.customer as any)?.code,
          orderId: ar.orderId,
          orderCode: ar.order?.code,
          saleId: ar.order?.saleId,
          outstanding,
          dueDate: ar.dueDate,
          daysOverdue,
        };

        // T-3: Approaching due date — alert Sale + Leader
        if (daysUntilDue <= 3 && daysUntilDue > 0) {
          this.eventEmitter.emit('ar.aging.approaching', {
            ...basePayload,
            alertLevel: 'APPROACHING',
            notifyRoles: ['SALE', 'SALES_LEADER'],
          });
          alertCount++;
        }

        // T+0: Overdue — alert Sale + Leader + Finance
        if (daysOverdue >= 0 && daysOverdue < 15) {
          this.eventEmitter.emit('ar.aging.overdue', {
            ...basePayload,
            alertLevel: 'OVERDUE',
            notifyRoles: ['SALE', 'SALES_LEADER', 'CHIEF_ACCOUNTANT'],
          });
          alertCount++;
        }

        // T+15: Seriously overdue — alert + GD KD
        if (daysOverdue >= 15 && daysOverdue < 30) {
          this.eventEmitter.emit('ar.aging.overdue', {
            ...basePayload,
            alertLevel: 'OVERDUE_15',
            notifyRoles: ['SALE', 'SALES_LEADER', 'CHIEF_ACCOUNTANT', 'SALES_DIRECTOR'],
          });
          alertCount++;
        }

        // T+30: Critical — alert + BGD
        if (daysOverdue >= 30) {
          this.eventEmitter.emit('ar.aging.critical', {
            ...basePayload,
            alertLevel: 'OVERDUE_30',
            notifyRoles: ['SALE', 'SALES_LEADER', 'CHIEF_ACCOUNTANT', 'SALES_DIRECTOR', 'COO', 'CEO'],
          });
          alertCount++;
        }
      }
    }

    if (alertCount > 0) {
      this.logger.warn(`AR aging check: emitted ${alertCount} alert(s)`);
    } else {
      this.logger.log('AR aging check: no alerts');
    }
  }
}
