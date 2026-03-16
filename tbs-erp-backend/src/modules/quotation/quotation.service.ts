import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { QuotationStatus, OrderStatus, QuoteMode, ServiceType, Currency, Prisma, Branch } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { buildDateFilter } from '@common/utils/date.util';
import { generateCode } from '@common/utils/code-generator.util';
import { ContractService } from '@modules/contract/contract.service';
import { RateCardService } from '@modules/rate-card/rate-card.service';
import { ExchangeRateService } from '@modules/exchange-rate/exchange-rate.service';
import { QuotationStatusMachine } from './domain/quotation-status.machine';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationQueryDto } from './dto/quotation-query.dto';
import {
  CreateTemplateDto,
  SaveAsTemplateDto,
  CreateFromTemplateDto,
} from './dto/quotation-template.dto';
import { QuickQuoteDto } from './dto/quick-quote.dto';

const TAX_RATE = 0.1; // 10% VAT

@Injectable()
export class QuotationService {
  private readonly logger = new Logger(QuotationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly contractService: ContractService,
    private readonly statusMachine: QuotationStatusMachine,
    private readonly rateCardService: RateCardService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  /**
   * Generates the next quotation code in the format QUO-YYYYMM-XXXX.
   */
  private async generateQuotationCode(): Promise<string> {
    return generateCode(this.prisma.quotation, {
      prefix: 'QUO',
      datePrefixFormat: 'YYYYMM',
      sequenceLength: 4,
    });
  }

  /**
   * Creates a new quotation with items, calculates totals, applies discount rules.
   *
   * - Auto-generates code (QUO-YYYYMM-XXXX)
   * - Calculates: subtotal, discount amount, tax (10%), total
   * - If discount > 0, sets status to PENDING_APPROVAL
   * - Emits 'quotation.created' event
   */
  async createQuotation(userId: string, dto: CreateQuotationDto) {
    // Validate customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      select: {
        id: true,
        code: true,
        fullName: true,
        isActive: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${dto.customerId} not found`);
    }

    if (!customer.isActive) {
      throw new BadRequestException(`Customer ${customer.code} is inactive`);
    }

    // Calculate totals
    const subtotal = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const discountPercent = dto.discountPercent ?? 0;
    const discountAmount = subtotal * (discountPercent / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * TAX_RATE;
    const totalAmount = afterDiscount + taxAmount;

    // Determine initial status
    const status = discountPercent > 0 ? QuotationStatus.PENDING_APPROVAL : QuotationStatus.DRAFT;

    // Generate code
    const code = await this.generateQuotationCode();

    // Calculate validity
    const validityDays = dto.validityDays ?? 30;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validityDays);

    // Prepare items
    const items = dto.items.map((item) => ({
      productName: item.productName,
      productUrl: item.productUrl,
      quantity: item.quantity,
      unitPrice: new Decimal(item.unitPrice),
      currency: item.currency ?? 'CNY',
      totalPrice: new Decimal(item.quantity * item.unitPrice),
      note: item.note,
    }));

    // Create the quotation with items
    const quotation = await this.prisma.quotation.create({
      data: {
        code,
        customerId: dto.customerId,
        createdBy: userId,
        serviceType: dto.serviceType,
        branch: dto.branch,
        shippingRoute: dto.shippingRoute,
        status,
        version: 1,
        subtotal: new Decimal(subtotal),
        discountPercent: new Decimal(discountPercent),
        discountAmount: new Decimal(discountAmount),
        taxRate: new Decimal(TAX_RATE),
        taxAmount: new Decimal(taxAmount),
        totalAmount: new Decimal(totalAmount),
        validUntil,
        note: dto.note,
        items: {
          create: items,
        },
      },
      include: {
        items: true,
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            phone: true,
          },
        },
      },
    });

    // Emit event
    this.eventEmitter.emit('quotation.created', {
      quotationId: quotation.id,
      code: quotation.code,
      customerId: dto.customerId,
      totalAmount,
      status,
      discountPercent,
      createdBy: userId,
    });

    this.logger.log(`Quotation ${code} created for customer ${customer.code} by user ${userId}`);

    return quotation;
  }

  /**
   * Updates an existing quotation.
   * Only allowed when the quotation is in DRAFT or REJECTED status.
   */
  async updateQuotation(id: string, dto: UpdateQuotationDto) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }

    // Only DRAFT and REJECTED can transition (i.e. are editable)
    if (
      this.statusMachine.isTerminal(quotation.status) ||
      (quotation.status !== QuotationStatus.DRAFT && quotation.status !== QuotationStatus.REJECTED)
    ) {
      throw new BadRequestException(
        `Quotation in status ${quotation.status} cannot be edited. ` +
          `Edits are only allowed in: DRAFT, REJECTED`,
      );
    }

    const updateData: Prisma.QuotationUpdateInput = {};

    if (dto.serviceType !== undefined) {
      updateData.serviceType = dto.serviceType;
    }

    if (dto.branch !== undefined) {
      updateData.branch = dto.branch;
    }

    if (dto.shippingRoute !== undefined) {
      updateData.shippingRoute = dto.shippingRoute;
    }

    if (dto.note !== undefined) {
      updateData.note = dto.note;
    }

    if (dto.validityDays !== undefined) {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + dto.validityDays);
      updateData.validUntil = validUntil;
    }

    // If items are provided, replace all items and recalculate totals
    if (dto.items && dto.items.length > 0) {
      // Layer 2A: Soft delete existing items instead of hard delete
      await this.prisma.quotationItem.updateMany({
        where: { quotationId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      const newItems = dto.items.map((item) => ({
        quotationId: id,
        productName: item.productName,
        productUrl: item.productUrl,
        quantity: item.quantity,
        unitPrice: new Decimal(item.unitPrice),
        currency: item.currency ?? 'CNY',
        totalPrice: new Decimal(item.quantity * item.unitPrice),
        note: item.note,
      }));

      await this.prisma.quotationItem.createMany({ data: newItems });

      // Recalculate totals
      const subtotal = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

      const discountPercent = dto.discountPercent ?? Number(quotation.discountPercent);
      const discountAmount = subtotal * (discountPercent / 100);
      const afterDiscount = subtotal - discountAmount;
      const taxAmount = afterDiscount * TAX_RATE;
      const totalAmount = afterDiscount + taxAmount;

      updateData.subtotal = new Decimal(subtotal);
      updateData.discountPercent = new Decimal(discountPercent);
      updateData.discountAmount = new Decimal(discountAmount);
      updateData.taxAmount = new Decimal(taxAmount);
      updateData.totalAmount = new Decimal(totalAmount);

      // If discount changed, determine status
      if (discountPercent > 0) {
        updateData.status = QuotationStatus.PENDING_APPROVAL;
      } else {
        updateData.status = QuotationStatus.DRAFT;
      }
    } else if (dto.discountPercent !== undefined) {
      // Recalculate with existing items but new discount
      const subtotal = Number(quotation.subtotal);
      const discountAmount = subtotal * (dto.discountPercent / 100);
      const afterDiscount = subtotal - discountAmount;
      const taxAmount = afterDiscount * TAX_RATE;
      const totalAmount = afterDiscount + taxAmount;

      updateData.discountPercent = new Decimal(dto.discountPercent);
      updateData.discountAmount = new Decimal(discountAmount);
      updateData.taxAmount = new Decimal(taxAmount);
      updateData.totalAmount = new Decimal(totalAmount);

      if (dto.discountPercent > 0) {
        updateData.status = QuotationStatus.PENDING_APPROVAL;
      } else {
        updateData.status = QuotationStatus.DRAFT;
      }
    }

    // Increment version
    updateData.version = quotation.version + 1;

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: updateData,
      include: {
        items: true,
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            phone: true,
          },
        },
      },
    });

    this.logger.log(`Quotation ${quotation.code} updated to version ${updated.version}`);

    return updated;
  }

  /**
   * Lists quotations with pagination and filters.
   */
  async findAll(query: QuotationQueryDto) {
    const where: Prisma.QuotationWhereInput = {};

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
        {
          customer: {
            companyName: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    const dateFilter = buildDateFilter(query.startDate, query.endDate);
    if (dateFilter) {
      where.createdAt = dateFilter;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.quotation.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy as Prisma.QuotationOrderByWithRelationInput,
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              fullName: true,
              companyName: true,
              phone: true,
            },
          },
          items: { where: { deletedAt: null } },
          _count: { select: { items: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.quotation.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets a single quotation by ID with full details.
   */
  async findById(id: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            tier: true,
            phone: true,
            email: true,
          },
        },
        items: { where: { deletedAt: null } },
        contracts: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            type: true,
          },
        },
      },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }

    return quotation;
  }

  /**
   * Approves a quotation. Changes status to APPROVED.
   */
  async approveQuotation(id: string, userId: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }

    this.statusMachine.assertTransition(quotation.status, QuotationStatus.APPROVED);

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: {
        status: QuotationStatus.APPROVED,
        approvedBy: userId,
        approvedAt: new Date(),
      },
      include: {
        items: true,
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            phone: true,
          },
        },
      },
    });

    this.eventEmitter.emit('quotation.approved', {
      quotationId: id,
      code: quotation.code,
      approvedBy: userId,
    });

    this.logger.log(`Quotation ${quotation.code} approved by user ${userId}`);

    // Auto-create contract appendix from the approved quotation
    let contractAppendix: { id: string; code: string } | null = null;
    try {
      contractAppendix = await this.contractService.createContractFromQuotation(id, userId);
      this.logger.log(
        `Contract appendix ${contractAppendix.code} auto-created from quotation ${quotation.code}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to auto-create contract appendix from quotation ${quotation.code}: ${err.message}`,
      );
    }

    return {
      ...updated,
      contractAppendixId: contractAppendix?.id ?? null,
      contractAppendixCode: contractAppendix?.code ?? null,
    };
  }

  /**
   * Rejects a quotation with a reason. Changes status to REJECTED.
   */
  async rejectQuotation(id: string, userId: string, reason: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }

    this.statusMachine.assertTransition(quotation.status, QuotationStatus.REJECTED);

    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('Rejection reason must be at least 5 characters');
    }

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: {
        status: QuotationStatus.REJECTED,
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
      include: {
        items: true,
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            phone: true,
          },
        },
      },
    });

    this.eventEmitter.emit('quotation.rejected', {
      quotationId: id,
      code: quotation.code,
      rejectedBy: userId,
      reason,
    });

    this.logger.log(`Quotation ${quotation.code} rejected by user ${userId}: ${reason}`);

    return updated;
  }

  /**
   * Converts an approved quotation to an order.
   * Creates an order from the quotation data and links it via convertedOrderId.
   */
  async convertToOrder(id: string, userId: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: { items: true, customer: true },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }

    this.statusMachine.assertTransition(quotation.status, QuotationStatus.CONVERTED);

    // Generate order code using shared utility
    const orderCode = await generateCode(this.prisma.order, {
      prefix: 'TBS-ORD',
      datePrefixFormat: 'YYMMDD',
      sequenceLength: 4,
    });

    // Create order from quotation data
    const orderItems = quotation.items.map((item) => ({
      productName: item.productName,
      productUrl: item.productUrl,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      currency: item.currency as any,
      totalPrice: item.totalPrice,
      note: item.note,
    }));

    const order = await this.prisma.executeInTransaction(async (tx) => {
      // Create the order
      const newOrder = await tx.order.create({
        data: {
          code: orderCode,
          customerId: quotation.customerId,
          saleId: userId,
          serviceType: quotation.serviceType,
          branch: quotation.branch,
          shippingRoute: quotation.shippingRoute,
          status: OrderStatus.CONSULTING,
          totalAmount: quotation.totalAmount,
          discountPercent: quotation.discountPercent,
          discountAmount: quotation.discountAmount,
          note: quotation.note
            ? `${quotation.note}\n---\nTạo từ báo giá ${quotation.code}`
            : `Tạo từ báo giá ${quotation.code}`,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: true,
          customer: {
            select: {
              id: true,
              code: true,
              fullName: true,
              companyName: true,
              tier: true,
              phone: true,
            },
          },
        },
      });

      // Create initial status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: newOrder.id,
          fromStatus: null,
          toStatus: OrderStatus.CONSULTING,
          changedBy: userId,
          note: `Order created from quotation ${quotation.code}`,
        },
      });

      // Mark quotation as converted
      await tx.quotation.update({
        where: { id },
        data: {
          status: QuotationStatus.CONVERTED,
          convertedOrderId: newOrder.id,
        },
      });

      return newOrder;
    });

    this.eventEmitter.emit('quotation.converted', {
      quotationId: id,
      quotationCode: quotation.code,
      orderId: order.id,
      orderCode: order.code,
      convertedBy: userId,
    });

    this.logger.log(
      `Quotation ${quotation.code} converted to order ${order.code} by user ${userId}`,
    );

    return { quotation: { id, code: quotation.code }, order };
  }

  /**
   * Duplicates an existing quotation as a new DRAFT.
   * Clones all items and resets status/version.
   */
  async duplicateQuotation(id: string, userId: string) {
    const original = await this.prisma.quotation.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!original) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }

    const code = await this.generateQuotationCode();

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const items = original.items.map((item) => ({
      productName: item.productName,
      productUrl: item.productUrl,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      currency: item.currency,
      totalPrice: item.totalPrice,
      note: item.note,
    }));

    // Recalculate without discount
    const subtotal = Number(original.subtotal);
    const taxAmount = subtotal * TAX_RATE;
    const totalAmount = subtotal + taxAmount;

    const duplicated = await this.prisma.quotation.create({
      data: {
        code,
        customerId: original.customerId,
        createdBy: userId,
        serviceType: original.serviceType,
        branch: original.branch,
        shippingRoute: original.shippingRoute,
        status: QuotationStatus.DRAFT,
        version: 1,
        parentQuotationId: original.id,
        subtotal: original.subtotal,
        discountPercent: new Decimal(0),
        discountAmount: new Decimal(0),
        taxRate: original.taxRate,
        taxAmount: new Decimal(taxAmount),
        totalAmount: new Decimal(totalAmount),
        validUntil,
        note: `Duplicated from ${original.code}`,
        items: {
          create: items,
        },
      },
      include: {
        items: true,
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            phone: true,
          },
        },
      },
    });

    this.logger.log(`Quotation ${original.code} duplicated as ${code} by user ${userId}`);

    return duplicated;
  }

  /**
   * Gets version history for a quotation chain.
   * Follows the parentQuotationId chain to find all versions.
   */
  async getVersionHistory(quotationId: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      select: { id: true, code: true, parentQuotationId: true },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${quotationId} not found`);
    }

    // Find all quotations in this chain by matching parentQuotationId
    const allVersions = await this.prisma.quotation.findMany({
      where: {
        OR: [
          { id: quotationId },
          { parentQuotationId: quotationId },
          ...(quotation.parentQuotationId
            ? [
                { id: quotation.parentQuotationId },
                { parentQuotationId: quotation.parentQuotationId },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        code: true,
        version: true,
        status: true,
        totalAmount: true,
        discountPercent: true,
        createdBy: true,
        createdAt: true,
        parentQuotationId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return allVersions;
  }

  // =========================================================================
  // TEMPLATES
  // =========================================================================

  async createTemplate(userId: string, dto: CreateTemplateDto) {
    const template = await this.prisma.quotationTemplate.create({
      data: {
        name: dto.name,
        description: dto.description,
        serviceType: dto.serviceType,
        branch: dto.branch,
        shippingRoute: dto.shippingRoute,
        items: dto.items as any,
        isPublic: dto.isPublic ?? false,
        createdBy: userId,
      },
    });

    this.logger.log(`Template "${dto.name}" created by user ${userId}`);
    return template;
  }

  async listTemplates(userId: string) {
    const templates = await this.prisma.quotationTemplate.findMany({
      where: {
        OR: [{ createdBy: userId }, { isPublic: true }],
      },
      orderBy: { usageCount: 'desc' },
    });
    return templates;
  }

  async deleteTemplate(id: string, userId: string) {
    const template = await this.prisma.quotationTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    if (template.createdBy !== userId) {
      throw new ForbiddenException('Only the template owner can delete it');
    }

    await this.prisma.quotationTemplate.delete({ where: { id } });
    this.logger.log(`Template "${template.name}" deleted by user ${userId}`);
  }

  async saveAsTemplate(quotationId: string, userId: string, dto: SaveAsTemplateDto) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { items: true },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${quotationId} not found`);
    }

    const items = quotation.items.map((item) => ({
      productName: item.productName,
      productUrl: item.productUrl,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      currency: item.currency,
      note: item.note,
    }));

    const template = await this.prisma.quotationTemplate.create({
      data: {
        name: dto.name,
        description: dto.description,
        serviceType: quotation.serviceType,
        branch: quotation.branch,
        shippingRoute: quotation.shippingRoute,
        items: items as any,
        isPublic: dto.isPublic ?? false,
        createdBy: userId,
      },
    });

    this.logger.log(
      `Quotation ${quotation.code} saved as template "${dto.name}" by user ${userId}`,
    );
    return template;
  }

  async createFromTemplate(templateId: string, userId: string, dto: CreateFromTemplateDto) {
    const template = await this.prisma.quotationTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${templateId} not found`);
    }

    // Increment usage count
    await this.prisma.quotationTemplate.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } },
    });

    const templateItems = template.items as any[];

    // Create quotation using the existing createQuotation method
    const createDto: CreateQuotationDto = {
      customerId: dto.customerId,
      serviceType: template.serviceType,
      branch: template.branch,
      shippingRoute: template.shippingRoute || undefined,
      discountPercent: dto.discountPercent,
      validityDays: dto.validityDays,
      note: dto.note || `T\u1EA1o t\u1EEB m\u1EABu: ${template.name}`,
      items: templateItems.map((item: any) => ({
        productName: item.productName,
        productUrl: item.productUrl,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        currency: item.currency,
        note: item.note,
      })),
    };

    return this.createQuotation(userId, createDto);
  }

  // =========================================================================
  // RECENT ITEMS FOR CUSTOMER
  // =========================================================================

  async getRecentItemsForCustomer(customerId: string) {
    const recentQuotations = await this.prisma.quotation.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        items: {
          select: {
            productName: true,
            productUrl: true,
            quantity: true,
            unitPrice: true,
            currency: true,
            note: true,
          },
        },
      },
    });

    // Flatten all items and dedupe by productName
    const seen = new Set<string>();
    const recentItems: any[] = [];

    for (const q of recentQuotations) {
      for (const item of q.items) {
        const key = item.productName.toLowerCase().trim();
        if (!seen.has(key) && recentItems.length < 20) {
          seen.add(key);
          recentItems.push({
            productName: item.productName,
            productUrl: item.productUrl,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            currency: item.currency,
            note: item.note,
          });
        }
      }
    }

    return recentItems;
  }

  // =========================================================================
  // KD-5: QUOTATION SUGGESTIONS FROM HISTORY
  // =========================================================================

  /**
   * Returns quotation suggestions based on a customer's order and quotation history.
   * Includes: common item types, common routes, and recent prices.
   */
  async getSuggestionsForCustomer(customerId: string) {
    // Fetch recent orders for this customer
    const recentOrders = await this.prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        code: true,
        serviceType: true,
        shippingRoute: true,
        totalAmount: true,
        createdAt: true,
        items: {
          select: {
            productName: true,
            unitPrice: true,
            quantity: true,
            currency: true,
          },
        },
      },
    });

    // Fetch recent quotations for this customer
    const recentQuotations = await this.prisma.quotation.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        code: true,
        serviceType: true,
        shippingRoute: true,
        totalAmount: true,
        createdAt: true,
        items: {
          where: { deletedAt: null },
          select: {
            productName: true,
            unitPrice: true,
            quantity: true,
            currency: true,
          },
        },
      },
    });

    // Compute common service types
    const serviceTypeCounts: Record<string, number> = {};
    for (const order of recentOrders) {
      serviceTypeCounts[order.serviceType] = (serviceTypeCounts[order.serviceType] || 0) + 1;
    }
    const commonServiceTypes = Object.entries(serviceTypeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type, count]) => ({ type, count }));

    // Compute common routes
    const routeCounts: Record<string, number> = {};
    for (const order of recentOrders) {
      if (order.shippingRoute) {
        routeCounts[order.shippingRoute] = (routeCounts[order.shippingRoute] || 0) + 1;
      }
    }
    const commonRoutes = Object.entries(routeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([route, count]) => ({ route, count }));

    // Collect recent product prices (deduplicated by product name)
    const productPriceMap = new Map<
      string,
      { productName: string; unitPrice: number; currency: string; lastUsed: Date }
    >();
    const allSources = [
      ...recentOrders.map((o) => ({ items: o.items, date: o.createdAt })),
      ...recentQuotations.map((q) => ({ items: q.items, date: q.createdAt })),
    ];

    for (const source of allSources) {
      for (const item of source.items) {
        const key = item.productName.toLowerCase().trim();
        if (!productPriceMap.has(key)) {
          productPriceMap.set(key, {
            productName: item.productName,
            unitPrice: Number(item.unitPrice),
            currency: item.currency,
            lastUsed: source.date,
          });
        }
      }
    }

    const recentPrices = Array.from(productPriceMap.values()).slice(0, 20);

    return {
      commonServiceTypes,
      commonRoutes,
      recentPrices,
      totalOrders: recentOrders.length,
      totalQuotations: recentQuotations.length,
    };
  }

  // =========================================================================
  // CRON: AUTO-EXPIRE QUOTATIONS
  // =========================================================================

  // =========================================================================
  // QUICK QUOTE — Báo giá nhanh (VCT & MHH mode)
  // =========================================================================

  /**
   * Tạo báo giá nhanh cho 2 mode: VCT (vận chuyển thuần) và MHH (mua hàng hộ).
   * - VCT: chỉ cần CBM/KG + tuyến -> tra Rate Card -> tổng cước
   * - MHH: items + giá NCC (CNY) -> quy đổi VND + phí dịch vụ + cước VC
   */
  async quickQuote(userId: string, dto: QuickQuoteDto) {
    // 1. Validate khách hàng
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      select: { id: true, code: true, fullName: true, tier: true, isActive: true },
    });
    if (!customer) throw new NotFoundException(`Khách hàng ${dto.customerId} không tìm thấy`);
    if (!customer.isActive) throw new BadRequestException(`Khách hàng ${customer.code} đang bị khóa`);

    const isMHH = dto.serviceType === ServiceType.MHH;
    const quoteMode = isMHH ? QuoteMode.MHH_QUICK : QuoteMode.VCT_QUICK;

    // 2. Tỷ giá CNY (chỉ cần cho MHH)
    let exchangeRate = 0;
    if (isMHH) {
      try {
        const rateRecord = await this.exchangeRateService.getCurrentRate(Currency.CNY, Currency.VND);
        exchangeRate = Number(rateRecord.rate);
      } catch {
        throw new BadRequestException('Chưa có tỷ giá CNY/VND. Kế toán vui lòng cập nhật tỷ giá.');
      }
    }

    // 3. Tính giá hàng MHH
    let totalProductAmountVND = 0;
    let totalProductAmountCNY = 0;
    let serviceFeePercent = 0;
    let serviceFeeAmount = 0;
    const itemsCalc: any[] = [];

    if (isMHH && dto.items?.length) {
      for (const item of dto.items) {
        const itemTotalCNY = item.unitPriceCNY * item.quantity + (item.domesticShippingCNY ?? 0) * item.quantity;
        const itemTotalVND = Math.round(itemTotalCNY * exchangeRate);
        totalProductAmountCNY += itemTotalCNY;
        totalProductAmountVND += itemTotalVND;
        itemsCalc.push({
          ...item,
          unitPriceVND: Math.round(item.unitPriceCNY * exchangeRate),
          totalPriceCNY: item.unitPriceCNY * item.quantity,
          totalPriceVND: Math.round(item.unitPriceCNY * item.quantity * exchangeRate),
          exchangeRateSnapshot: exchangeRate,
        });
      }

      // Phí dịch vụ MHH theo tier khách hàng
      const feeConfig = await this.prisma.serviceFeeConfig.findFirst({
        where: {
          serviceType: ServiceType.MHH,
          isActive: true,
          OR: [{ customerTier: customer.tier }, { customerTier: null }],
        },
        orderBy: [{ customerTier: 'desc' }, { priority: 'desc' }],
      });

      if (feeConfig) {
        serviceFeePercent = Number(feeConfig.feePercent);
        const rawFee = totalProductAmountVND * (serviceFeePercent / 100);
        const minFee = feeConfig.minFeeAmount ? Number(feeConfig.minFeeAmount) * exchangeRate : 0;
        const maxFee = feeConfig.maxFeeAmount ? Number(feeConfig.maxFeeAmount) * exchangeRate : Infinity;
        serviceFeeAmount = Math.round(Math.min(Math.max(rawFee, minFee), maxFee));
      }
    }

    // 4. Tra Rate Card -> tính cước VC
    let shippingAmount = 0;
    let surchargeAmount = 0;
    let rateCardId: string | undefined;
    let chargeableWeight = 0;
    let discountPercent = dto.discountOverride ?? 0;
    let surchargesDetail: any[] = [];

    const rateResult = await this.rateCardService.lookup({
      origin: dto.origin,
      destination: dto.destination,
      transportMode: dto.transportMode,
      serviceType: dto.serviceType,
      cbm: dto.cbm,
      kg: dto.kg,
      customerTier: customer.tier,
    });

    if (rateResult) {
      shippingAmount = rateResult.shippingAmount;
      surchargeAmount = rateResult.surchargeAmount;
      surchargesDetail = rateResult.surcharges;
      rateCardId = rateResult.rateCard.id;
      chargeableWeight = rateResult.chargeableWeight;
      // Dùng discount từ rate card nếu sale không override
      if (dto.discountOverride === undefined) {
        discountPercent = rateResult.discountPercent;
      }
    }

    // 5. Tổng hợp
    const baseAmount = totalProductAmountVND + serviceFeeAmount + shippingAmount + surchargeAmount;
    const discountAmount = Math.round(baseAmount * (discountPercent / 100));
    const totalAmount = baseAmount - discountAmount;

    // Cọc yêu cầu theo tier
    const depositRates: Record<string, number> = { NEW: 1.0, REGULAR: 0.7, VIP: 0.5, STRATEGIC: 0.3 };
    const depositRate = depositRates[customer.tier] ?? 0.7;
    const depositRequired = isMHH ? Math.round(totalAmount * depositRate) : 0;

    // Hiệu lực: MHH 7 ngày, VCT 30 ngày
    const validityDays = isMHH ? 7 : 30;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validityDays);

    // 6. Tạo Quotation trong DB
    const code = await this.generateQuotationCode();

    const quotation = await this.prisma.quotation.create({
      data: {
        code,
        customerId: dto.customerId,
        createdBy: userId,
        serviceType: dto.serviceType,
        branch: dto.branch ?? Branch.HN,
        quoteMode,
        rateCardId: rateCardId ?? null,
        status: QuotationStatus.DRAFT,
        validUntil,
        cbm: dto.cbm ? new Decimal(dto.cbm) : null,
        kg: dto.kg ? new Decimal(dto.kg) : null,
        chargeableWeight: chargeableWeight ? new Decimal(chargeableWeight) : null,
        exchangeRateSnapshot: isMHH ? new Decimal(exchangeRate) : null,
        totalProductAmount: totalProductAmountVND ? new Decimal(totalProductAmountVND) : null,
        serviceFeePercent: serviceFeePercent ? new Decimal(serviceFeePercent) : null,
        serviceFeeAmount: serviceFeeAmount ? new Decimal(serviceFeeAmount) : null,
        shippingAmount: new Decimal(shippingAmount),
        surchargeAmount: new Decimal(surchargeAmount),
        subtotal: new Decimal(baseAmount),
        discountPercent: new Decimal(discountPercent),
        discountAmount: new Decimal(discountAmount),
        taxRate: new Decimal(0),
        taxAmount: new Decimal(0),
        totalAmount: new Decimal(totalAmount),
        note: dto.notes,
        pricingSnapshot: {
          computedAt: new Date().toISOString(),
          exchangeRate,
          totalProductAmountCNY,
          totalProductAmountVND,
          serviceFeePercent,
          serviceFeeAmount,
          shippingAmount,
          surcharges: surchargesDetail,
          surchargeAmount,
          discountPercent,
          discountAmount,
          totalAmount,
          depositRate,
          depositRequired,
          cbm: dto.cbm,
          kg: dto.kg,
          chargeableWeight,
          rateCardId,
        },
        items: isMHH && itemsCalc.length ? {
          create: itemsCalc.map((item, idx) => ({
            sortOrder: idx,
            productName: item.productName,
            productDescription: item.productDescription,
            productImageUrl: item.productImageUrl,
            sourceUrl: item.sourceUrl,
            vendorId: item.vendorId,
            vendorName: item.vendorName,
            quantity: item.quantity,
            unit: item.unit ?? 'cái',
            unitPriceCNY: new Decimal(item.unitPriceCNY),
            totalPriceCNY: new Decimal(item.totalPriceCNY),
            domesticShippingCNY: item.domesticShippingCNY ? new Decimal(item.domesticShippingCNY) : null,
            exchangeRateSnapshot: new Decimal(exchangeRate),
            unitPriceVND: new Decimal(item.unitPriceVND),
            totalPriceVND: new Decimal(item.totalPriceVND),
            unitPrice: new Decimal(item.unitPriceVND),
            totalPrice: new Decimal(item.totalPriceVND),
            currency: Currency.CNY,
            note: item.note,
          })),
        } : undefined,
      },
      include: {
        customer: { select: { id: true, code: true, fullName: true, tier: true } },
        items: true,
        rateCard: { select: { id: true, code: true, name: true } },
      },
    });

    // 7. Tạo text summary
    const textSummary = this.buildTextSummary(quotation, {
      isMHH, exchangeRate, totalProductAmountVND, totalProductAmountCNY,
      serviceFeePercent, serviceFeeAmount, shippingAmount, surchargeAmount,
      surchargesDetail, discountPercent, discountAmount, totalAmount,
      depositRequired, validityDays, customer,
    });

    this.eventEmitter.emit('quotation.created', { quotationId: quotation.id, mode: quoteMode });

    return {
      quotation,
      pricing: {
        exchangeRate,
        totalProductAmountCNY,
        totalProductAmountVND,
        serviceFeePercent,
        serviceFeeAmount,
        shippingAmount,
        surchargeAmount,
        discountPercent,
        discountAmount,
        totalAmount,
        depositRate,
        depositRequired,
        validityDays,
      },
      textSummary,
    };
  }

  private buildTextSummary(quotation: any, calc: any): string {
    const { isMHH, exchangeRate, totalProductAmountVND, totalProductAmountCNY,
      serviceFeePercent, serviceFeeAmount, shippingAmount, surchargeAmount,
      discountPercent, discountAmount, totalAmount, depositRequired,
      validityDays, customer } = calc;

    const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
    const lines: string[] = [];

    if (isMHH) {
      lines.push(`--- BÁO GIÁ MUA HÀNG HỘ - TBS GROUP ---`);
      lines.push(`Khách hàng: ${customer.fullName} (${customer.tier})`);
      lines.push(`Tuyến: ${quotation.rateCard?.name ?? 'Theo yêu cầu'}`);
      lines.push(``);
      lines.push(`SẢN PHẨM:`);
      quotation.items?.forEach((item: any, i: number) => {
        const unitVND = Math.round(Number(item.unitPriceCNY) * exchangeRate);
        lines.push(`${i + 1}. ${item.productName} x ${item.quantity} ${item.unit}`);
        lines.push(`   Đơn giá: ${item.unitPriceCNY} CNY (~${fmt(unitVND)} VND) | Thành tiền: ${fmt(Number(item.totalPriceVND))} VND`);
      });
      lines.push(``);
      lines.push(`Tổng giá hàng:         ${fmt(totalProductAmountVND)} VND`);
      lines.push(`Phí dịch vụ MHH (${serviceFeePercent}%): ${fmt(serviceFeeAmount)} VND`);
    } else {
      lines.push(`--- BÁO GIÁ VẬN CHUYỂN - TBS GROUP ---`);
      lines.push(`Khách hàng: ${customer.fullName}`);
      lines.push(``);
    }

    lines.push(`Cước vận chuyển:       ${fmt(shippingAmount)} VND`);
    if (surchargeAmount > 0) {
      lines.push(`Phụ phí:               ${fmt(surchargeAmount)} VND`);
    }
    if (discountPercent > 0) {
      lines.push(`Chiết khấu (${discountPercent}%):    -${fmt(discountAmount)} VND`);
    }
    lines.push(`================================`);
    lines.push(`TỔNG:                  ${fmt(totalAmount)} VND`);
    if (depositRequired > 0) {
      lines.push(`Cọc yêu cầu:           ${fmt(depositRequired)} VND`);
    }
    if (isMHH && exchangeRate > 0) {
      lines.push(``);
      lines.push(`Tỷ giá áp dụng: 1 CNY = ${fmt(exchangeRate)} VND`);
    }
    lines.push(`Hiệu lực: ${validityDays} ngày`);
    lines.push(`---`);

    return lines.join('\n');
  }

  @Cron('0 9 * * *')
  async handleExpiredQuotations() {
    const now = new Date();
    const expirableStatuses: QuotationStatus[] = [
      QuotationStatus.DRAFT,
      QuotationStatus.APPROVED,
      QuotationStatus.PENDING_APPROVAL,
    ];

    const expired = await this.prisma.quotation.updateMany({
      where: {
        validUntil: { lt: now },
        status: { in: expirableStatuses },
      },
      data: {
        status: QuotationStatus.EXPIRED,
      },
    });

    if (expired.count > 0) {
      this.logger.log(`Auto-expired ${expired.count} quotation(s) past their validity date`);
      this.eventEmitter.emit('quotation.expired', {
        count: expired.count,
        expiredAt: now,
      });
    }
  }
}
