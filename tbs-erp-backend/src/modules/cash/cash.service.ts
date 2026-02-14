import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { PaymentVoucher, Prisma, ApprovalStatus } from '@prisma/client';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { VoucherQueryDto } from './dto/voucher-query.dto';
import { PaymentVoucherValidator } from './domain/payment-voucher.validator';
import { PaginatedResponse } from '@common/dto/base-response.dto';

@Injectable()
export class CashService {
  private readonly logger = new Logger(CashService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly voucherValidator: PaymentVoucherValidator,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Generate a unique voucher code: TBS-PV-000001 (payment) or TBS-RV-000001 (receipt)
   */
  private async generateCode(type: string): Promise<string> {
    const prefix = type === 'RECEIPT' ? 'TBS-RV' : 'TBS-PV';

    const last = await this.prisma.paymentVoucher.findFirst({
      where: { type },
      orderBy: { createdAt: 'desc' },
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

    const code = await this.generateCode(dto.type);

    const voucher = await this.prisma.paymentVoucher.create({
      data: {
        code,
        type: dto.type,
        orderId: dto.orderId,
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

    // Emit event for approval workflow
    this.eventEmitter.emit('voucher.created', {
      voucherId: voucher.id,
      voucherCode: voucher.code,
      type: voucher.type,
      amount: dto.amount,
      orderId: dto.orderId,
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

    if (voucher.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        `Voucher ${voucher.code} is already ${voucher.status}`,
      );
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

    if (voucher.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        `Voucher ${voucher.code} is already ${voucher.status}`,
      );
    }

    const updated = await this.prisma.paymentVoucher.update({
      where: { id: voucherId },
      data: {
        status: ApprovalStatus.REJECTED,
        approvedBy: rejectedBy,
        approvedAt: new Date(),
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
