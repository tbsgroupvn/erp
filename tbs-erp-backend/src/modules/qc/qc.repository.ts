import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, QCInspection } from '@prisma/client';

@Injectable()
export class QCRepository {
  private readonly logger = new Logger(QCRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new QC inspection record.
   */
  async create(
    data: Prisma.QCInspectionUncheckedCreateInput,
  ): Promise<QCInspection> {
    return this.prisma.qCInspection.create({ data });
  }

  /**
   * Find all QC inspections with pagination and relations.
   * Includes order summary and package summary for list views.
   */
  async findAll(
    where: Prisma.QCInspectionWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.QCInspectionOrderByWithRelationInput,
  ): Promise<{ data: QCInspection[]; total: number }> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.qCInspection.findMany({
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
            },
          },
          package: {
            select: {
              id: true,
              code: true,
              trackingNumberCN: true,
            },
          },
        },
      }),
      this.prisma.qCInspection.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Find a single QC inspection by ID with full relations.
   */
  async findById(id: string) {
    return this.prisma.qCInspection.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            customerId: true,
            serviceType: true,
            customer: {
              select: { fullName: true, code: true },
            },
          },
        },
        package: {
          select: {
            id: true,
            code: true,
            trackingNumberCN: true,
            actualWeight: true,
            chargeableWeight: true,
          },
        },
      },
    });
  }

  /**
   * Update a QC inspection record.
   */
  async update(
    id: string,
    data: Prisma.QCInspectionUncheckedUpdateInput,
  ): Promise<QCInspection> {
    return this.prisma.qCInspection.update({
      where: { id },
      data,
    });
  }

  /**
   * Find all QC inspections for a specific order.
   */
  async findByOrderId(orderId: string): Promise<QCInspection[]> {
    return this.prisma.qCInspection.findMany({
      where: { orderId },
      include: {
        package: {
          select: {
            id: true,
            code: true,
            trackingNumberCN: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find all QC inspections for a specific package.
   */
  async findByPackageId(packageId: string): Promise<QCInspection[]> {
    return this.prisma.qCInspection.findMany({
      where: { packageId },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            customerId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Generate the next QC inspection code in format QC-YYYYMM-XXXX.
   *
   * The sequence resets monthly. Finds the latest code for the current
   * month and increments the counter.
   */
  async generateCode(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `QC-${yearMonth}-`;

    const latest = await this.prisma.qCInspection.findFirst({
      where: {
        code: { startsWith: prefix },
      },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latest) {
      const match = latest.code.match(/QC-\d{6}-(\d{4})/);
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }
}
