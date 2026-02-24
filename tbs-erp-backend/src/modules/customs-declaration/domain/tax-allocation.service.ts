import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface TaxAllocationResult {
  orderId: string;
  orderCode: string;
  proportion: number;
  importDuty: number;
  vat: number;
  specialTax: number;
  otherTax: number;
  totalAllocated: number;
}

/**
 * Service for allocating customs taxes to individual orders.
 *
 * Follows the same proportional allocation pattern as CostAllocationService:
 *  - Calculate each order's proportion of the total
 *  - Allocate taxes proportionally
 *  - Give remainder to the last order to avoid rounding drift
 *  - Create OrderExtraCharge records for financial tracking
 *
 * Supports allocation by value (order contribution) and by weight (package weights).
 */
@Injectable()
export class TaxAllocationService {
  private readonly logger = new Logger(TaxAllocationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Allocates customs taxes to orders proportionally by contributed value.
   *
   * Formula: orderTax = (orderContributedValue / totalContributedValue) * totalTax
   *
   * @param declarationId - The customs declaration ID
   * @returns Array of tax allocation results
   */
  async allocateByValue(declarationId: string): Promise<TaxAllocationResult[]> {
    const { declaration, orderContributions, totals } =
      await this.getDeclarationData(declarationId);

    if (orderContributions.length === 0) {
      throw new BadRequestException(
        `Declaration ${declaration.code} has no source items linked to orders`,
      );
    }

    const totalContributedValue = orderContributions.reduce(
      (sum, o) => sum + o.contributedValue,
      0,
    );

    if (totalContributedValue === 0) {
      throw new BadRequestException(
        'Total contributed value is 0. Cannot allocate by value.',
      );
    }

    let sumImportDuty = 0;
    let sumVat = 0;
    let sumSpecialTax = 0;
    let sumOtherTax = 0;

    const allocations: TaxAllocationResult[] = orderContributions.map(
      (order, index) => {
        const proportion = order.contributedValue / totalContributedValue;
        let importDuty: number;
        let vat: number;
        let specialTax: number;
        let otherTax: number;

        if (index === orderContributions.length - 1) {
          // Give remainder to the last order to avoid rounding differences
          importDuty = totals.importDuty - sumImportDuty;
          vat = totals.vat - sumVat;
          specialTax = totals.specialTax - sumSpecialTax;
          otherTax = totals.otherTax - sumOtherTax;
        } else {
          importDuty = Math.round(totals.importDuty * proportion);
          vat = Math.round(totals.vat * proportion);
          specialTax = Math.round(totals.specialTax * proportion);
          otherTax = Math.round(totals.otherTax * proportion);

          sumImportDuty += importDuty;
          sumVat += vat;
          sumSpecialTax += specialTax;
          sumOtherTax += otherTax;
        }

        const totalAllocated = importDuty + vat + specialTax + otherTax;

        return {
          orderId: order.orderId,
          orderCode: order.orderCode,
          proportion: Math.round(proportion * 1000000) / 1000000,
          importDuty,
          vat,
          specialTax,
          otherTax,
          totalAllocated,
        };
      },
    );

    await this.saveAllocations(declarationId, declaration.code, allocations, 'VALUE');

    return allocations;
  }

  /**
   * Allocates customs taxes to orders proportionally by package weight.
   *
   * Formula: orderTax = (orderPackageWeight / totalPackageWeight) * totalTax
   *
   * @param declarationId - The customs declaration ID
   * @returns Array of tax allocation results
   */
  async allocateByWeight(declarationId: string): Promise<TaxAllocationResult[]> {
    const { declaration, totals } =
      await this.getDeclarationData(declarationId);

    // Get package weights grouped by order
    const sourceItems = await this.prisma.customsLineSourceItem.findMany({
      where: {
        line: { declarationId },
      },
      include: {
        line: {
          select: { declaredNetWeight: true, declaredQuantity: true },
        },
      },
    });

    if (sourceItems.length === 0) {
      throw new BadRequestException(
        `Declaration ${declaration.code} has no source items linked to orders`,
      );
    }

    // Aggregate weights by order
    const orderWeightMap = new Map<string, { orderId: string; weight: number }>();

    for (const item of sourceItems) {
      const existing = orderWeightMap.get(item.orderId) ?? {
        orderId: item.orderId,
        weight: 0,
      };

      // Use contributed quantity as weight proxy when net weight is per-line
      const lineNetWeight = item.line.declaredNetWeight
        ? Number(item.line.declaredNetWeight)
        : 0;
      const lineQuantity = Number(item.line.declaredQuantity);
      const itemQuantity = Number(item.contributedQuantity);

      // Proportional weight for this source item
      const itemWeight =
        lineQuantity > 0
          ? (itemQuantity / lineQuantity) * lineNetWeight
          : 0;

      existing.weight += Math.round(itemWeight * 10000) / 10000;
      orderWeightMap.set(item.orderId, existing);
    }

    const orderWeights = Array.from(orderWeightMap.values());

    // Look up order codes
    const orderIds = orderWeights.map((o) => o.orderId);
    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, code: true },
    });
    const orderCodeMap = new Map(orders.map((o) => [o.id, o.code]));

    const totalWeight = orderWeights.reduce((sum, o) => sum + o.weight, 0);

    if (totalWeight === 0) {
      throw new BadRequestException(
        'Total weight is 0. Cannot allocate by weight. ' +
          'Ensure declaration lines have net weights recorded.',
      );
    }

    let sumImportDuty = 0;
    let sumVat = 0;
    let sumSpecialTax = 0;
    let sumOtherTax = 0;

    const allocations: TaxAllocationResult[] = orderWeights.map(
      (order, index) => {
        const proportion = order.weight / totalWeight;
        let importDuty: number;
        let vat: number;
        let specialTax: number;
        let otherTax: number;

        if (index === orderWeights.length - 1) {
          // Give remainder to the last order to avoid rounding differences
          importDuty = totals.importDuty - sumImportDuty;
          vat = totals.vat - sumVat;
          specialTax = totals.specialTax - sumSpecialTax;
          otherTax = totals.otherTax - sumOtherTax;
        } else {
          importDuty = Math.round(totals.importDuty * proportion);
          vat = Math.round(totals.vat * proportion);
          specialTax = Math.round(totals.specialTax * proportion);
          otherTax = Math.round(totals.otherTax * proportion);

          sumImportDuty += importDuty;
          sumVat += vat;
          sumSpecialTax += specialTax;
          sumOtherTax += otherTax;
        }

        const totalAllocated = importDuty + vat + specialTax + otherTax;

        return {
          orderId: order.orderId,
          orderCode: orderCodeMap.get(order.orderId) ?? 'UNKNOWN',
          proportion: Math.round(proportion * 1000000) / 1000000,
          importDuty,
          vat,
          specialTax,
          otherTax,
          totalAllocated,
        };
      },
    );

    await this.saveAllocations(declarationId, declaration.code, allocations, 'WEIGHT');

    return allocations;
  }

  /**
   * Fetches declaration data and computes total taxes and per-order value contributions.
   */
  private async getDeclarationData(declarationId: string) {
    const declaration = await this.prisma.customsDeclaration.findUnique({
      where: { id: declarationId },
      include: {
        lines: {
          include: { sourceItems: true },
        },
      },
    });

    if (!declaration) {
      throw new NotFoundException(
        `Customs declaration with ID ${declarationId} not found`,
      );
    }

    // Calculate total taxes
    const totals = {
      importDuty: Number(declaration.totalImportDuty),
      vat: Number(declaration.totalVat),
      specialTax: Number(declaration.totalSpecialTax),
      otherTax:
        Number(declaration.totalEnvironmentalTax) +
        Number(declaration.totalAntiDumpingDuty),
    };

    const totalPayable = totals.importDuty + totals.vat + totals.specialTax + totals.otherTax;

    if (totalPayable === 0) {
      throw new BadRequestException(
        `No taxes calculated for declaration ${declaration.code}. ` +
          'Run duty calculation first.',
      );
    }

    // Aggregate contributed values by order
    const orderMap = new Map<
      string,
      { orderId: string; orderCode: string; contributedValue: number }
    >();

    const allSourceItems = declaration.lines.flatMap((l) => l.sourceItems);
    const orderIds = [...new Set(allSourceItems.map((si) => si.orderId))];

    // Look up order codes
    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, code: true },
    });
    const orderCodeMap = new Map(orders.map((o) => [o.id, o.code]));

    for (const sourceItem of allSourceItems) {
      const existing = orderMap.get(sourceItem.orderId) ?? {
        orderId: sourceItem.orderId,
        orderCode: orderCodeMap.get(sourceItem.orderId) ?? 'UNKNOWN',
        contributedValue: 0,
      };

      existing.contributedValue += Number(sourceItem.contributedValue);
      orderMap.set(sourceItem.orderId, existing);
    }

    const orderContributions = Array.from(orderMap.values());

    return { declaration, orderContributions, totals };
  }

  /**
   * Persists tax allocations and creates OrderExtraCharge records.
   */
  private async saveAllocations(
    declarationId: string,
    declarationCode: string,
    allocations: TaxAllocationResult[],
    method: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      // Delete existing allocations for this declaration (replace strategy)
      await tx.customsTaxAllocation.deleteMany({
        where: { declarationId },
      });

      // Create new allocations
      await tx.customsTaxAllocation.createMany({
        data: allocations.map((a) => ({
          declarationId,
          orderId: a.orderId,
          importDuty: new Decimal(a.importDuty),
          vat: new Decimal(a.vat),
          specialTax: new Decimal(a.specialTax),
          otherTax: new Decimal(a.otherTax),
          totalAllocated: new Decimal(a.totalAllocated),
          method,
          proportion: new Decimal(a.proportion),
        })),
      });

      // Create OrderExtraCharge records for each order
      for (const allocation of allocations) {
        // Delete existing CUSTOMS extra charges for this order + declaration combo
        await tx.orderExtraCharge.deleteMany({
          where: {
            orderId: allocation.orderId,
            chargeType: 'CUSTOMS',
            description: { contains: declarationCode },
          },
        });

        if (allocation.totalAllocated > 0) {
          await tx.orderExtraCharge.create({
            data: {
              orderId: allocation.orderId,
              chargeType: 'CUSTOMS',
              amount: new Decimal(allocation.totalAllocated),
              currency: 'VND',
              description:
                `Thue hai quan tu to khai ${declarationCode} ` +
                `(NK: ${allocation.importDuty}, VAT: ${allocation.vat}, ` +
                `TTDB: ${allocation.specialTax}, Khac: ${allocation.otherTax})`,
              status: 'APPROVED',
              createdBy: 'SYSTEM',
            },
          });
        }
      }

      // Mark declaration as tax-allocated
      await tx.customsDeclaration.update({
        where: { id: declarationId },
        data: {
          taxAllocated: true,
          taxAllocatedAt: new Date(),
        },
      });
    });

    // Emit event after successful transaction
    this.eventEmitter.emit('customs.tax.allocated', {
      declarationId,
      declarationCode,
      method,
      allocations: allocations.map((a) => ({
        orderId: a.orderId,
        orderCode: a.orderCode,
        totalAllocated: a.totalAllocated,
      })),
    });

    this.logger.log(
      `Tax allocated by ${method} for declaration ${declarationCode}: ` +
        `${allocations.reduce((sum, a) => sum + a.totalAllocated, 0)} VND across ${allocations.length} orders`,
    );
  }
}
