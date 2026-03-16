import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { GeneralLedgerService } from '@modules/general-ledger/general-ledger.service';
import { CommissionCalculatorService } from '@modules/commission/services/commission-calculator.service';
import { CreateCostAdjustmentDto } from './dto/create-cost-adjustment.dto';
import { CostAdjustmentQueryDto } from './dto/cost-adjustment-query.dto';
import { generateCode } from '@common/utils/code-generator.util';
import { CostType } from '@prisma/client';

/** Maps CostType to GL expense account code. */
const COST_TYPE_TO_ACCOUNT: Record<CostType, string> = {
  FREIGHT: '632.1',
  CUSTOMS_DUTY: '632.3',
  CUSTOMS_SERVICE_FEE: '632.3',
  HANDLING: '632.4',
  TRANSPORT_CN: '632.1',
  TRANSPORT_VN: '632.1',
  INSURANCE: '632.1',
  PORT_THC: '632.2',
  DO_FEE: '632.2',
  STORAGE_FEE: '632.2',
  OTHER: '811',
};

/** Creditor account (Phai tra NCC). */
const CREDITOR_ACCOUNT = '331';

@Injectable()
export class CostAdjustmentService {
  private readonly logger = new Logger(CostAdjustmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly glService: GeneralLedgerService,
    private readonly commissionCalculator: CommissionCalculatorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new cost adjustment for a completed order.
   */
  async create(dto: CreateCostAdjustmentDto, userId: string) {
    // 1. Validate order exists and is COMPLETED
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      select: { id: true, code: true, status: true, completedAt: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${dto.orderId} not found.`);
    }

    if (order.status !== 'COMPLETED') {
      throw new BadRequestException(
        `Order ${order.code} is in status ${order.status}. Cost adjustments can only be created for COMPLETED orders.`,
      );
    }

    // 2. Determine original period from order.completedAt
    const completedAt = order.completedAt ?? new Date();
    const originalPeriodYear = completedAt.getFullYear();
    const originalPeriodMonth = completedAt.getMonth() + 1;

    // 3. Adjustment period = current month
    const now = new Date();
    const adjustmentPeriodYear = now.getFullYear();
    const adjustmentPeriodMonth = now.getMonth() + 1;

    // 4. Check adjustment period is not closed
    const closedPeriod = await this.prisma.closedPeriod.findUnique({
      where: {
        year_month: {
          year: adjustmentPeriodYear,
          month: adjustmentPeriodMonth,
        },
      },
    });

    if (closedPeriod) {
      throw new BadRequestException(
        `Current accounting period ${adjustmentPeriodYear}-${String(adjustmentPeriodMonth).padStart(2, '0')} is closed. Cannot create cost adjustment.`,
      );
    }

    // 5. Generate code CA-YYYYMM-XXXX
    const code = await generateCode(this.prisma.costAdjustment, {
      prefix: 'CA',
      datePrefixFormat: 'YYYYMM',
      sequenceLength: 4,
    });

    // 6. Create CostAdjustment
    const adjustment = await this.prisma.costAdjustment.create({
      data: {
        code,
        orderId: dto.orderId,
        costType: dto.costType,
        amount: dto.amount,
        currency: dto.currency ?? 'VND',
        description: dto.description,
        invoiceRef: dto.invoiceRef,
        attachments: dto.attachments ?? [],
        vendorName: dto.vendorName,
        originalPeriodYear,
        originalPeriodMonth,
        adjustmentPeriodYear,
        adjustmentPeriodMonth,
        status: 'PENDING',
        createdBy: userId,
      },
      include: {
        order: { select: { code: true } },
      },
    });

    this.logger.log(
      `Cost adjustment ${code} created for order ${order.code}: ${dto.costType} ${dto.amount} ${dto.currency ?? 'VND'}`,
    );

    // 7. Emit event for notification
    this.eventEmitter.emit('cost-adjustment.pending', {
      adjustmentId: adjustment.id,
      adjustmentCode: adjustment.code,
      orderId: order.id,
      orderCode: order.code,
      amount: dto.amount,
      costType: dto.costType,
      createdBy: userId,
    });

    return adjustment;
  }

  /**
   * Approves a cost adjustment: creates GL entry, recalculates profit and commission.
   */
  async approve(adjustmentId: string, userId: string) {
    const adjustment = await this.prisma.costAdjustment.findUnique({
      where: { id: adjustmentId },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            saleId: true,
            serviceType: true,
            totalAmount: true,
            costAllocations: { select: { allocatedAmount: true } },
            receivables: { select: { amount: true } },
            paymentVouchers: {
              where: { status: 'APPROVED' },
              select: { amount: true },
            },
            costAdjustments: {
              where: { status: 'APPROVED' },
              select: { amount: true },
            },
          },
        },
      },
    });

    if (!adjustment) {
      throw new NotFoundException(`Cost adjustment ${adjustmentId} not found.`);
    }

    if (adjustment.status !== 'PENDING') {
      throw new BadRequestException(
        `Cost adjustment ${adjustment.code} is in status ${adjustment.status}, cannot approve.`,
      );
    }

    // --- Step 1: Create GL Entry (current period) ---
    const expenseAccount = COST_TYPE_TO_ACCOUNT[adjustment.costType];
    const amount = Number(adjustment.amount);

    const journalEntry = await this.glService.createJournalEntry(
      {
        date: new Date().toISOString().split('T')[0],
        description: `Chi phi dieu chinh: ${adjustment.description} (Don ${adjustment.order.code})`,
        reference: adjustment.code,
        entries: [
          {
            accountCode: expenseAccount,
            debit: amount,
            credit: 0,
            description: `${adjustment.costType} - ${adjustment.description}`,
          },
          {
            accountCode: CREDITOR_ACCOUNT,
            debit: 0,
            credit: amount,
            description: `Phai tra NCC - ${adjustment.vendorName ?? 'N/A'}`,
          },
        ],
      },
      userId,
    );

    // --- Step 2: Recalculate profit ---
    const order = adjustment.order;
    const revenue = order.receivables.reduce((sum, ar) => sum + Number(ar.amount), 0);

    const voucherCost = order.paymentVouchers.reduce(
      (sum, pv) => sum + Number(pv.amount),
      0,
    );
    const operationCost = order.costAllocations.reduce(
      (sum, ca) => sum + Number(ca.allocatedAmount),
      0,
    );

    // Fetch customs tax allocations
    const taxAllocations = await this.prisma.customsTaxAllocation.findMany({
      where: { orderId: order.id },
      select: { totalAllocated: true },
    });
    const customsTax = taxAllocations.reduce(
      (sum, ta) => sum + Number(ta.totalAllocated),
      0,
    );

    // Existing approved adjustments + this one
    const existingAdjustmentCost = order.costAdjustments.reduce(
      (sum, ca) => sum + Number(ca.amount),
      0,
    );
    const totalAdjustmentCost = existingAdjustmentCost + amount;

    const previousCost = voucherCost + operationCost + customsTax + existingAdjustmentCost;
    const newCost = voucherCost + operationCost + customsTax + totalAdjustmentCost;
    const previousProfit = Math.round((revenue - previousCost) * 100) / 100;
    const newProfit = Math.round((revenue - newCost) * 100) / 100;

    // --- Step 3: Recalculate commission ---
    let previousCommission = 0;
    let newCommission = 0;
    let commissionDelta = 0;

    const commissionRecord = await this.prisma.commissionRecord.findFirst({
      where: { orderId: order.id },
    });

    if (commissionRecord) {
      previousCommission = Number(commissionRecord.commissionAmount);

      if (commissionRecord.status === 'PENDING') {
        // Not yet approved: update directly
        const calcResult = await this.commissionCalculator.calculateCommission({
          id: order.id,
          code: order.code,
          saleId: order.saleId,
          serviceType: order.serviceType,
          totalAmount: order.totalAmount,
          costAllocations: [{ allocatedAmount: newCost }],
        });

        newCommission = calcResult?.amount ?? 0;

        await this.prisma.commissionRecord.update({
          where: { id: commissionRecord.id },
          data: {
            orderCost: newCost,
            netProfit: newProfit,
            commissionRate: calcResult?.rate ?? Number(commissionRecord.commissionRate),
            commissionAmount: newCommission,
          },
        });

        commissionDelta = previousCommission - newCommission;
      } else if (
        commissionRecord.status === 'APPROVED' ||
        commissionRecord.status === 'PAID'
      ) {
        // Already approved/paid: need partial clawback
        const calcResult = await this.commissionCalculator.calculateCommission({
          id: order.id,
          code: order.code,
          saleId: order.saleId,
          serviceType: order.serviceType,
          totalAmount: order.totalAmount,
          costAllocations: [{ allocatedAmount: newCost }],
        });

        newCommission = calcResult?.amount ?? 0;
        commissionDelta = previousCommission - newCommission;

        if (commissionDelta > 0) {
          await this.prisma.commissionRecord.update({
            where: { id: commissionRecord.id },
            data: {
              status: 'ON_HOLD',
              clawbackAmount: commissionDelta,
              clawbackReason: `Chi phi dieu chinh ${adjustment.code}: ${adjustment.description}`,
              clawbackAt: new Date(),
            },
          });
        }
      } else if (commissionRecord.status === 'ON_HOLD') {
        // Already has clawback: accumulate
        const calcResult = await this.commissionCalculator.calculateCommission({
          id: order.id,
          code: order.code,
          saleId: order.saleId,
          serviceType: order.serviceType,
          totalAmount: order.totalAmount,
          costAllocations: [{ allocatedAmount: newCost }],
        });

        newCommission = calcResult?.amount ?? 0;
        const totalClawback = previousCommission - newCommission;
        // Cap at commission amount
        const cappedClawback = Math.min(
          totalClawback,
          Number(commissionRecord.commissionAmount),
        );

        commissionDelta = cappedClawback - Number(commissionRecord.clawbackAmount ?? 0);

        if (commissionDelta > 0) {
          await this.prisma.commissionRecord.update({
            where: { id: commissionRecord.id },
            data: {
              clawbackAmount: cappedClawback,
              clawbackReason: `${commissionRecord.clawbackReason ?? ''} + ${adjustment.code}`,
            },
          });
        }
      }
      // CANCELLED: skip
    }

    // --- Step 4: Update CostAdjustment ---
    const updated = await this.prisma.costAdjustment.update({
      where: { id: adjustmentId },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
        journalEntryId: journalEntry.id,
        previousProfit,
        newProfit,
        previousCommission,
        newCommission,
        commissionDelta,
      },
      include: {
        order: { select: { code: true, saleId: true } },
      },
    });

    this.logger.log(
      `Cost adjustment ${adjustment.code} approved by ${userId}: ` +
        `profit ${previousProfit} -> ${newProfit}, commission ${previousCommission} -> ${newCommission}`,
    );

    // --- Step 5: Events ---
    this.eventEmitter.emit('cost-adjustment.approved', {
      adjustmentId: updated.id,
      adjustmentCode: updated.code,
      orderId: order.id,
      orderCode: order.code,
      amount,
      previousProfit,
      newProfit,
      previousCommission,
      newCommission,
      commissionDelta,
      saleId: order.saleId,
      approvedBy: userId,
    });

    if (commissionDelta > 0 && commissionRecord) {
      this.eventEmitter.emit('order.commission.clawback', {
        commissionId: commissionRecord.id,
        orderId: order.id,
        orderCode: order.code,
        saleId: order.saleId,
        clawbackAmount: commissionDelta,
        reason: `Chi phi dieu chinh ${adjustment.code}`,
      });
    }

    return updated;
  }

  /**
   * Rejects a cost adjustment.
   */
  async reject(adjustmentId: string, userId: string, rejectionNote: string) {
    const adjustment = await this.prisma.costAdjustment.findUnique({
      where: { id: adjustmentId },
      include: { order: { select: { code: true } } },
    });

    if (!adjustment) {
      throw new NotFoundException(`Cost adjustment ${adjustmentId} not found.`);
    }

    if (adjustment.status !== 'PENDING') {
      throw new BadRequestException(
        `Cost adjustment ${adjustment.code} is in status ${adjustment.status}, cannot reject.`,
      );
    }

    const updated = await this.prisma.costAdjustment.update({
      where: { id: adjustmentId },
      data: {
        status: 'REJECTED',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionNote,
      },
      include: {
        order: { select: { code: true } },
      },
    });

    this.logger.log(`Cost adjustment ${adjustment.code} rejected by ${userId}: ${rejectionNote}`);

    this.eventEmitter.emit('cost-adjustment.rejected', {
      adjustmentId: updated.id,
      adjustmentCode: updated.code,
      orderId: adjustment.orderId,
      orderCode: adjustment.order.code,
      rejectedBy: userId,
      rejectionNote,
    });

    return updated;
  }

  /**
   * Preview the profit/commission impact of pending adjustments for an order.
   * Dry-run: does NOT persist anything.
   */
  async previewImpact(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        code: true,
        saleId: true,
        serviceType: true,
        totalAmount: true,
        status: true,
        receivables: { select: { amount: true } },
        paymentVouchers: {
          where: { status: 'APPROVED' },
          select: { amount: true },
        },
        costAllocations: { select: { allocatedAmount: true } },
        costAdjustments: {
          select: { amount: true, status: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found.`);
    }

    const revenue = order.receivables.reduce((sum, ar) => sum + Number(ar.amount), 0);
    const voucherCost = order.paymentVouchers.reduce((sum, pv) => sum + Number(pv.amount), 0);
    const operationCost = order.costAllocations.reduce(
      (sum, ca) => sum + Number(ca.allocatedAmount),
      0,
    );

    // Fetch customs tax allocations
    const taxAllocations = await this.prisma.customsTaxAllocation.findMany({
      where: { orderId },
      select: { totalAllocated: true },
    });
    const customsTax = taxAllocations.reduce(
      (sum, ta) => sum + Number(ta.totalAllocated),
      0,
    );

    const approvedAdjustments = order.costAdjustments
      .filter((ca) => ca.status === 'APPROVED')
      .reduce((sum, ca) => sum + Number(ca.amount), 0);

    const pendingAdjustments = order.costAdjustments
      .filter((ca) => ca.status === 'PENDING')
      .reduce((sum, ca) => sum + Number(ca.amount), 0);

    const currentCost = voucherCost + operationCost + customsTax + approvedAdjustments;
    const projectedCost = currentCost + pendingAdjustments;

    const currentProfit = Math.round((revenue - currentCost) * 100) / 100;
    const projectedProfit = Math.round((revenue - projectedCost) * 100) / 100;

    // Calculate projected commission
    const commissionRecord = await this.prisma.commissionRecord.findFirst({
      where: { orderId },
    });

    const currentCommission = commissionRecord
      ? Number(commissionRecord.commissionAmount)
      : 0;

    const calcResult = await this.commissionCalculator.calculateCommission({
      id: order.id,
      code: order.code,
      saleId: order.saleId,
      serviceType: order.serviceType,
      totalAmount: order.totalAmount,
      costAllocations: [{ allocatedAmount: projectedCost }],
    });

    const projectedCommission = calcResult?.amount ?? 0;

    return {
      orderId,
      orderCode: order.code,
      revenue,
      currentCost,
      projectedCost,
      currentProfit,
      projectedProfit,
      currentCommission,
      projectedCommission,
      commissionDelta: Math.round((currentCommission - projectedCommission) * 100) / 100,
      pendingAdjustmentCount: order.costAdjustments.filter((ca) => ca.status === 'PENDING').length,
      pendingAdjustmentTotal: pendingAdjustments,
    };
  }

  /**
   * Lists cost adjustments with pagination and filters.
   */
  async findAll(query: CostAdjustmentQueryDto) {
    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.costType) {
      where.costType = query.costType;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { invoiceRef: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.costAdjustment.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy,
        include: {
          order: { select: { code: true, saleId: true } },
        },
      }),
      this.prisma.costAdjustment.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Lists cost adjustments for a specific order.
   */
  async findByOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found.`);
    }

    return this.prisma.costAdjustment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Gets a single cost adjustment by ID.
   */
  async findById(id: string) {
    const adjustment = await this.prisma.costAdjustment.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            code: true,
            saleId: true,
            serviceType: true,
            totalAmount: true,
            status: true,
          },
        },
      },
    });

    if (!adjustment) {
      throw new NotFoundException(`Cost adjustment ${id} not found.`);
    }

    return adjustment;
  }
}
