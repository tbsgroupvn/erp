import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface DutyBreakdown {
  cifValue: number;
  importDuty: number;
  specialTax: number;
  vat: number;
  environmentalTax: number;
  antiDumpingDuty: number;
  lineTotalTax: number;
}

/**
 * Service for calculating import duties and taxes for customs declaration lines.
 *
 * Follows the Vietnamese customs duty calculation formula:
 *   CIF = declared value + proportional freight + proportional insurance
 *   Import Duty = CIF * import duty rate
 *   Special Tax (TTDB) = CIF * special tax rate
 *   VAT base = CIF + Import Duty + Special Tax
 *   VAT = VAT base * VAT rate
 */
@Injectable()
export class DutyCalculatorService {
  private readonly logger = new Logger(DutyCalculatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates duty breakdown for a single declaration line.
   *
   * @param line - Line data with declared values and tax rates
   * @param freight - Total freight for the declaration
   * @param insurance - Total insurance for the declaration
   * @param totalDeclaredValue - Sum of all line values (for proportional allocation)
   * @returns DutyBreakdown with all tax components
   */
  calculateLineDuty(
    line: {
      declaredTotalValue: number;
      declaredNetWeight?: number;
      importDutyRate: number;
      vatRate: number;
      specialTaxRate: number;
    },
    freight: number,
    insurance: number,
    totalDeclaredValue: number,
  ): DutyBreakdown {
    const lineValue = line.declaredTotalValue;

    // Avoid division by zero when totalDeclaredValue is 0
    const proportion = totalDeclaredValue > 0
      ? lineValue / totalDeclaredValue
      : 0;

    // Proportional freight and insurance allocation
    const proportionalFreight = Math.round(freight * proportion * 100) / 100;
    const proportionalInsurance = Math.round(insurance * proportion * 100) / 100;

    // CIF value = line declared value + proportional freight + proportional insurance
    const cifValue = Math.round((lineValue + proportionalFreight + proportionalInsurance) * 100) / 100;

    // Import duty = CIF * import duty rate
    const importDuty = Math.round(cifValue * line.importDutyRate * 100) / 100;

    // Special consumption tax (TTDB) = CIF * special tax rate
    const specialTax = Math.round(cifValue * line.specialTaxRate * 100) / 100;

    // VAT base = CIF + import duty + special tax
    const vatBase = cifValue + importDuty + specialTax;

    // VAT = VAT base * VAT rate
    const vat = Math.round(vatBase * line.vatRate * 100) / 100;

    // Placeholders for future implementation
    const environmentalTax = 0;
    const antiDumpingDuty = 0;

    // Total line tax
    const lineTotalTax = Math.round(
      (importDuty + specialTax + vat + environmentalTax + antiDumpingDuty) * 100,
    ) / 100;

    return {
      cifValue,
      importDuty,
      specialTax,
      vat,
      environmentalTax,
      antiDumpingDuty,
      lineTotalTax,
    };
  }

  /**
   * Recalculates all duty amounts for a declaration.
   *
   * Loads all lines, computes duty for each, updates line amounts,
   * then sums totals and updates the declaration header.
   *
   * @param declarationId - The customs declaration ID
   * @returns Updated CustomsDeclaration with recalculated totals
   */
  async recalculateDeclaration(declarationId: string) {
    const declaration = await this.prisma.customsDeclaration.findUnique({
      where: { id: declarationId },
      include: { lines: true },
    });

    if (!declaration) {
      throw new NotFoundException(
        `Customs declaration with ID ${declarationId} not found`,
      );
    }

    const freight = Number(declaration.declaredFreight);
    const insurance = Number(declaration.declaredInsurance);
    const totalDeclaredValue = declaration.lines.reduce(
      (sum, line) => sum + Number(line.declaredTotalValue),
      0,
    );

    // Header totals accumulators
    let totalImportDuty = 0;
    let totalVat = 0;
    let totalSpecialTax = 0;
    let totalEnvironmentalTax = 0;
    let totalAntiDumpingDuty = 0;

    // Calculate and update each line
    const lineUpdates = declaration.lines.map((line) => {
      const breakdown = this.calculateLineDuty(
        {
          declaredTotalValue: Number(line.declaredTotalValue),
          declaredNetWeight: line.declaredNetWeight
            ? Number(line.declaredNetWeight)
            : undefined,
          importDutyRate: Number(line.importDutyRate),
          vatRate: Number(line.vatRate),
          specialTaxRate: Number(line.specialTaxRate),
        },
        freight,
        insurance,
        totalDeclaredValue,
      );

      totalImportDuty += breakdown.importDuty;
      totalVat += breakdown.vat;
      totalSpecialTax += breakdown.specialTax;
      totalEnvironmentalTax += breakdown.environmentalTax;
      totalAntiDumpingDuty += breakdown.antiDumpingDuty;

      return this.prisma.customsDeclarationLine.update({
        where: { id: line.id },
        data: {
          importDutyAmount: new Decimal(breakdown.importDuty),
          vatAmount: new Decimal(breakdown.vat),
          specialTaxAmount: new Decimal(breakdown.specialTax),
          environmentalTax: new Decimal(breakdown.environmentalTax),
          antiDumpingDuty: new Decimal(breakdown.antiDumpingDuty),
          lineTotalTax: new Decimal(breakdown.lineTotalTax),
        },
      });
    });

    // Round header totals
    totalImportDuty = Math.round(totalImportDuty * 100) / 100;
    totalVat = Math.round(totalVat * 100) / 100;
    totalSpecialTax = Math.round(totalSpecialTax * 100) / 100;
    totalEnvironmentalTax = Math.round(totalEnvironmentalTax * 100) / 100;
    totalAntiDumpingDuty = Math.round(totalAntiDumpingDuty * 100) / 100;
    const totalPayable = Math.round(
      (totalImportDuty + totalVat + totalSpecialTax + totalEnvironmentalTax + totalAntiDumpingDuty) * 100,
    ) / 100;

    // Execute all line updates and the header update in a transaction
    const [, ...updatedLines] = await this.prisma.$transaction([
      // Update header totals
      this.prisma.customsDeclaration.update({
        where: { id: declarationId },
        data: {
          declaredTotalValue: new Decimal(totalDeclaredValue),
          totalImportDuty: new Decimal(totalImportDuty),
          totalVat: new Decimal(totalVat),
          totalSpecialTax: new Decimal(totalSpecialTax),
          totalEnvironmentalTax: new Decimal(totalEnvironmentalTax),
          totalAntiDumpingDuty: new Decimal(totalAntiDumpingDuty),
          totalPayable: new Decimal(totalPayable),
        },
      }),
      ...lineUpdates,
    ]);

    this.logger.log(
      `Recalculated duties for declaration ${declaration.code}: ` +
        `ImportDuty=${totalImportDuty}, VAT=${totalVat}, SpecialTax=${totalSpecialTax}, ` +
        `Total payable=${totalPayable}`,
    );

    // Return the updated declaration
    return this.prisma.customsDeclaration.findUnique({
      where: { id: declarationId },
      include: { lines: true },
    });
  }
}
