import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { PurchaseStatus, Currency } from '@prisma/client';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { PurchaseQueryDto } from './dto/purchase-query.dto';
import { RecordReceiptDto } from './dto/record-receipt.dto';

/** Threshold above which additional approval is required (50M VND). */
const HIGH_VALUE_THRESHOLD = 50_000_000;

@Injectable()
export class PurchaseService {
  private readonly logger = new Logger(PurchaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a purchase request with items.
   * Auto-generates code PR-YYYYMM-XXXX.
   */
  async createPurchaseRequest(userId: string, dto: CreatePurchaseRequestDto) {
    // ORDER-CENTRIC: Validate order exists when orderId is provided
    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        select: { id: true },
      });
      if (!order) {
        throw new NotFoundException(`Order ${dto.orderId} not found`);
      }
    }

    const totalAmount = dto.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);

    const code = await this.generateCode('PR');

    const pr = await this.prisma.purchaseRequest.create({
      data: {
        code,
        vendorId: dto.vendorId,
        orderId: dto.orderId,
        status: PurchaseStatus.DRAFT,
        totalAmount,
        currency: dto.items[0]?.currency ?? Currency.VND,
        notes: dto.notes,
        createdBy: userId,
        items: {
          create: dto.items.map((item) => ({
            description: item.description,
            quantity: item.qty,
            unit: item.unit,
            unitPrice: item.unitPrice,
            amount: item.qty * item.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    this.logger.log(`Purchase request ${code} created by ${userId}`);

    return pr;
  }

  /**
   * Approves a purchase request.
   * For amounts > 50M VND, checks if additional approval level is needed.
   */
  async approvePR(id: string, userId: string) {
    const pr = await this.prisma.purchaseRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!pr) {
      throw new NotFoundException(`Purchase request ${id} not found`);
    }

    if (pr.status !== PurchaseStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot approve a PR in status ${pr.status}. Must be SUBMITTED.`,
      );
    }

    // High-value check
    if (Number(pr.totalAmount) > HIGH_VALUE_THRESHOLD && !pr.approvedBy) {
      this.logger.log(
        `PR ${pr.code} exceeds ${HIGH_VALUE_THRESHOLD} VND — flagged for additional approval`,
      );
    }

    const updated = await this.prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: PurchaseStatus.APPROVED,
        approvedBy: userId,
        approvedAt: new Date(),
      },
      include: { items: true },
    });

    this.eventEmitter.emit('purchase.request.approved', {
      prId: id,
      code: pr.code,
      approvedBy: userId,
      totalAmount: pr.totalAmount,
    });

    this.logger.log(`PR ${pr.code} approved by ${userId}`);

    return updated;
  }

  /**
   * Converts an approved PR into a Purchase Order.
   */
  async convertToPO(prId: string) {
    const pr = await this.prisma.purchaseRequest.findUnique({
      where: { id: prId },
      include: { items: true },
    });

    if (!pr) {
      throw new NotFoundException(`Purchase request ${prId} not found`);
    }

    if (pr.status !== PurchaseStatus.APPROVED) {
      throw new BadRequestException(
        `Can only convert APPROVED PRs to POs. Current status: ${pr.status}`,
      );
    }

    if (!pr.vendorId) {
      throw new BadRequestException(
        'Cannot convert PR to PO without a vendor. Please assign a vendor first.',
      );
    }

    const poCode = await this.generateCode('PO');

    const po = await this.prisma.executeInTransaction(async (tx) => {
      const newPO = await tx.purchaseOrder.create({
        data: {
          code: poCode,
          prId: pr.id,
          vendorId: pr.vendorId!,
          orderId: pr.orderId,
          status: PurchaseStatus.ORDERED,
          totalAmount: pr.totalAmount,
          currency: pr.currency,
          notes: pr.notes,
          createdBy: pr.createdBy,
        },
      });

      await tx.purchaseRequest.update({
        where: { id: prId },
        data: { status: PurchaseStatus.ORDERED },
      });

      return newPO;
    });

    this.logger.log(`PR ${pr.code} converted to PO ${poCode}`);

    return po;
  }

  /**
   * Creates a purchase order directly.
   */
  async createPurchaseOrder(dto: CreatePurchaseOrderDto, userId: string) {
    const code = await this.generateCode('PO');

    const po = await this.prisma.purchaseOrder.create({
      data: {
        code,
        vendorId: dto.vendorId,
        orderId: dto.orderId,
        status: PurchaseStatus.DRAFT,
        currency: dto.currency ?? Currency.CNY,
        notes: dto.notes,
        createdBy: userId,
      },
    });

    this.logger.log(`Purchase order ${code} created by ${userId}`);

    return po;
  }

  /**
   * Records goods receipt against a purchase order.
   */
  async recordReceipt(poId: string, dto: RecordReceiptDto, userId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
    });

    if (!po) {
      throw new NotFoundException(`Purchase order ${poId} not found`);
    }

    if (po.status !== PurchaseStatus.ORDERED && po.status !== PurchaseStatus.APPROVED) {
      throw new BadRequestException(`Cannot record receipt for PO in status ${po.status}.`);
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: PurchaseStatus.RECEIVED,
        notes: dto.notes ? `${po.notes ?? ''}\nReceipt: ${dto.notes}` : po.notes,
      },
    });

    this.eventEmitter.emit('purchase.order.received', {
      poId,
      code: po.code,
      vendorId: po.vendorId,
      receivedBy: userId,
    });

    this.logger.log(`Goods received for PO ${po.code} by ${userId}`);

    return updated;
  }

  /**
   * Lists purchase requests with pagination and filters.
   */
  async findAll(query: PurchaseQueryDto) {
    const where: any = {};

    if (query.status) where.status = query.status;
    if (query.vendorId) where.vendorId = query.vendorId;

    if (query.search) {
      where.code = { contains: query.search, mode: 'insensitive' };
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

    const [data, total] = await this.prisma.$transaction([
      this.prisma.purchaseRequest.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy,
        include: { items: true },
      }),
      this.prisma.purchaseRequest.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets purchase history for a specific vendor.
   */
  async getVendorPurchases(vendorId: string) {
    const [requests, orders] = await this.prisma.$transaction([
      this.prisma.purchaseRequest.findMany({
        where: { vendorId },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { vendorId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { requests, orders };
  }

  /**
   * Generates the next code in the format PREFIX-YYYYMM-XXXX.
   */
  private async generateCode(prefix: 'PR' | 'PO'): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const codePrefix = `${prefix}-${yearMonth}`;

    const model = prefix === 'PR' ? this.prisma.purchaseRequest : this.prisma.purchaseOrder;

    const latest = await (model as any).findFirst({
      where: { code: { startsWith: codePrefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latest) {
      const lastSeq = parseInt(latest.code.split('-').pop() || '0', 10);
      sequence = lastSeq + 1;
    }

    return `${codePrefix}-${String(sequence).padStart(4, '0')}`;
  }
}
