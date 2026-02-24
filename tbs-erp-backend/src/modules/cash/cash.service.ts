import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { PaymentVoucher, Prisma, ApprovalStatus, VoucherType } from '@prisma/client';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { VoucherQueryDto } from './dto/voucher-query.dto';
import { PaymentVoucherValidator } from './domain/payment-voucher.validator';
import { VoucherStatusMachine } from './domain/voucher-status.machine';
import { PaginatedResponse } from '@common/dto/base-response.dto';

@Injectable()
export class CashService {
  private readonly logger = new Logger(CashService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly voucherValidator: PaymentVoucherValidator,
    private readonly voucherStatusMachine: VoucherStatusMachine,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  /**
   * Generate a unique voucher code: TBS-PV-000001 (payment) or TBS-RV-000001 (receipt)
   */
  private async generateCode(type: string): Promise<string> {
    const prefix = type === 'RECEIPT' ? 'TBS-RV' : 'TBS-PV';

    const last = await this.prisma.paymentVoucher.findFirst({
      where: { type: type as VoucherType },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let nextNumber = 1;
    if (last?.code) {
      const match = last.code.match(new RegExp(`${prefix}-(\\d+)`));
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}-${String(nextNumber).padStart(6, '0')}`;
  }

  /**
   * Create a new payment or receipt voucher.
   * Payment vouchers go through anti-fraud validation.
   */
  async createVoucher(dto: CreateVoucherDto, createdBy: string) {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Voucher amount must be greater than 0');
    }

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

    // D6: Mandatory attachments for vouchers > 10M VND
    if (dto.amount > 10_000_000 && (!dto.attachments || dto.attachments.length === 0)) {
      throw new BadRequestException(
        'Phiếu chi/thu trên 10 triệu VND bắt buộc đính kèm chứng từ',
      );
    }

    // Layer 2B: Closed period enforcement — check voucher date
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

    // Layer 1D: 3-way matching FLAG — warn if payment exceeds supplier order quoted total
    if (dto.type === 'PAYMENT' && dto.supplierOrderId) {
      const so = await this.prisma.supplierOrder.findUnique({
        where: { id: dto.supplierOrderId },
        select: { id: true, code: true, totalCNY: true },
      });
      if (so && Number(so.totalCNY ?? 0) > 0) {
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
    }

    let voucher: PaymentVoucher & { order: any } | null = null;
    let code: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        code = await this.generateCode(dto.type);

        voucher = await this.prisma.paymentVoucher.create({
          data: {
            code,
            type: dto.type,
            orderId: dto.orderId,
            supplierOrderId: dto.supplierOrderId ?? null,
            amount: new Prisma.Decimal(dto.amount),
            currency: dto.currency ?? 'VND',
            paymentMethod: dto.paymentMethod,
            costType: dto.costType,
            beneficiary: dto.beneficiary,
            reason: dto.reason,
            attachments: dto.attachments ?? [],
            status: ApprovalStatus.PENDING,
            isFlagged: validation.isFlagged,
            flagReason: validation.isFlagged
              ? validation.flagReasons.join('; ')
              : null,
            createdBy,
          },
          include: { order: true },
        });
        break;
      } catch (error) {
        if (error.code === 'P2002' && attempt < 2) {
          this.logger.warn(`Voucher code conflict on attempt ${attempt + 1}, retrying...`);
          continue;
        }
        throw error;
      }
    }

    if (!voucher) {
      throw new Error('Failed to create voucher after multiple attempts');
    }

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
      `Voucher created: ${code}, type=${dto.type}, amount=${dto.amount}, flagged=${validation.isFlagged}`,
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
   * Approve a voucher. Creates a cash transaction record.
   */
  async approveVoucher(voucherId: string, approvedBy: string) {
    const voucher = await this.prisma.paymentVoucher.findUnique({
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

    // Layer 3B: Negative balance check for PAYMENT vouchers
    if (voucher.type === 'PAYMENT') {
      const balance = await this.getCurrentBalance(voucher.currency);
      const voucherAmount = Number(voucher.amount);
      if (balance < voucherAmount) {
        throw new BadRequestException(
          `Số dư quỹ ${voucher.currency} không đủ. Hiện có: ${balance.toLocaleString()}, Cần chi: ${voucherAmount.toLocaleString()}`,
        );
      }
    }

    // D1: Block receipt voucher approval if cumulative total exceeds order amount
    if (voucher.type === 'RECEIPT' && voucher.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: voucher.orderId },
        select: { totalAmount: true },
      });
      if (order) {
        const approvedReceipts = await this.prisma.paymentVoucher.aggregate({
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

    return this.prisma.executeInTransaction(async (tx) => {
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

      this.eventEmitter.emit('voucher.approved', {
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
        this.eventEmitter.emit('payment.received', {
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
        flagReason: reason
          ? `Rejected by ${rejectedBy}: ${reason}`
          : `Rejected by ${rejectedBy}`,
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
