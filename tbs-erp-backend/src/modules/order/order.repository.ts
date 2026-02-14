import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, Order, OrderStatus, OrderItem } from '@prisma/client';
import { DataScopeFilter } from '@common/guards/data-scope.guard';

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
}

@Injectable()
export class OrderRepository {
  private readonly logger = new Logger(OrderRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new order with its items in a single transaction.
   */
  async create(
    data: Prisma.OrderCreateInput,
    items: Prisma.OrderItemCreateWithoutOrderInput[],
  ): Promise<Order> {
    return this.prisma.order.create({
      data: {
        ...data,
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
            tier: true,
            phone: true,
          },
        },
      },
    });
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
          items: true,
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
        items: true,
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
        items: true,
      },
    });
  }

  /**
   * Update order status and create a status history record atomically.
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
      // Update the order status
      const order = await tx.order.update({
        where: { id },
        data: {
          status: toStatus,
          ...additionalData,
        },
      });

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

      return order;
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
      // Delete existing items
      await tx.orderItem.deleteMany({ where: { orderId } });

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
    const now = new Date();
    const datePrefix = [
      String(now.getFullYear()).slice(-2),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');

    const prefix = `TBS-ORD-${datePrefix}`;

    // Find the latest order with this prefix to determine the sequence number
    const latestOrder = await this.prisma.order.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latestOrder) {
      const lastSequence = parseInt(latestOrder.code.split('-').pop() || '0', 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
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
