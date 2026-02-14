import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, Package, Delivery, Branch } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class WarehouseVNRepository {
  private readonly logger = new Logger(WarehouseVNRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Receive packages at Warehouse VN from a container.
   * Updates package status and timestamps.
   */
  async receivePackages(
    packageIds: string[],
    receivedBy: string,
  ): Promise<number> {
    const result = await this.prisma.package.updateMany({
      where: { id: { in: packageIds } },
      data: {
        warehouseVNStatus: 'RECEIVED',
        receivedVNAt: new Date(),
        receivedVNBy: receivedBy,
      },
    });

    return result.count;
  }

  /**
   * Update a package's VN warehouse status.
   */
  async updatePackageStatus(
    packageId: string,
    status: string,
  ): Promise<Package> {
    const updateData: Prisma.PackageUpdateInput = {
      warehouseVNStatus: status,
    };

    if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    }

    return this.prisma.package.update({
      where: { id: packageId },
      data: updateData,
    });
  }

  /**
   * Find packages at Warehouse VN with filters and pagination.
   */
  async findPackages(
    where: Prisma.PackageWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.PackageOrderByWithRelationInput,
  ): Promise<{ data: Package[]; total: number }> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.package.findMany({
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
              branch: true,
              customer: {
                select: {
                  fullName: true,
                  code: true,
                  phone: true,
                  address: true,
                },
              },
            },
          },
          container: {
            select: { id: true, code: true },
          },
        },
      }),
      this.prisma.package.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Create a delivery record.
   */
  async createDelivery(
    data: Prisma.DeliveryCreateInput,
  ): Promise<Delivery> {
    return this.prisma.delivery.create({
      data,
    });
  }

  /**
   * Find deliveries with filters.
   */
  async findDeliveries(
    where: Prisma.DeliveryWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.DeliveryOrderByWithRelationInput,
  ): Promise<{ data: Delivery[]; total: number }> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.delivery.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          order: {
            select: {
              id: true,
              code: true,
              customer: {
                select: { fullName: true, code: true },
              },
            },
          },
          vehicle: {
            select: { id: true, plateNumber: true, type: true },
          },
        },
      }),
      this.prisma.delivery.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Generate the next delivery code: TBS-DLV-YYMMDD-NNNN.
   */
  async generateDeliveryCode(): Promise<string> {
    const now = new Date();
    const datePrefix = [
      String(now.getFullYear()).slice(-2),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');

    const prefix = `TBS-DLV-${datePrefix}`;

    const latest = await this.prisma.delivery.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latest) {
      const lastSequence = parseInt(
        latest.code.split('-').pop() || '0',
        10,
      );
      sequence = lastSequence + 1;
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }
}
