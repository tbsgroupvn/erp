import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { Invoice, InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateInvoiceItemDto, TaxType } from './dto/create-invoice-item.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { PaginatedResponse } from '@common/dto/base-response.dto';

/** Maps TaxType enum to numeric tax rate. */
const TAX_RATE_MAP: Record<TaxType, number> = {
  [TaxType.NO_TAX]: 0,
  [TaxType.ZERO_PERCENT]: 0,
  [TaxType.EIGHT_PERCENT]: 0.08,
  [TaxType.TEN_PERCENT]: 0.10,
};

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  /**
   * Generate a unique invoice code: TBS-INV-000001
   */
  private async generateCode(prismaClient?: any): Promise<string> {
    const client = prismaClient ?? this.prisma;
    const last = await client.invoice.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    let nextNumber = 1;
    if (last?.code) {
      const match = last.code.match(/TBS-INV-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `TBS-INV-${String(nextNumber).padStart(6, '0')}`;
  }

  /**
   * Computes the tax rate for a given TaxType.
   */
  private getTaxRateForType(taxType: TaxType): number {
    return TAX_RATE_MAP[taxType] ?? 0;
  }

  /**
   * Create a new invoice in DRAFT status.
   * Uses a transaction to prevent duplicate code generation (TOCTOU).
   *
   * When `items` are provided in the DTO, per-item tax calculations are performed:
   * each item's amount and tax are computed individually, then summed
   * to derive the invoice totals. InvoiceItem records are created alongside the Invoice.
   *
   * When no items are provided, the legacy behavior is used (single taxRate on dto.amount).
   */
  async createInvoice(
    dto: CreateInvoiceDto,
    createdBy: string,
  ): Promise<Invoice> {
    const hasItems = dto.items && dto.items.length > 0;

    const invoice = await this.prisma.executeInTransaction(async (tx) => {
      const code = await this.generateCode(tx);

      if (hasItems) {
        // Per-item tax calculation
        const itemCalculations = dto.items!.map((item) => {
          const itemAmount = item.quantity * item.unitPrice;
          const itemTaxRate = this.getTaxRateForType(item.taxType);
          const itemTaxAmount = Math.round(itemAmount * itemTaxRate * 100) / 100;
          return {
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: itemAmount,
            taxType: item.taxType,
            taxRate: itemTaxRate,
            taxAmount: itemTaxAmount,
          };
        });

        // Sum item amounts and taxes for invoice totals
        const totalAmountBeforeTax = itemCalculations.reduce(
          (sum, item) => sum + item.amount,
          0,
        );
        const totalTaxAmount = itemCalculations.reduce(
          (sum, item) => sum + item.taxAmount,
          0,
        );
        const totalAmount = totalAmountBeforeTax + totalTaxAmount;

        // Compute effective average tax rate for the invoice header
        const effectiveTaxRate =
          totalAmountBeforeTax > 0
            ? Math.round((totalTaxAmount / totalAmountBeforeTax) * 10000) / 10000
            : 0;

        // Create invoice with items in a single operation
        const created = await tx.invoice.create({
          data: {
            code,
            orderId: dto.orderId,
            customerId: dto.customerId,
            type: (dto.type ?? 'GTGT') as InvoiceType,
            amount: new Prisma.Decimal(totalAmountBeforeTax),
            taxRate: new Prisma.Decimal(effectiveTaxRate),
            taxAmount: new Prisma.Decimal(totalTaxAmount),
            totalAmount: new Prisma.Decimal(totalAmount),
            status: 'DRAFT',
            createdBy,
            items: {
              create: itemCalculations.map((item) => ({
                description: item.description,
                quantity: new Prisma.Decimal(item.quantity),
                unitPrice: new Prisma.Decimal(item.unitPrice),
                amount: new Prisma.Decimal(item.amount),
                taxType: item.taxType,
                taxAmount: new Prisma.Decimal(item.taxAmount),
              })),
            },
          },
          include: { items: true },
        });

        return created;
      }

      // Legacy single-rate calculation (no items)
      const taxRate = dto.taxRate ?? 0.1;
      const taxAmount = dto.amount * taxRate;
      const totalAmount = dto.amount + taxAmount;

      return tx.invoice.create({
        data: {
          code,
          orderId: dto.orderId,
          customerId: dto.customerId,
          type: (dto.type ?? 'GTGT') as InvoiceType,
          amount: new Prisma.Decimal(dto.amount),
          taxRate: new Prisma.Decimal(taxRate),
          taxAmount: new Prisma.Decimal(taxAmount),
          totalAmount: new Prisma.Decimal(totalAmount),
          status: 'DRAFT',
          createdBy,
        },
      });
    });

    this.eventEmitter.emit('invoice.created', {
      invoiceId: invoice.id,
      invoiceCode: invoice.code,
      customerId: dto.customerId,
      totalAmount: Number(invoice.totalAmount),
    });

    this.logger.log(
      `Invoice created: ${invoice.code}, customer=${dto.customerId}, total=${invoice.totalAmount}` +
        (hasItems ? `, items=${dto.items!.length}` : ''),
    );

    return invoice;
  }

  /**
   * Issue an invoice (transition from DRAFT to ISSUED).
   * Uses a transaction to prevent race conditions on status check-then-update.
   */
  async issueInvoice(invoiceId: string): Promise<Invoice> {
    const updated = await this.prisma.executeInTransaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} not found`);
      }

      if (invoice.status !== 'DRAFT') {
        throw new BadRequestException(
          `Invoice ${invoice.code} is ${invoice.status}. Only DRAFT invoices can be issued.`,
        );
      }

      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'ISSUED',
          issuedAt: new Date(),
        },
      });
    });

    this.eventEmitter.emit('invoice.issued', {
      invoiceId: updated.id,
      invoiceCode: updated.code,
    });

    this.logger.log(`Invoice issued: ${updated.code}`);

    return updated;
  }

  /**
   * Cancel an invoice. Cannot cancel if already sent to tax authority.
   * Uses a transaction to prevent race conditions on status check-then-update.
   */
  async cancelInvoice(invoiceId: string, reason?: string): Promise<Invoice> {
    const updated = await this.prisma.executeInTransaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} not found`);
      }

      if (invoice.status === 'CANCELLED') {
        throw new BadRequestException(
          `Invoice ${invoice.code} is already cancelled`,
        );
      }

      if (invoice.sentToTaxAt) {
        throw new BadRequestException(
          `Invoice ${invoice.code} has been sent to tax authority. ` +
          'Cannot cancel directly. Use adjustment invoice instead.',
        );
      }

      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'CANCELLED',
        },
      });
    });

    this.eventEmitter.emit('invoice.cancelled', {
      invoiceId: updated.id,
      invoiceCode: updated.code,
      reason,
    });

    this.logger.log(`Invoice cancelled: ${updated.code}`);

    return updated;
  }

  /**
   * Create an adjustment invoice for an invoice that has been sent to tax authority.
   * The original invoice status is updated to ADJUSTED.
   */
  async adjustInvoice(
    originalInvoiceId: string,
    newAmount: number,
    createdBy: string,
  ): Promise<{ originalInvoice: Invoice; adjustmentInvoice: Invoice }> {
    const original = await this.prisma.invoice.findUnique({
      where: { id: originalInvoiceId },
    });

    if (!original) {
      throw new NotFoundException(`Invoice ${originalInvoiceId} not found`);
    }

    if (!original.sentToTaxAt) {
      throw new BadRequestException(
        `Invoice ${original.code} has not been sent to tax authority. Cancel it directly instead.`,
      );
    }

    if (original.status === 'CANCELLED' || original.status === 'ADJUSTED') {
      throw new BadRequestException(
        `Invoice ${original.code} is already ${original.status}. Cannot adjust.`,
      );
    }

    return this.prisma.executeInTransaction(async (tx) => {
      // Mark original as adjusted
      const originalInvoice = await tx.invoice.update({
        where: { id: originalInvoiceId },
        data: { status: 'ADJUSTED' },
      });

      // Create adjustment invoice
      const code = await this.generateCode(tx);
      const taxRate = original.taxRate.toNumber();
      const taxAmount = newAmount * taxRate;
      const totalAmount = newAmount + taxAmount;

      const adjustmentInvoice = await tx.invoice.create({
        data: {
          code,
          orderId: original.orderId,
          customerId: original.customerId,
          type: 'DIEU_CHINH' as InvoiceType,
          amount: new Prisma.Decimal(newAmount),
          taxRate: original.taxRate,
          taxAmount: new Prisma.Decimal(taxAmount),
          totalAmount: new Prisma.Decimal(totalAmount),
          status: 'DRAFT',
          createdBy,
        },
      });

      this.eventEmitter.emit('invoice.adjusted', {
        originalInvoiceId: original.id,
        adjustmentInvoiceId: adjustmentInvoice.id,
        adjustmentCode: adjustmentInvoice.code,
      });

      this.logger.log(
        `Invoice adjusted: ${original.code} -> ${adjustmentInvoice.code}`,
      );

      return { originalInvoice, adjustmentInvoice };
    });
  }

  /**
   * List invoices with pagination and filters.
   */
  async findAll(query: InvoiceQueryDto) {
    const where: Prisma.InvoiceWhereInput = {};

    if (query.status) {
      where.status = query.status as InvoiceStatus;
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.orderId) {
      where.orderId = query.orderId;
    }

    if (query.search) {
      where.code = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: query.orderBy,
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return PaginatedResponse.paginate(data, total, query.page, query.limit);
  }

  /**
   * Get a single invoice by ID.
   */
  async findById(id: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    return invoice;
  }
}
