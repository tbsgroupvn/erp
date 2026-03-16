import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, SupplierOrder, SupplierOrderStatus } from '@prisma/client';

export interface SupplierOrderWithRelations extends SupplierOrder {
  order: {
    id: string;
    code: string;
    customerId: string;
    serviceType: string;
    status: string;
  };
  orderItem?: {
    id: string;
    productName: string;
    productUrl: string | null;
    quantity: number;
  } | null;
}

@Injectable()
export class SupplierOrderRepository {
  private readonly logger = new Logger(SupplierOrderRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new supplier order.
   */
  async create(data: Prisma.SupplierOrderCreateInput, userId: string): Promise<SupplierOrder> {
    return this.prisma.supplierOrder.create({
      data: {
        ...data,
        createdBy: userId,
      },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            customerId: true,
            serviceType: true,
            status: true,
          },
        },
        orderItem: {
          select: {
            id: true,
            productName: true,
            productUrl: true,
            quantity: true,
          },
        },
      },
    });
  }

  /**
   * Find all supplier orders with pagination and filters.
   */
  async findAll(
    where: Prisma.SupplierOrderWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.SupplierOrderOrderByWithRelationInput,
  ): Promise<{ data: SupplierOrder[]; total: number }> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.supplierOrder.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          order: {
            select: {
              id: true,
              code: true,
              customerId: true,
              serviceType: true,
              status: true,
            },
          },
          orderItem: {
            select: {
              id: true,
              productName: true,
              productUrl: true,
              quantity: true,
            },
          },
        },
      }),
      this.prisma.supplierOrder.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Find a single supplier order by ID with full relations.
   */
  async findById(id: string): Promise<SupplierOrderWithRelations | null> {
    return this.prisma.supplierOrder.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            customerId: true,
            serviceType: true,
            status: true,
          },
        },
        orderItem: {
          select: {
            id: true,
            productName: true,
            productUrl: true,
            quantity: true,
          },
        },
      },
    }) as unknown as SupplierOrderWithRelations | null;
  }

  /**
   * Update a supplier order by ID.
   */
  async update(id: string, data: Prisma.SupplierOrderUpdateInput): Promise<SupplierOrder> {
    return this.prisma.supplierOrder.update({
      where: { id },
      data,
      include: {
        order: {
          select: {
            id: true,
            code: true,
            customerId: true,
            serviceType: true,
            status: true,
          },
        },
        orderItem: {
          select: {
            id: true,
            productName: true,
            productUrl: true,
            quantity: true,
          },
        },
      },
    });
  }

  /**
   * Update supplier order status with optional additional data.
   */
  async updateStatus(
    id: string,
    status: SupplierOrderStatus,
    additionalData?: Prisma.SupplierOrderUpdateInput,
  ): Promise<SupplierOrder> {
    return this.prisma.supplierOrder.update({
      where: { id },
      data: {
        status,
        ...additionalData,
      },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            customerId: true,
            serviceType: true,
            status: true,
          },
        },
        orderItem: {
          select: {
            id: true,
            productName: true,
            productUrl: true,
            quantity: true,
          },
        },
      },
    });
  }

  /**
   * Generate the next supplier order code in the format SO-YYYYMM-XXXX.
   */
  async generateCode(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const codePrefix = `SO-${yearMonth}`;

    const latest = await this.prisma.supplierOrder.findFirst({
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
