import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { Prisma, Container } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { generateCode } from '@common/utils/code-generator.util';

@Injectable()
export class ContainerRepository {
  private readonly logger = new Logger(ContainerRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Create a new container.
   */
  async create(data: Prisma.ContainerCreateInput): Promise<Container> {
    return this.prisma.container.create({
      data,
      include: {
        packages: {
          select: {
            id: true,
            code: true,
            chargeableWeight: true,
            orderId: true,
          },
        },
      },
    });
  }

  /**
   * Find all containers with pagination and filters.
   */
  async findAll(
    where: Prisma.ContainerWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.ContainerOrderByWithRelationInput,
  ): Promise<{ data: any[]; total: number }> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.container.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          code: true,
          status: true,
          shippingRoute: true,
          carrier: true,
          totalPackages: true,
          totalWeight: true,
          fillRate: true,
          maxCapacity: true,
          estimatedDepartureAt: true,
          estimatedArrivalAt: true,
          actualDepartureAt: true,
          actualArrivalAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { packages: true, orders: true } },
        },
      }),
      this.prisma.container.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Find a container by ID with full relations.
   */
  async findById(id: string) {
    return this.prisma.container.findUnique({
      where: { id },
      include: {
        packages: {
          include: {
            order: {
              select: {
                id: true,
                code: true,
                customerId: true,
                customer: {
                  select: { fullName: true, code: true },
                },
              },
            },
          },
        },
        orders: {
          select: {
            id: true,
            code: true,
            customerId: true,
            status: true,
            totalChargeableWeight: true,
          },
        },
      },
    });
  }

  /**
   * Update a container by ID.
   */
  async update(id: string, data: Prisma.ContainerUpdateInput): Promise<Container> {
    return this.prisma.container.update({
      where: { id },
      data,
    });
  }

  /**
   * Add packages to a container and recalculate totals.
   */
  async addPackages(containerId: string, packageIds: string[]): Promise<Container> {
    return this.prisma.executeInTransaction(async (tx) => {
      // Assign packages to container
      await tx.package.updateMany({
        where: { id: { in: packageIds } },
        data: { containerId },
      });

      // Recalculate container totals using aggregate — avoids loading all package rows
      const agg = await tx.package.aggregate({
        where: { containerId },
        _count: true,
        _sum: { chargeableWeight: true },
      });

      const totalPackages = agg._count;
      const totalWeight = agg._sum.chargeableWeight ? Number(agg._sum.chargeableWeight) : 0;

      // Get max capacity for fill rate calculation
      const container = await tx.container.findUniqueOrThrow({
        where: { id: containerId },
        select: { maxCapacity: true },
      });

      const maxCapacity = container.maxCapacity ? Number(container.maxCapacity) : 0;
      const fillRate = maxCapacity > 0 ? (totalWeight / maxCapacity) * 100 : 0;

      return tx.container.update({
        where: { id: containerId },
        data: {
          totalPackages,
          totalWeight: new Decimal(totalWeight),
          fillRate: new Decimal(Math.round(fillRate * 100) / 100),
        },
        include: {
          packages: {
            select: {
              id: true,
              code: true,
              chargeableWeight: true,
              orderId: true,
            },
          },
        },
      });
    });
  }

  /**
   * Generate the next container code: TBS{YYYY}{MM}{seq}, e.g. TBS20260301.
   */
  async generateContainerCode(): Promise<string> {
    return generateCode(this.prisma.container, {
      prefix: 'TBS',
      datePrefixFormat: 'YYYYMM',
      sequenceLength: 2,
      separator: '',
    }, this.cacheService);
  }
}
