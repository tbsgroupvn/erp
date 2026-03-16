import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { Prisma, Order, OrderStatus, OrderItem } from '@prisma/client';
import { DataScopeFilter } from '@common/guards/data-scope.guard';
import { generateCode } from '@common/utils/code-generator.util';

export interface OrderWithRelations extends Order {
  customer: {
    id: string;
    code: string;
    fullName: string;
    companyName: string | null;
    tier: string;
    phone: string;
  };
  masterOrder?: {
    id: string;
    code: string;
    overallStatus: string;
  } | null;
  items: OrderItem[];
  statusHistory: Array<{
    id: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    changedBy: string;
    note: string | null;
    createdAt: Date;
  }>;
  packages: Array<{
    id: string;
    code: string;
    actualWeight: unknown;
    chargeableWeight: unknown;
    warehouseCNStatus: string | null;
    warehouseVNStatus: string | null;
  }>;
  paymentVouchers?: Array<{
    id: string;
    code: string;
    type: string;
    amount: unknown;
    status: string;
  }>;
  complaints?: Array<{
    id: string;
    code: string;
    type: string;
    severity: string;
    status: string;
    createdAt: Date;
  }>;
  deliveries?: Array<{
    id: string;
    code: string;
    status: string;
    recipientName: string;
    createdAt: Date;
  }>;
  qcInspections?: Array<{
    id: string;
    code: string;
    status: string;
    passedQuantity: number | null;
    failedQuantity: number | null;
    createdAt: Date;
  }>;
  supplierOrders?: Array<{
    id: string;
    code: string;
    status: string;
    supplierName: string;
    quotedPriceCNY: unknown;
    actualPriceCNY: unknown;
    createdAt: Date;
  }>;
  mhhIssues?: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: Date;
  }>;
  costAllocations?: Array<{
    id: string;
    costType: string;
    allocatedAmount: unknown;
    method: string;
  }>;
  extraCharges?: Array<{
    id: string;
    chargeType: string;
    amount: unknown;
    status: string;
  }>;
}

@Injectable()
export class OrderRepository {
  private readonly logger = new Logger(OrderRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Creates a new order with its items in a single transaction.
   * Includes retry logic for unique constraint violations on code generation.
   */
  async create(
    data: Prisma.OrderCreateInput,
    items: Prisma.OrderItemCreateWithoutOrderInput[],
  ): Promise<Order> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // Re-generate code on retry to avoid duplicate
        const orderData = attempt > 0 ? { ...data, code: await this.generateOrderCode() } : data;

        return await this.prisma.order.create({
          data: {
            ...orderData,
            items: {
              create: items,
            },
          },
          include: {
            items: { where: { deletedAt: null } },
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
      } catch (error) {
        if (error.code === 'P2002' && attempt < 2) {
          this.logger.warn(`Order code conflict on attempt ${attempt + 1}, retrying...`);
          continue;
        }
        throw error;
      }
    }
    // Unreachable, but TypeScript needs it
    throw new Error('Failed to create order after 3 attempts');
  }

  /**
   * Find all orders with pagination, filters, and data scope.
   */
  async findAll(
    where: Prisma.OrderWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.OrderOrderByWithRelationInput,
    dataScope?: DataScopeFilter,
  ): Promise<{ data: Order[]; total: number }> {
    const scopedWhere = this.applyDataScope(where, dataScope);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: scopedWhere,
        skip,
        take,
        orderBy,
        include: {
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
          masterOrder: {
            select: {
              id: true,
              code: true,
              overallStatus: true,
            },
          },
          items: {
            where: { deletedAt: null },
            select: {
              id: true,
              productName: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
            },
          },
          _count: {
            select: { packages: true },
          },
        },
      }),
      this.prisma.order.count({ where: scopedWhere }),
    ]);

    return { data, total };
  }

  /**
   * Find a single order by ID with full relations.
   */
  async findById(id: string): Promise<OrderWithRelations | null> {
    return this.prisma.order.findUnique({
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
          },
        },
        masterOrder: {
          select: {
            id: true,
            code: true,
            overallStatus: true,
          },
        },
        items: { where: { deletedAt: null } },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        packages: {
          select: {
            id: true,
            code: true,
            actualWeight: true,
            chargeableWeight: true,
            warehouseCNStatus: true,
            warehouseVNStatus: true,
          },
        },
        paymentVouchers: {
          select: {
            id: true,
            code: true,
            type: true,
            amount: true,
            status: true,
          },
        },
        complaints: {
          select: {
            id: true,
            code: true,
            type: true,
            severity: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' as const },
          take: 20,
        },
        deliveries: {
          select: {
            id: true,
            code: true,
            status: true,
            recipientName: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' as const },
          take: 20,
        },
        qcInspections: {
          select: {
            id: true,
            code: true,
            status: true,
            passedQuantity: true,
            failedQuantity: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' as const },
          take: 10,
        },
        supplierOrders: {
          select: {
            id: true,
            code: true,
            status: true,
            supplierName: true,
            quotedPriceCNY: true,
            actualPriceCNY: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' as const },
          take: 20,
        },
        mhhIssues: {
          select: {
            id: true,
            issueType: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' as const },
          take: 20,
        },
        costAllocations: {
          select: {
            id: true,
            allocatedAmount: true,
            method: true,
            proportion: true,
          },
          take: 50,
        },
        extraCharges: {
          select: {
            id: true,
            chargeType: true,
            amount: true,
            status: true,
          },
          take: 20,
        },
      },
    }) as unknown as OrderWithRelations | null;
  }

  /**
   * Update an order by ID.
   */
  async update(id: string, data: Prisma.OrderUpdateInput): Promise<Order> {
    return this.prisma.order.update({
      where: { id },
      data,
      include: {
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
        items: { where: { deletedAt: null } },
      },
    });
  }

  /**
   * Update order status and create a status history record atomically.
   *
   * Uses optimistic locking: the UPDATE only matches when the current DB status
   * equals `fromStatus`. If another request changed the status first (race condition),
   * updateMany returns count=0 and we throw ConflictException.
   * This prevents two concurrent transitions from the same state both succeeding
   * (e.g., QUOTATION->PENDING_DEPOSIT and QUOTATION->SOURCING).
   */
  async updateStatus(
    id: string,
    fromStatus: OrderStatus | null,
    toStatus: OrderStatus,
    changedBy: string,
    note?: string,
    additionalData?: Prisma.OrderUpdateInput,
  ): Promise<Order> {
    return this.prisma.executeInTransaction(async (tx) => {
      // Optimistic lock: only update if current status matches fromStatus
      if (fromStatus !== null) {
        const result = await tx.order.updateMany({
          where: { id, status: fromStatus },
          data: {
            status: toStatus,
            ...additionalData,
          },
        });

        if (result.count === 0) {
          // Status was already changed by another concurrent request
          const current = await tx.order.findUnique({
            where: { id },
            select: { status: true, code: true },
          });
          const currentStatus = current?.status ?? 'UNKNOWN';
          throw new ConflictException(
            `Order status conflict: expected ${fromStatus} but found ${currentStatus}. ` +
              `Another user may have changed the status concurrently. Please refresh and try again.`,
          );
        }
      } else {
        // fromStatus is null (initial creation) — no optimistic lock needed
        await tx.order.update({
          where: { id },
          data: {
            status: toStatus,
            ...additionalData,
          },
        });
      }

      // Create status history record
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus,
          toStatus,
          changedBy,
          note,
        },
      });

      // Return the updated order
      return tx.order.findUnique({ where: { id } }) as Promise<Order>;
    });
  }

  /**
   * Create an order status history record.
   */
  async createStatusHistory(data: {
    orderId: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    changedBy: string;
    note?: string;
  }): Promise<void> {
    await this.prisma.orderStatusHistory.create({ data });
  }

  /**
   * Update order items (replace all items).
   */
  async replaceItems(
    orderId: string,
    items: Prisma.OrderItemCreateWithoutOrderInput[],
  ): Promise<OrderItem[]> {
    return this.prisma.executeInTransaction(async (tx) => {
      // Layer 2A: Soft delete existing items instead of hard delete
      await tx.orderItem.updateMany({
        where: { orderId, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      // Create new items
      await tx.orderItem.createMany({
        data: items.map((item) => ({
          ...item,
          orderId,
        })),
      });

      return tx.orderItem.findMany({ where: { orderId } });
    });
  }

  /**
   * Generate the next order code in the format TBS-ORD-YYMMDD-NNNN.
   */
  async generateOrderCode(): Promise<string> {
    return generateCode(this.prisma.order, {
      prefix: 'TBS-ORD',
      datePrefixFormat: 'YYMMDD',
      sequenceLength: 4,
    }, this.cacheService);
  }

  /**
   * Applies data scope filtering to restrict results based on user role.
   */
  private applyDataScope(
    where: Prisma.OrderWhereInput,
    dataScope?: DataScopeFilter,
  ): Prisma.OrderWhereInput {
    if (!dataScope || dataScope.isGlobal) {
      return where;
    }

    const scopeFilters: Prisma.OrderWhereInput[] = [];

    if (dataScope.branch) {
      scopeFilters.push({ branch: dataScope.branch as any });
    }

    if (dataScope.saleId) {
      scopeFilters.push({ saleId: dataScope.saleId });
    }

    if (dataScope.teamLeaderId) {
      // For team leaders, include orders from their direct reports
      scopeFilters.push({
        OR: [
          { saleId: dataScope.teamLeaderId },
          {
            customer: {
              saleId: dataScope.teamLeaderId,
            },
          },
        ],
      });
    }

    if (scopeFilters.length === 0) {
      return where;
    }

    return {
      AND: [where, ...scopeFilters],
    };
  }
}
