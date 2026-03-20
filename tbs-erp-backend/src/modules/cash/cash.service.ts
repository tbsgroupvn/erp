import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DomainException } from '@common/exceptions';
import { ErrorCode } from '@common/exceptions';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { TransactionalEmitter } from '@core/events/transactional-emitter.service';
import { PaymentVoucher, Prisma, ApprovalStatus, VoucherType } from '@prisma/client';
import { generateCode } from '@common/utils/code-generator.util';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { VoucherQueryDto } from './dto/voucher-query.dto';
import { PaymentVoucherValidator } from './domain/payment-voucher.validator';
import { VoucherStatusMachine } from './domain/voucher-status.machine';
import { CashFlowGuardService, CashFlowStatus } from './domain/cash-flow-guard.service';
import { PaginatedResponse } from '@common/dto/base-response.dto';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { ExchangeRateGLService } from '../general-ledger/exchange-rate-gl.service';

@Injectable()
export class CashService {
  private readonly logger = new Logger(CashService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly voucherValidator: PaymentVoucherValidator,
    private readonly voucherStatusMachine: VoucherStatusMachine,
    private readonly cashFlowGuard: CashFlowGuardService,
    private readonly eventEmitter: EventEmitter2,
    private readonly txEmitter: TransactionalEmitter,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly exchangeRateGLService: ExchangeRateGLService,
  ) {}

  /**
   * Generate a unique voucher code: TBS-PV-000001 (payment) or TBS-RV-000001 (receipt)
   */
  private async generateVoucherCode(type: string): Promise<string> {
    const prefix = type === 'RECEIPT' ? 'TBS-RV' : 'TBS-PV';
    return generateCode(this.prisma.paymentVoucher, {
      prefix,
      sequenceLength: 6,
    });
  }

  /**
   * Create a new payment or receipt voucher.
   * Payment vouchers go through anti-fraud validation.
   */
  async createVoucher(dto: CreateVoucherDto, createdBy: string) {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Voucher amount must be greater than 0');
    }

    // Bank Trace ID validation cho RECEIPT + BANK_TRANSFER
    if (dto.type === 'RECEIPT' && dto.paymentMethod === 'BANK_TRANSFER') {
      if (!dto.bankTraceId) {
        throw new BadRequestException(
          'Phieu thu chuyen khoan bat buoc nhap Ma giao dich ngan hang (Bank Trace ID)',
        );
      }
      const existingVoucher = await this.prisma.paymentVoucher.findFirst({
        where: { bankTraceId: dto.bankTraceId },
        select: { code: true },
      });
      if (existingVoucher) {
        throw new BadRequestException(
          `Ma GD ngan hang "${dto.bankTraceId}" da duoc su dung cho phieu ${existingVoucher.code}`,
        );
      }
    }

    // ORDER-CENTRIC: Validate related entities exist
    await this.validateVoucherRelations(dto);

    // Run anti-fraud validation
    const validation = await this.voucherValidator.validate({
      type: dto.type,
      orderId: dto.orderId,
      amount: dto.amount,
      reason: dto.reason,
      beneficiary: dto.beneficiary,
      costType: dto.costType,
      attachments: dto.attachments ?? [],
      createdBy,
    });

    if (validation.isBlocked) {
      throw new BadRequestException({
        message: 'Payment voucher blocked by validation',
        blockReasons: validation.blockReasons,
      });
    }

    // NOTE: Attachment enforcement is handled entirely by PaymentVoucherValidator (block check #4).
    // The validator already blocks ALL payment vouchers without attachments, regardless of amount.
    // A separate per-amount threshold check here would be redundant dead code.

    // Layer 2B: Closed period enforcement — check voucher date
    await this.enforceOpenAccountingPeriod();

    // Layer 1D: 3-way matching FLAG
    await this.checkThreeWayMatching(dto, validation);

    // Generate code and create voucher with retry on code conflict
    const voucher = await this.generateVoucherWithRetry(dto, validation, createdBy);

    // Determine approval type: PROCUREMENT_PAYMENT if linked to supplier order
    const approvalType = dto.supplierOrderId
      ? 'PROCUREMENT_PAYMENT'
      : voucher.type === 'PAYMENT'
        ? 'PAYMENT_VOUCHER'
        : 'RECEIPT_VOUCHER';

    // Emit event for approval workflow
    this.eventEmitter.emit('voucher.created', {
      voucherId: voucher.id,
      voucherCode: voucher.code,
      type: voucher.type,
      approvalType,
      amount: dto.amount,
      orderId: dto.orderId,
      supplierOrderId: dto.supplierOrderId,
      isFlagged: validation.isFlagged,
      flagReasons: validation.flagReasons,
      createdBy,
    });

    this.logger.log(
      `Voucher created: ${voucher.code}, type=${dto.type}, amount=${dto.amount}, flagged=${validation.isFlagged}`,
    );

    return {
      voucher,
      validation: {
        isFlagged: validation.isFlagged,
        flagReasons: validation.flagReasons,
      },
    };
  }

  /**
   * Validates that referenced orderId and supplierOrderId exist in the database.
   */
  private async validateVoucherRelations(dto: CreateVoucherDto): Promise<void> {
    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        select: { id: true },
      });
      if (!order) {
        throw new NotFoundException(`Order ${dto.orderId} not found`);
      }
    }

    if (dto.supplierOrderId) {
      const so = await this.prisma.supplierOrder.findUnique({
        where: { id: dto.supplierOrderId },
        select: { id: true },
      });
      if (!so) {
        throw new NotFoundException(`Supplier order ${dto.supplierOrderId} not found`);
      }
    }
  }

  /**
   * Enforces that the current accounting period is open. Throws if closed.
   */
  private async enforceOpenAccountingPeriod(): Promise<void> {
    const voucherDate = new Date();
    const voucherYear = voucherDate.getFullYear();
    const voucherMonth = voucherDate.getMonth() + 1;
    const closedPeriod = await this.prisma.closedPeriod.findUnique({
      where: { year_month: { year: voucherYear, month: voucherMonth } },
    });
    if (closedPeriod) {
      throw new ForbiddenException(
        `Kỳ kế toán ${voucherMonth}/${voucherYear} đã đóng, không thể tạo phiếu`,
      );
    }
  }

  /**
   * Checks 3-way matching: flags if payment exceeds supplier order quoted total by more than 5%.
   */
  private async checkThreeWayMatching(
    dto: CreateVoucherDto,
    validation: { isFlagged: boolean; flagReasons: string[] },
  ): Promise<void> {
    if (dto.type !== 'PAYMENT' || !dto.supplierOrderId) {
      return;
    }

    const so = await this.prisma.supplierOrder.findUnique({
      where: { id: dto.supplierOrderId },
      select: { id: true, code: true, totalCNY: true },
    });

    if (!so || Number(so.totalCNY ?? 0) <= 0) {
      return;
    }

    const existingPaid = await this.prisma.paymentVoucher.aggregate({
      where: {
        supplierOrderId: dto.supplierOrderId,
        type: 'PAYMENT',
        status: 'APPROVED',
      },
      _sum: { amount: true },
    });
    const alreadyPaid = Number(existingPaid._sum.amount ?? 0);
    const projectedTotal = alreadyPaid + dto.amount;
    const totalQuoted = Number(so.totalCNY);

    if (projectedTotal > totalQuoted * 1.05) {
      validation.isFlagged = true;
      validation.flagReasons.push(
        `3-way match: Tổng chi dự kiến (${projectedTotal.toLocaleString()}) vượt báo giá NCC ${so.code} (${totalQuoted.toLocaleString()}) hơn 5%`,
      );
    }
  }

  /**
   * Generates a voucher code and creates the voucher record, retrying on code conflicts.
   */
  private async generateVoucherWithRetry(
    dto: CreateVoucherDto,
    validation: { isFlagged: boolean; flagReasons: string[] },
    createdBy: string,
  ): Promise<PaymentVoucher & { order: any }> {
    // Auto-populate exchange rate fields for foreign currency PAYMENT vouchers
    const currency = dto.currency ?? 'VND';
    let exchangeRateAtOrder: number | null = null;
    let exchangeRateAtPayment: number | null = null;
    let exchangeRateDiff: number | null = null;

    if (dto.type === 'PAYMENT' && currency !== 'VND' && dto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        select: { baseExchangeRate: true },
      });

      // Get payment rate: from DTO or current market rate
      if (dto.exchangeRateAtPayment) {
        exchangeRateAtPayment = dto.exchangeRateAtPayment;
      } else {
        const rateRecord = await this.exchangeRateService.getCurrentRate(
          currency as any,
          'VND' as any,
        );
        exchangeRateAtPayment = rateRecord ? Number(rateRecord.rate) : 0;
      }

      // Get order rate: from Order.baseExchangeRate (FIXED mode) or fallback to payment rate
      const orderRate = Number(order?.baseExchangeRate ?? 0);
      if (orderRate > 0) {
        exchangeRateAtOrder = orderRate;
      } else {
        // FLOATING mode: order didn't lock rate, use payment rate as reference (no diff)
        exchangeRateAtOrder = exchangeRateAtPayment;
      }

      if (exchangeRateAtOrder > 0 && exchangeRateAtPayment > 0) {
        exchangeRateDiff = exchangeRateAtPayment - exchangeRateAtOrder;
      }
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const code = await this.generateVoucherCode(dto.type);

        const voucher = await this.prisma.paymentVoucher.create({
          data: {
            code,
            type: dto.type,
            orderId: dto.orderId,
            supplierOrderId: dto.supplierOrderId ?? null,
            amount: new Prisma.Decimal(dto.amount),
            currency,
            paymentMethod: dto.paymentMethod,
            costType: dto.costType,
            beneficiary: dto.beneficiary,
            reason: dto.reason,
            attachments: dto.attachments ?? [],
            status: ApprovalStatus.PENDING,
            isFlagged: validation.isFlagged,
            flagReason: validation.isFlagged ? validation.flagReasons.join('; ') : null,
            bankTraceId: dto.bankTraceId || null,
            createdBy,
            ...(exchangeRateAtOrder !== null && {
              exchangeRateAtOrder: new Prisma.Decimal(exchangeRateAtOrder),
            }),
            ...(exchangeRateAtPayment !== null && {
              exchangeRateAtPayment: new Prisma.Decimal(exchangeRateAtPayment),
            }),
            ...(exchangeRateDiff !== null && {
              exchangeRateDiff: new Prisma.Decimal(exchangeRateDiff),
            }),
          },
          include: { order: true },
        });

        return voucher;
      } catch (error) {
        if (error.code === 'P2002' && attempt < 2) {
          this.logger.warn(`Voucher code conflict on attempt ${attempt + 1}, retrying...`);
          continue;
        }
        throw error;
      }
    }

    throw new DomainException(ErrorCode.PAYMENT_FAILED, 'Failed to create voucher after multiple attempts', HttpStatus.INTERNAL_SERVER_ERROR);
  }

  /**
   * Approve a voucher. Creates a cash transaction record.
   */
  async approveVoucher(voucherId: string, approvedBy: string) {
    const collector = this.txEmitter.createCollector();

    const result = await this.prisma.executeInTransaction(async (tx) => {
      // Re-fetch voucher INSIDE transaction for consistency
      const voucher = await tx.paymentVoucher.findUnique({
        where: { id: voucherId },
      });

      if (!voucher) {
        throw new NotFoundException(`Voucher ${voucherId} not found`);
      }

      this.voucherStatusMachine.assertTransition(voucher.status, ApprovalStatus.APPROVED);

      // Layer 3A: Segregation of duties — creator cannot approve their own voucher
      if (voucher.createdBy === approvedBy) {
        throw new ForbiddenException(
          `Không thể tự duyệt phiếu chi do chính mình tạo (${voucher.code})`,
        );
      }

      // Layer 3B: Negative balance check for PAYMENT vouchers WITH row-level lock
      // Lock all approved voucher rows first, THEN aggregate (FOR UPDATE is invalid with SUM)
      if (voucher.type === 'PAYMENT') {
        // Validate currency to prevent injection via raw SQL
        const validCurrencies = ['VND', 'USD', 'CNY', 'EUR'];
        if (!validCurrencies.includes(voucher.currency)) {
          throw new BadRequestException(`Invalid currency: ${voucher.currency}`);
        }

        await tx.$queryRaw`
          SELECT id FROM payment_vouchers
          WHERE status='APPROVED' AND currency::text = ${voucher.currency}
          FOR UPDATE`;
        const balanceResult = await tx.$queryRaw<Array<{ balance: any }>>`
          SELECT COALESCE(SUM(CASE WHEN type='RECEIPT' THEN amount ELSE 0 END), 0) -
                 COALESCE(SUM(CASE WHEN type='PAYMENT' THEN amount ELSE 0 END), 0) as balance
          FROM payment_vouchers WHERE status='APPROVED' AND currency::text = ${voucher.currency}`;
        const balance = Number(balanceResult[0]?.balance ?? 0);
        const voucherAmount = Number(voucher.amount);
        if (balance < voucherAmount) {
          throw new BadRequestException(
            `Số dư quỹ ${voucher.currency} không đủ. Hiện có: ${balance.toLocaleString()}, Cần chi: ${voucherAmount.toLocaleString()}`,
          );
        }
      }

      // Layer 3C: Cash flow control - re-validate at approval time
      if (voucher.type === 'PAYMENT' && voucher.orderId) {
        const cfCheck = await this.cashFlowGuard.validateSupplierPayment(
          voucher.orderId,
          Number(voucher.amount),
        );
        if (!cfCheck.allowed) {
          throw new BadRequestException(cfCheck.reason);
        }

        // Also validate system-wide cash flow
        const systemCheck = await this.cashFlowGuard.validateSystemCashFlow();
        if (!systemCheck.allowed) {
          throw new BadRequestException(systemCheck.reason);
        }
      }

      // D1: Block receipt voucher approval if cumulative total exceeds order amount
      if (voucher.type === 'RECEIPT' && voucher.orderId) {
        const order = await tx.order.findUnique({
          where: { id: voucher.orderId },
          select: { totalAmount: true },
        });
        if (order) {
          const approvedReceipts = await tx.paymentVoucher.aggregate({
            where: {
              orderId: voucher.orderId,
              type: 'RECEIPT',
              status: 'APPROVED',
            },
            _sum: { amount: true },
          });
          const alreadyApproved = Number(approvedReceipts._sum.amount ?? 0);
          const projectedTotal = alreadyApproved + Number(voucher.amount);
          if (projectedTotal > Number(order.totalAmount)) {
            throw new BadRequestException(
              `Tổng phiếu thu duyệt (${projectedTotal.toLocaleString()}) vượt tổng đơn hàng (${Number(order.totalAmount).toLocaleString()})`,
            );
          }
        }
      }

      // Update voucher status
      const updated = await tx.paymentVoucher.update({
        where: { id: voucherId },
        data: {
          status: ApprovalStatus.APPROVED,
          approvedBy,
          approvedAt: new Date(),
        },
        include: { order: true },
      });

      // Create cash transaction record
      await tx.cashTransaction.create({
        data: {
          voucherId: voucher.id,
          type: voucher.type === 'RECEIPT' ? 'IN' : 'OUT',
          amount: voucher.amount,
          currency: voucher.currency,
          paymentMethod: voucher.paymentMethod,
          reference: voucher.code,
          note: voucher.reason,
          createdBy: approvedBy,
        },
      });

      // Record FX gain/loss GL entry for foreign currency PAYMENT vouchers
      if (
        voucher.type === 'PAYMENT' &&
        voucher.currency !== 'VND' &&
        voucher.exchangeRateAtOrder &&
        voucher.exchangeRateAtPayment
      ) {
        const diff = Number(voucher.exchangeRateAtPayment) - Number(voucher.exchangeRateAtOrder);
        if (Math.abs(diff) >= 0.01) {
          await this.exchangeRateGLService.recordSupplierFxGainLoss(
            voucher.id,
            Number(voucher.amount),
            Number(voucher.exchangeRateAtPayment),
            Number(voucher.exchangeRateAtOrder),
            voucher.currency,
            approvedBy,
          );
          this.logger.log(
            `FX ${diff > 0 ? 'loss' : 'gain'} recorded for voucher ${voucher.code}: diff=${diff}`,
          );
        }
      }

      collector.emit('voucher.approved', {
        voucherId: voucher.id,
        voucherCode: voucher.code,
        type: voucher.type,
        amount: voucher.amount.toNumber(),
        orderId: voucher.orderId,
        approvedBy,
      });

      // When a RECEIPT voucher is approved and linked to an order,
      // emit payment.received so the order deposit tracking is updated.
      if (voucher.type === 'RECEIPT' && voucher.orderId) {
        collector.emit('payment.received', {
          orderId: voucher.orderId,
          amount: voucher.amount.toNumber(),
          paymentMethod: voucher.paymentMethod,
          reference: voucher.code,
        });
      }

      this.logger.log(
        `Voucher approved: ${voucher.code}, amount=${voucher.amount}, approvedBy=${approvedBy}`,
      );

      return updated;
    });

    // Flush buffered events after transaction commits
    collector.flush();

    return result;
  }

  /**
   * Reject a voucher.
   */
  async rejectVoucher(voucherId: string, rejectedBy: string, reason?: string) {
    const voucher = await this.prisma.paymentVoucher.findUnique({
      where: { id: voucherId },
    });

    if (!voucher) {
      throw new NotFoundException(`Voucher ${voucherId} not found`);
    }

    this.voucherStatusMachine.assertTransition(voucher.status, ApprovalStatus.REJECTED);

    const updated = await this.prisma.paymentVoucher.update({
      where: { id: voucherId },
      data: {
        status: ApprovalStatus.REJECTED,
        approvedBy: null,
        approvedAt: null,
        flagReason: reason ? `Rejected by ${rejectedBy}: ${reason}` : `Rejected by ${rejectedBy}`,
      },
      include: { order: true },
    });

    this.eventEmitter.emit('voucher.rejected', {
      voucherId: voucher.id,
      voucherCode: voucher.code,
      rejectedBy,
      reason,
    });

    this.logger.log(`Voucher rejected: ${voucher.code}, by=${rejectedBy}`);

    return updated;
  }

  /**
   * List vouchers with pagination and filters.
   */
  async findAll(query: VoucherQueryDto) {
    const where: Prisma.PaymentVoucherWhereInput = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.orderId) {
      where.orderId = query.orderId;
    }

    if (query.createdBy) {
      where.createdBy = query.createdBy;
    }

    if (query.isFlagged !== undefined) {
      where.isFlagged = query.isFlagged;
    }

    if (query.search) {
      where.code = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.paymentVoucher.findMany({
        where,
        include: { order: true },
        orderBy: query.orderBy,
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.paymentVoucher.count({ where }),
    ]);

    return PaginatedResponse.paginate(data, total, query.page, query.limit);
  }

  /**
   * Layer 3B: Calculate current cash balance for a given currency.
   * Balance = SUM(approved RECEIPT) - SUM(approved PAYMENT)
   */
  async getCurrentBalance(currency: string): Promise<number> {
    const [receipts, payments] = await Promise.all([
      this.prisma.paymentVoucher.aggregate({
        where: { type: 'RECEIPT', status: 'APPROVED', currency: currency as any },
        _sum: { amount: true },
      }),
      this.prisma.paymentVoucher.aggregate({
        where: { type: 'PAYMENT', status: 'APPROVED', currency: currency as any },
        _sum: { amount: true },
      }),
    ]);

    const totalReceipts = Number(receipts._sum.amount ?? 0);
    const totalPayments = Number(payments._sum.amount ?? 0);

    return totalReceipts - totalPayments;
  }

  /**
   * Get system-wide cash flow status (deposits vs supplier payments).
   */
  async getFlowStatus(): Promise<CashFlowStatus> {
    return this.cashFlowGuard.getSystemFlowStatus();
  }

  /**
   * Get per-order cash flow status.
   */
  async getOrderFlowStatus(orderId: string) {
    return this.cashFlowGuard.getOrderFlowStatus(orderId);
  }

  /**
   * Get exchange rate variance report for PAYMENT vouchers with foreign currency.
   * Returns vouchers with FX diff, plus summary totals.
   */
  async getExchangeRateVariance(startDate?: Date, endDate?: Date) {
    const where: Prisma.PaymentVoucherWhereInput = {
      type: 'PAYMENT',
      currency: { not: 'VND' },
      exchangeRateDiff: { not: null },
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const vouchers = await this.prisma.paymentVoucher.findMany({
      where,
      select: {
        id: true,
        code: true,
        orderId: true,
        amount: true,
        currency: true,
        exchangeRateAtOrder: true,
        exchangeRateAtPayment: true,
        exchangeRateDiff: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalGain = 0;
    let totalLoss = 0;

    const items = vouchers.map((v) => {
      const diff = Number(v.exchangeRateDiff);
      const amount = Number(v.amount);
      // diff > 0 means loss (TBS paid more), diff < 0 means gain (TBS paid less)
      const impactVND = diff * amount;

      if (impactVND > 0) {
        totalLoss += impactVND;
      } else {
        totalGain += Math.abs(impactVND);
      }

      return {
        ...v,
        amount: Number(v.amount),
        exchangeRateAtOrder: Number(v.exchangeRateAtOrder),
        exchangeRateAtPayment: Number(v.exchangeRateAtPayment),
        exchangeRateDiff: diff,
        impactVND,
        type: impactVND > 0 ? 'LOSS' : impactVND < 0 ? 'GAIN' : 'NEUTRAL',
      };
    });

    return {
      items,
      summary: {
        totalGain,
        totalLoss,
        net: totalGain - totalLoss,
        count: items.length,
      },
    };
  }

  /**
   * Get cash flow summary: total receipts vs payments over a period.
   */
  async getCashFlow(startDate?: Date, endDate?: Date) {
    const dateFilter: Prisma.CashTransactionWhereInput = {};

    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = startDate;
      if (endDate) dateFilter.createdAt.lte = endDate;
    }

    const [inflow, outflow] = await Promise.all([
      this.prisma.cashTransaction.aggregate({
        where: { ...dateFilter, type: 'IN' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.cashTransaction.aggregate({
        where: { ...dateFilter, type: 'OUT' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const totalIn = inflow._sum.amount?.toNumber() ?? 0;
    const totalOut = outflow._sum.amount?.toNumber() ?? 0;

    return {
      totalInflow: totalIn,
      totalOutflow: totalOut,
      netCashFlow: totalIn - totalOut,
      inflowCount: inflow._count,
      outflowCount: outflow._count,
    };
  }
}
