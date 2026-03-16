import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface GroupingSuggestion {
  hsCodePrefix: string;
  lineIds: string[];
  suggestedDescription: string;
  totalQuantity: number;
  totalValue: number;
}

/**
 * Service for grouping and ungrouping customs declaration lines.
 *
 * Customs declarations often require consolidating multiple individual
 * order items into grouped lines by HS code to reduce the number of
 * line items on the declaration form. This service handles:
 *  - Auto-grouping by HS code
 *  - Custom grouping of selected lines
 *  - Ungrouping back to individual source items
 *  - Suggesting optimal groupings
 */
@Injectable()
export class GroupingService {
  private readonly logger = new Logger(GroupingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Groups all lines that share the same declared HS code.
   *
   * For each HS code group:
   *  - Merges into a single line (sums quantities, values, weights)
   *  - Combines descriptions
   *  - Remaps all sourceItems to the new merged line
   *
   * @param declarationId - The customs declaration ID
   * @returns Array of new merged declaration lines
   */
  async groupByHsCode(declarationId: string) {
    const declaration = await this.prisma.customsDeclaration.findUnique({
      where: { id: declarationId },
      include: {
        lines: {
          where: { deletedAt: null },
          include: { sourceItems: true },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${declarationId} not found`);
    }

    if (declaration.lines.length === 0) {
      return [];
    }

    // Group lines by declared HS code
    const groups = new Map<string, typeof declaration.lines>();
    for (const line of declaration.lines) {
      const hsCode = line.declaredHsCode;
      const existing = groups.get(hsCode) ?? [];
      existing.push(line);
      groups.set(hsCode, existing);
    }

    // Only process groups with more than one line
    const groupsToMerge = Array.from(groups.entries()).filter(([, lines]) => lines.length > 1);

    if (groupsToMerge.length === 0) {
      this.logger.log(
        `No duplicate HS codes found in declaration ${declaration.code}. Nothing to group.`,
      );
      return declaration.lines;
    }

    return this.prisma.$transaction(async (tx) => {
      const newLines = [];
      let lineNumber = 1;

      // First, keep ungrouped lines (groups of 1) as-is but renumber them
      for (const [, lines] of groups.entries()) {
        if (lines.length === 1) {
          await tx.customsDeclarationLine.update({
            where: { id: lines[0].id },
            data: { lineNumber },
          });
          newLines.push(lines[0]);
          lineNumber++;
        }
      }

      // Now merge grouped lines
      for (const [hsCode, lines] of groupsToMerge) {
        const merged = this.mergeLineData(lines);
        const allSourceItems = lines.flatMap((l) => l.sourceItems);

        // Create the new merged line
        const newLine = await tx.customsDeclarationLine.create({
          data: {
            declarationId,
            lineNumber,
            declaredHsCode: hsCode,
            declaredDescription: merged.declaredDescription,
            declaredQuantity: new Decimal(merged.declaredQuantity),
            declaredUnit: merged.declaredUnit,
            declaredUnitPrice: new Decimal(merged.declaredUnitPrice),
            declaredTotalValue: new Decimal(merged.declaredTotalValue),
            declaredCountryOrigin: merged.declaredCountryOrigin,
            declaredNetWeight: merged.declaredNetWeight
              ? new Decimal(merged.declaredNetWeight)
              : null,
            declaredGrossWeight: merged.declaredGrossWeight
              ? new Decimal(merged.declaredGrossWeight)
              : null,
            internalDescription: merged.internalDescription,
            internalQuantity: new Decimal(merged.internalQuantity),
            internalUnitPrice: new Decimal(merged.internalUnitPrice),
            internalTotalValue: new Decimal(merged.internalTotalValue),
            importDutyRate: new Decimal(merged.importDutyRate),
            vatRate: new Decimal(merged.vatRate),
            specialTaxRate: new Decimal(merged.specialTaxRate),
          },
        });

        // Remap all source items to the new line
        if (allSourceItems.length > 0) {
          await tx.customsLineSourceItem.updateMany({
            where: { id: { in: allSourceItems.map((si) => si.id) } },
            data: { lineId: newLine.id },
          });
        }

        // Delete old lines
        const oldLineIds = lines.map((l) => l.id);
        await tx.customsDeclarationLine.updateMany({
          where: { id: { in: oldLineIds } },
          data: { deletedAt: new Date() },
        });

        newLines.push(newLine);
        lineNumber++;
      }

      this.logger.log(
        `Grouped ${groupsToMerge.length} HS code groups in declaration ${declaration.code}. ` +
          `Result: ${newLines.length} lines.`,
      );

      return newLines;
    });
  }

  /**
   * Groups selected lines into a single line with custom description and HS code.
   *
   * @param declarationId - The customs declaration ID
   * @param dto - Grouping parameters: lineIds, description, HS code, unit
   * @returns The new merged declaration line
   */
  async groupCustom(
    declarationId: string,
    dto: {
      lineIds: string[];
      declaredDescription: string;
      declaredHsCode: string;
      declaredUnit: string;
    },
  ) {
    const declaration = await this.prisma.customsDeclaration.findUnique({
      where: { id: declarationId },
      select: { id: true, code: true },
    });

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${declarationId} not found`);
    }

    if (dto.lineIds.length < 2) {
      throw new BadRequestException('At least 2 lines must be selected for grouping');
    }

    // Load the selected lines with source items
    const lines = await this.prisma.customsDeclarationLine.findMany({
      where: { id: { in: dto.lineIds }, deletedAt: null },
      include: { sourceItems: true },
    });

    if (lines.length !== dto.lineIds.length) {
      const foundIds = lines.map((l) => l.id);
      const missing = dto.lineIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(`Lines not found: ${missing.join(', ')}`);
    }

    // Validate all lines belong to this declaration
    const foreignLines = lines.filter((l) => l.declarationId !== declarationId);
    if (foreignLines.length > 0) {
      throw new BadRequestException('All lines must belong to the specified declaration');
    }

    return this.prisma.$transaction(async (tx) => {
      const merged = this.mergeLineData(lines);
      const allSourceItems = lines.flatMap((l) => l.sourceItems);

      // Get the next available line number
      const maxLine = await tx.customsDeclarationLine.findFirst({
        where: { declarationId },
        orderBy: { lineNumber: 'desc' },
        select: { lineNumber: true },
      });
      const nextLineNumber = (maxLine?.lineNumber ?? 0) + 1;

      // Create the new merged line with custom description and HS code
      const newLine = await tx.customsDeclarationLine.create({
        data: {
          declarationId,
          lineNumber: nextLineNumber,
          declaredHsCode: dto.declaredHsCode,
          declaredDescription: dto.declaredDescription,
          declaredQuantity: new Decimal(merged.declaredQuantity),
          declaredUnit: dto.declaredUnit,
          declaredUnitPrice: new Decimal(merged.declaredUnitPrice),
          declaredTotalValue: new Decimal(merged.declaredTotalValue),
          declaredCountryOrigin: merged.declaredCountryOrigin,
          declaredNetWeight: merged.declaredNetWeight
            ? new Decimal(merged.declaredNetWeight)
            : null,
          declaredGrossWeight: merged.declaredGrossWeight
            ? new Decimal(merged.declaredGrossWeight)
            : null,
          internalDescription: merged.internalDescription,
          internalQuantity: new Decimal(merged.internalQuantity),
          internalUnitPrice: new Decimal(merged.internalUnitPrice),
          internalTotalValue: new Decimal(merged.internalTotalValue),
          importDutyRate: new Decimal(merged.importDutyRate),
          vatRate: new Decimal(merged.vatRate),
          specialTaxRate: new Decimal(merged.specialTaxRate),
        },
      });

      // Remap all source items to the new line
      if (allSourceItems.length > 0) {
        await tx.customsLineSourceItem.updateMany({
          where: { id: { in: allSourceItems.map((si) => si.id) } },
          data: { lineId: newLine.id },
        });
      }

      // Delete old lines
      await tx.customsDeclarationLine.updateMany({
        where: { id: { in: dto.lineIds } },
        data: { deletedAt: new Date() },
      });

      this.logger.log(
        `Custom grouped ${dto.lineIds.length} lines into one (HS: ${dto.declaredHsCode}) ` +
          `in declaration ${declaration.code}`,
      );

      return newLine;
    });
  }

  /**
   * Ungroups a merged line back into individual lines based on source items.
   *
   * Each source item becomes its own declaration line, restoring the
   * original per-item data from the source records.
   *
   * @param lineId - The merged line ID to ungroup
   * @returns Array of new individual declaration lines
   */
  async ungroupLine(lineId: string) {
    const line = await this.prisma.customsDeclarationLine.findUnique({
      where: { id: lineId },
      include: { sourceItems: true },
    });

    if (!line) {
      throw new NotFoundException(`Customs declaration line with ID ${lineId} not found`);
    }

    if (line.sourceItems.length <= 1) {
      throw new BadRequestException('This line has only one source item and cannot be ungrouped');
    }

    return this.prisma.$transaction(async (tx) => {
      // Get the current max line number for renumbering
      const maxLine = await tx.customsDeclarationLine.findFirst({
        where: { declarationId: line.declarationId },
        orderBy: { lineNumber: 'desc' },
        select: { lineNumber: true },
      });
      let nextLineNumber = (maxLine?.lineNumber ?? 0) + 1;

      const newLines = [];

      for (const sourceItem of line.sourceItems) {
        // Create individual line from source item data
        const newLine = await tx.customsDeclarationLine.create({
          data: {
            declarationId: line.declarationId,
            lineNumber: nextLineNumber,
            declaredHsCode: line.declaredHsCode,
            declaredDescription: `${line.declaredDescription} (item)`,
            declaredQuantity: sourceItem.contributedQuantity,
            declaredUnit: line.declaredUnit,
            declaredUnitPrice: line.declaredUnitPrice,
            declaredTotalValue: sourceItem.contributedValue,
            declaredCountryOrigin: line.declaredCountryOrigin,
            internalDescription: `${line.internalDescription} (item)`,
            internalQuantity: sourceItem.contributedQuantity,
            internalUnitPrice: line.internalUnitPrice,
            internalTotalValue: sourceItem.contributedValue,
            importDutyRate: line.importDutyRate,
            vatRate: line.vatRate,
            specialTaxRate: line.specialTaxRate,
          },
        });

        // Remap source item to the new line
        await tx.customsLineSourceItem.update({
          where: { id: sourceItem.id },
          data: { lineId: newLine.id },
        });

        newLines.push(newLine);
        nextLineNumber++;
      }

      // Delete the original grouped line
      await tx.customsDeclarationLine.update({
        where: { id: lineId },
        data: { deletedAt: new Date() },
      });

      this.logger.log(`Ungrouped line ${lineId} into ${newLines.length} individual lines`);

      return newLines;
    });
  }

  /**
   * Suggests optimal line groupings based on HS code prefix (first 6 digits).
   *
   * Returns suggestions for lines that share the same 6-digit HS heading
   * and could be consolidated.
   *
   * @param declarationId - The customs declaration ID
   * @returns Array of grouping suggestions
   */
  async suggestGroupings(declarationId: string): Promise<GroupingSuggestion[]> {
    const declaration = await this.prisma.customsDeclaration.findUnique({
      where: { id: declarationId },
      include: {
        lines: { where: { deletedAt: null }, orderBy: { lineNumber: 'asc' } },
      },
    });

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${declarationId} not found`);
    }

    // Group by first 6 digits of HS code (heading level)
    const prefixGroups = new Map<
      string,
      { lineIds: string[]; descriptions: string[]; totalQuantity: number; totalValue: number }
    >();

    for (const line of declaration.lines) {
      // Extract first 6 digits (remove dots): "3926.90.99" -> "392690"
      const prefix = line.declaredHsCode.replace(/\./g, '').substring(0, 6);

      const existing = prefixGroups.get(prefix) ?? {
        lineIds: [],
        descriptions: [],
        totalQuantity: 0,
        totalValue: 0,
      };

      existing.lineIds.push(line.id);
      existing.descriptions.push(line.declaredDescription);
      existing.totalQuantity += Number(line.declaredQuantity);
      existing.totalValue += Number(line.declaredTotalValue);

      prefixGroups.set(prefix, existing);
    }

    // Only suggest groups with 2+ lines
    const suggestions: GroupingSuggestion[] = [];
    for (const [hsCodePrefix, group] of prefixGroups.entries()) {
      if (group.lineIds.length < 2) continue;

      // Build a suggested description from the unique descriptions
      const uniqueDescriptions = [...new Set(group.descriptions)];
      const suggestedDescription =
        uniqueDescriptions.length <= 3
          ? uniqueDescriptions.join('; ')
          : `${uniqueDescriptions.slice(0, 3).join('; ')} va ${uniqueDescriptions.length - 3} mat hang khac`;

      suggestions.push({
        hsCodePrefix,
        lineIds: group.lineIds,
        suggestedDescription,
        totalQuantity: Math.round(group.totalQuantity * 1000) / 1000,
        totalValue: Math.round(group.totalValue * 100) / 100,
      });
    }

    return suggestions;
  }

  /**
   * Merges multiple line data into a single set of values.
   * Sums quantities, values, and weights; combines descriptions.
   */
  private mergeLineData(
    lines: Array<{
      declaredDescription: string;
      declaredQuantity: any;
      declaredUnit: string;
      declaredUnitPrice: any;
      declaredTotalValue: any;
      declaredCountryOrigin: string;
      declaredNetWeight: any;
      declaredGrossWeight: any;
      internalDescription: string;
      internalQuantity: any;
      internalUnitPrice: any;
      internalTotalValue: any;
      importDutyRate: any;
      vatRate: any;
      specialTaxRate: any;
    }>,
  ) {
    const declaredQuantity = lines.reduce((sum, l) => sum + Number(l.declaredQuantity), 0);
    const declaredTotalValue = lines.reduce((sum, l) => sum + Number(l.declaredTotalValue), 0);
    const internalQuantity = lines.reduce((sum, l) => sum + Number(l.internalQuantity), 0);
    const internalTotalValue = lines.reduce((sum, l) => sum + Number(l.internalTotalValue), 0);
    const declaredNetWeight = lines.reduce(
      (sum, l) => sum + (l.declaredNetWeight ? Number(l.declaredNetWeight) : 0),
      0,
    );
    const declaredGrossWeight = lines.reduce(
      (sum, l) => sum + (l.declaredGrossWeight ? Number(l.declaredGrossWeight) : 0),
      0,
    );

    // Combine descriptions (unique values)
    const uniqueDeclaredDesc = [...new Set(lines.map((l) => l.declaredDescription))];
    const uniqueInternalDesc = [...new Set(lines.map((l) => l.internalDescription))];

    // Use weighted average unit price
    const declaredUnitPrice =
      declaredQuantity > 0
        ? Math.round((declaredTotalValue / declaredQuantity) * 10000) / 10000
        : 0;
    const internalUnitPrice =
      internalQuantity > 0
        ? Math.round((internalTotalValue / internalQuantity) * 10000) / 10000
        : 0;

    // Use the first line's rates (they should be identical within an HS code group)
    const firstLine = lines[0];

    return {
      declaredDescription: uniqueDeclaredDesc.join('; '),
      declaredQuantity,
      declaredUnit: firstLine.declaredUnit,
      declaredUnitPrice,
      declaredTotalValue,
      declaredCountryOrigin: firstLine.declaredCountryOrigin,
      declaredNetWeight: declaredNetWeight || null,
      declaredGrossWeight: declaredGrossWeight || null,
      internalDescription: uniqueInternalDesc.join('; '),
      internalQuantity,
      internalUnitPrice,
      internalTotalValue,
      importDutyRate: Number(firstLine.importDutyRate),
      vatRate: Number(firstLine.vatRate),
      specialTaxRate: Number(firstLine.specialTaxRate),
    };
  }
}
