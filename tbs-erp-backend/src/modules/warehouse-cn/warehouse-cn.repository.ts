import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { Prisma, Package, WarehouseCNStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { generateCode } from '@common/utils/code-generator.util';

@Injectable()
export class WarehouseCNRepository {
  private readonly logger = new Logger(WarehouseCNRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Create a new package record upon receiving at Warehouse CN.
   */
  async createPackage(data: {
    orderId: string;
    trackingNumberCN?: string;
    description?: string;
    imageUrls?: string[];
    note?: string;
    receivedCNBy: string;
  }): Promise<Package> {
    const code = await this.generatePackageCode();

    return this.prisma.package.create({
      data: {
        code,
        orderId: data.orderId,
        trackingNumberCN: data.trackingNumberCN,
        description: data.description,
        imageUrls: data.imageUrls ?? [],
        note: data.note,
        warehouseCNStatus: WarehouseCNStatus.RECEIVED,
        receivedCNAt: new Date(),
        receivedCNBy: data.receivedCNBy,
      },
    });
  }

  /**
   * Update package measurements.
   */
  async updateMeasurements(
    packageId: string,
    measurements: {
      actualWeight: number;
      length: number;
      width: number;
      height: number;
      volumetricWeight: number;
      chargeableWeight: number;
    },
  ): Promise<Package> {
    return this.prisma.package.update({
      where: { id: packageId },
      data: {
        actualWeight: new Decimal(measurements.actualWeight),
        length: new Decimal(measurements.length),
        width: new Decimal(measurements.width),
        height: new Decimal(measurements.height),
        volumetricWeight: new Decimal(measurements.volumetricWeight),
        chargeableWeight: new Decimal(measurements.chargeableWeight),
        warehouseCNStatus: WarehouseCNStatus.CHECKED,
      },
    });
  }

  /**
   * Update package warehouse CN status.
   */
  async updateStatus(packageId: string, status: WarehouseCNStatus): Promise<Package> {
    const updateData: Prisma.PackageUpdateInput = {
      warehouseCNStatus: status,
    };

    if (status === WarehouseCNStatus.PACKED) {
      updateData.packedAt = new Date();
    }

    return this.prisma.package.update({
      where: { id: packageId },
      data: updateData,
    });
  }

  /**
   * Find package by ID with relations.
   */
  async findById(id: string) {
    return this.prisma.package.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            customerId: true,
            shippingRoute: true,
            serviceType: true,
            customer: {
              select: { fullName: true, code: true },
            },
          },
        },
        container: {
          select: { id: true, code: true, status: true },
        },
      },
    });
  }

  /**
   * Find packages at Warehouse CN with optional filters.
   */
  async findAll(
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
              shippingRoute: true,
              customer: {
                select: { fullName: true, code: true },
              },
            },
          },
        },
      }),
      this.prisma.package.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Find a package by tracking number.
   */
  async findByTrackingNumber(trackingNumberCN: string): Promise<Package | null> {
    return this.prisma.package.findFirst({
      where: {
        trackingNumberCN: {
          equals: trackingNumberCN,
          mode: 'insensitive',
        },
      },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            customerId: true,
          },
        },
      },
    });
  }

  /**
   * Find ALL packages with the same tracking number (multi-piece shipment).
   */
  async findAllByTrackingNumber(trackingNumberCN: string): Promise<Package[]> {
    return this.prisma.package.findMany({
      where: {
        trackingNumberCN: { equals: trackingNumberCN, mode: 'insensitive' },
      },
      include: {
        order: {
          select: { id: true, code: true, customerId: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Generate the next package code: TBS-PKG-NNNNNN.
   */
  async generatePackageCode(): Promise<string> {
    return generateCode(this.prisma.package, {
      prefix: 'TBS-PKG',
      sequenceLength: 6,
    }, this.cacheService);
  }
}
