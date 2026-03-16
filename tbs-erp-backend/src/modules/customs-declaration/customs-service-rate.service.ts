import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * XNK-4: Customs Service Rate Management.
 *
 * Manages the fee schedule for customs brokerage services per port and
 * cargo type. Supports effective date ranges so historical rates are
 * preserved while only the currently applicable rate is used for
 * calculations.
 */
@Injectable()
export class CustomsServiceRateService {
  private readonly logger = new Logger(CustomsServiceRateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new customs service rate entry.
   */
  async create(dto: {
    portName: string;
    cargoType: string;
    serviceFee: number;
    currency?: string;
    effectiveFrom: Date;
    effectiveTo?: Date;
    note?: string;
    createdBy: string;
  }) {
    if (dto.effectiveTo && dto.effectiveTo <= dto.effectiveFrom) {
      throw new BadRequestException('effectiveTo must be after effectiveFrom');
    }

    const rate = await this.prisma.customsServiceRate.create({
      data: {
        portName: dto.portName,
        cargoType: dto.cargoType,
        serviceFee: new Prisma.Decimal(dto.serviceFee),
        currency: (dto.currency as any) ?? 'VND',
        effectiveFrom: dto.effectiveFrom,
        effectiveTo: dto.effectiveTo ?? null,
        note: dto.note ?? null,
        createdBy: dto.createdBy,
      },
    });

    this.logger.log(
      `Customs service rate created: ${dto.portName} / ${dto.cargoType} = ${dto.serviceFee} (effective from ${dto.effectiveFrom.toISOString().slice(0, 10)})`,
    );

    return rate;
  }

  /**
   * Lists service rates with optional filters.
   * Only returns currently effective rates by default (effectiveFrom <= now
   * AND effectiveTo is null or > now).
   */
  async findAll(portName?: string, cargoType?: string) {
    const now = new Date();

    const where: Prisma.CustomsServiceRateWhereInput = {
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    };

    if (portName) {
      where.portName = { contains: portName, mode: 'insensitive' };
    }

    if (cargoType) {
      where.cargoType = cargoType;
    }

    const rates = await this.prisma.customsServiceRate.findMany({
      where,
      orderBy: [{ portName: 'asc' }, { cargoType: 'asc' }, { effectiveFrom: 'desc' }],
    });

    return {
      data: rates,
      total: rates.length,
    };
  }

  /**
   * Finds the single applicable rate for a given port and cargo type
   * at the current moment.
   *
   * Returns the most recently effective rate where:
   *   effectiveFrom <= now AND (effectiveTo is null OR effectiveTo > now)
   */
  async findRate(portName: string, cargoType: string) {
    const now = new Date();

    const rate = await this.prisma.customsServiceRate.findFirst({
      where: {
        portName,
        cargoType,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!rate) {
      throw new NotFoundException(
        `No applicable customs service rate found for port "${portName}" and cargo type "${cargoType}"`,
      );
    }

    return rate;
  }

  /**
   * Compares the actual fees paid for a customs declaration against the
   * expected fees from the rate schedule.
   *
   * Looks at the declaration's total payable and compares it with
   * the applicable service rate for the port/cargo combination.
   *
   * Returns a variance analysis showing expected vs actual amounts.
   */
  async compareActualVsExpected(declarationId: string) {
    const declaration = await this.prisma.customsDeclaration.findUnique({
      where: { id: declarationId },
      include: {
        lines: {
          where: { deletedAt: null },
          select: {
            declaredDescription: true,
            declaredTotalValue: true,
          },
        },
      },
    });

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${declarationId} not found`);
    }

    const portName = declaration.portOfDischarge;
    if (!portName) {
      throw new BadRequestException(
        `Declaration ${declaration.code} does not have a port of discharge set`,
      );
    }

    // Attempt to determine cargo type from the declaration's lines.
    // Default to GENERAL if no specific type can be inferred.
    const cargoType = this.inferCargoType(declaration.lines);

    // Look up the applicable rate
    const now = new Date();
    const rate = await this.prisma.customsServiceRate.findFirst({
      where: {
        portName,
        cargoType,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    const expectedFee = rate ? Number(rate.serviceFee) : null;
    const actualFee = Number(declaration.totalPayable);

    const variance = expectedFee !== null ? actualFee - expectedFee : null;
    const variancePercent =
      expectedFee !== null && expectedFee > 0
        ? Math.round((variance! / expectedFee) * 10000) / 100
        : null;

    this.logger.log(
      `Rate comparison for declaration ${declaration.code}: expected=${expectedFee}, actual=${actualFee}`,
    );

    return {
      declarationId,
      declarationCode: declaration.code,
      portName,
      cargoType,
      expectedFee,
      actualFee,
      variance,
      variancePercent,
      rateFound: rate !== null,
      rate: rate
        ? {
            id: rate.id,
            serviceFee: Number(rate.serviceFee),
            currency: rate.currency,
            effectiveFrom: rate.effectiveFrom,
            effectiveTo: rate.effectiveTo,
          }
        : null,
    };
  }

  /**
   * Infers cargo type from declaration line descriptions.
   * Falls back to 'GENERAL' if no specific type is detected.
   */
  private inferCargoType(lines: Array<{ declaredDescription: string }>): string {
    const allDescriptions = lines.map((l) => l.declaredDescription.toUpperCase()).join(' ');

    const cargoKeywords: Record<string, string> = {
      FOOD: 'FOOD',
      AGRICULTURAL: 'AGRICULTURAL',
      CHEMICAL: 'CHEMICAL',
      PHARMACEUTICAL: 'PHARMACEUTICAL',
      ELECTRONICS: 'ELECTRONICS',
      TEXTILE: 'TEXTILE',
      MACHINERY: 'MACHINERY',
    };

    for (const [keyword, type] of Object.entries(cargoKeywords)) {
      if (allDescriptions.includes(keyword)) {
        return type;
      }
    }

    return 'GENERAL';
  }
}
