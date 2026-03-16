import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, MasterOrder } from '@prisma/client';
import { DataScopeFilter } from '@common/guards/data-scope.guard';

export interface MasterOrderWithRelations extends MasterOrder {
  customer: {
    id: string;
    code: string;
    fullName: string;
    companyName: string | null;
    phone: string;
  };
  sale: {
    id: string;
    fullName: string;
    saleCode: string | null;
  };
  subOrders: Array<{
    id: string;
    code: string;
    serviceType: string;
    status: string;
    clearanceType: string;
    subOrderSuffix: string | null;
    totalAmount: unknown;
    depositRequired: unknown;
    depositPaid: unknown;
    isDepositPaid: boolean;
    shippingRoute: string | null;
    note: string | null;
    createdAt: Date;
    items: Array<{
      id: string;
      productName: string;
      productUrl: string | null;
      quantity: number;
      unitPrice: unknown;
      currency: string;
      totalPrice: unknown;
      note: string | null;
    }>;
    statusHistory: Array<{
      id: string;
      fromStatus: string | null;
      toStatus: string;
      changedBy: string;
      note: string | null;
      createdAt: Date;
    }>;
  }>;
  _count?: {
    subOrders: number;
  };
}

@Injectable()
export class MasterOrderRepository {
  private readonly logger = new Logger(MasterOrderRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate master order code: #SALECODE.DDMMYY.NNNN
   * Daily sequence resets per saleCode.
   */
  async generateMasterOrderCode(saleCode: string): Promise<string> {
    const now = new Date();
    const dateStr = [
      String(now.getDate()).padStart(2, '0'),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getFullYear()).slice(-2),
    ].join('');

    const prefix = `#${saleCode}.${dateStr}`;

    // Count existing master orders with same prefix today
    const existing = await this.prisma.masterOrder.findMany({
      where: { code: { startsWith: prefix } },
      select: { code: true },
      orderBy: { code: 'desc' },
      take: 1,
    });

    let sequence = 1;
    if (existing.length > 0) {
      const lastCode = existing[0].code;
      const parts = lastCode.split('.');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `${prefix}.${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Generate sub order code: masterCode-A, -B, -C, etc.
   * Index 0 → 'A', 1 → 'B', etc.
   */
  generateSubOrderCode(masterCode: string, index: number): string {
    if (index >= 26) {
      throw new BadRequestException(
        `Sub order index ${index} exceeds maximum (25). Maximum 26 sub orders per master order.`,
      );
    }
    const suffix = String.fromCharCode(65 + index); // 65 = 'A'
    return `${masterCode}-${suffix}`;
  }

  /**
   * Get suffix letter from index.
   */
  getSubOrderSuffix(index: number): string {
    if (index >= 26) {
      throw new BadRequestException(
        `Sub order index ${index} exceeds maximum (25). Maximum 26 sub orders per master order.`,
      );
    }
    return String.fromCharCode(65 + index);
  }

  /**
   * Create a master order.
   */
  async create(data: Prisma.MasterOrderCreateInput): Promise<MasterOrder> {
    return this.prisma.masterOrder.create({ data });
  }

  /**
   * Find all master orders with pagination, filters, and data scope.
   */
  async findAll(
    where: Prisma.MasterOrderWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.MasterOrderOrderByWithRelationInput,
    dataScope?: DataScopeFilter,
  ): Promise<{ data: MasterOrderWithRelations[]; total: number }> {
    const scopedWhere = this.applyDataScope(where, dataScope);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.masterOrder.findMany({
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
              phone: true,
            },
          },
          sale: {
            select: {
              id: true,
              fullName: true,
              saleCode: true,
            },
          },
          subOrders: {
            include: {
              items: true,
              statusHistory: {
                orderBy: { createdAt: 'desc' },
                take: 5,
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: { subOrders: true },
          },
        },
      }),
      this.prisma.masterOrder.count({ where: scopedWhere }),
    ]);

    return { data: data as unknown as MasterOrderWithRelations[], total };
  }

  /**
   * Find a single master order by ID with full relations.
   */
  async findById(id: string): Promise<MasterOrderWithRelations | null> {
    const result = await this.prisma.masterOrder.findUnique({
      where: { id },
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
        sale: {
          select: {
            id: true,
            fullName: true,
            saleCode: true,
          },
        },
        subOrders: {
          include: {
            items: true,
            statusHistory: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { subOrders: true },
        },
      },
    });

    return result as unknown as MasterOrderWithRelations | null;
  }

  /**
   * Update master order.
   */
  async update(id: string, data: Prisma.MasterOrderUpdateInput): Promise<MasterOrder> {
    return this.prisma.masterOrder.update({ where: { id }, data });
  }

  /**
   * Count existing sub orders for a master order to determine next suffix.
   */
  async countSubOrders(masterOrderId: string): Promise<number> {
    return this.prisma.order.count({
      where: { masterOrderId },
    });
  }

  /**
   * Applies data scope filtering for master orders.
   */
  private applyDataScope(
    where: Prisma.MasterOrderWhereInput,
    dataScope?: DataScopeFilter,
  ): Prisma.MasterOrderWhereInput {
    if (!dataScope || dataScope.isGlobal) {
      return where;
    }

    const scopeFilters: Prisma.MasterOrderWhereInput[] = [];

    if (dataScope.branch) {
      scopeFilters.push({ branch: dataScope.branch as any });
    }

    if (dataScope.saleId) {
      scopeFilters.push({ saleId: dataScope.saleId });
    }

    if (dataScope.teamLeaderId) {
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
