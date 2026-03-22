import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomsDeclarationRepository {
  private readonly logger = new Logger(CustomsDeclarationRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate the next declaration code: CD-YYYYMM-XXXX.
   */
  async generateCode(): Promise<string> {
    const now = new Date();
    const yearMonth = [String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0')].join(
      '',
    );

    const prefix = `CD-${yearMonth}`;

    const latest = await this.prisma.customsDeclaration.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latest) {
      const lastSequence = parseInt(latest.code.split('-').pop() || '0', 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Create a new customs declaration with initial lines.
   */
  async create(data: Prisma.CustomsDeclarationCreateInput) {
    return this.prisma.customsDeclaration.create({
      data,
      include: {
        lines: {
          where: { deletedAt: null },
          include: {
            sourceItems: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
        container: {
          select: { id: true, code: true, shippingRoute: true },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Find all declarations with pagination and filters.
   * Uses relationLoadStrategy: "join" to avoid extra round-trips for container relation.
   */
  async findAll(
    where: Prisma.CustomsDeclarationWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.CustomsDeclarationOrderByWithRelationInput,
  ) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customsDeclaration.findMany({
        relationLoadStrategy: 'join',
        where,
        skip,
        take,
        orderBy,
        include: {
          container: {
            select: { id: true, code: true, shippingRoute: true },
          },
          _count: {
            select: {
              lines: true,
              complianceAlerts: true,
            },
          },
        },
      }),
      this.prisma.customsDeclaration.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Find a declaration by ID with full relations.
   * Uses relationLoadStrategy: "join" to avoid N+1 on nested line relations.
   */
  async findById(id: string) {
    return this.prisma.customsDeclaration.findUnique({
      relationLoadStrategy: 'join',
      where: { id },
      include: {
        container: {
          select: {
            id: true,
            code: true,
            shippingRoute: true,
            status: true,
            vesselName: true,
            origin: true,
            destination: true,
          },
        },
        lines: {
          where: { deletedAt: null },
          include: {
            sourceItems: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
        complianceAlerts: {
          orderBy: { createdAt: 'desc' },
        },
        taxAllocations: {
          orderBy: { createdAt: 'desc' },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
  }

  /**
   * Update a declaration header by ID.
   */
  async update(id: string, data: Prisma.CustomsDeclarationUpdateInput) {
    return this.prisma.customsDeclaration.update({
      where: { id },
      data,
      include: {
        container: {
          select: { id: true, code: true, shippingRoute: true },
        },
        lines: {
          where: { deletedAt: null },
          include: { sourceItems: true },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });
  }

  /**
   * Update a single declaration line.
   */
  async updateLine(lineId: string, data: Prisma.CustomsDeclarationLineUpdateInput) {
    return this.prisma.customsDeclarationLine.update({
      where: { id: lineId },
      data,
      include: { sourceItems: true },
    });
  }

  /**
   * Delete a single declaration line.
   */
  async deleteLine(lineId: string) {
    return this.prisma.customsDeclarationLine.update({
      where: { id: lineId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Create a new line on a declaration.
   */
  async createLine(
    declarationId: string,
    data: Omit<Prisma.CustomsDeclarationLineCreateWithoutDeclarationInput, 'lineNumber'>,
  ) {
    // Determine next line number
    const maxLine = await this.prisma.customsDeclarationLine.findFirst({
      where: { declarationId },
      orderBy: { lineNumber: 'desc' },
      select: { lineNumber: true },
    });

    const lineNumber = (maxLine?.lineNumber ?? 0) + 1;

    return this.prisma.customsDeclarationLine.create({
      data: {
        ...data,
        lineNumber,
        declaration: { connect: { id: declarationId } },
      },
      include: { sourceItems: true },
    });
  }

  /**
   * Create source item junction records for a line.
   */
  async createSourceItems(
    lineId: string,
    items: Array<{
      orderItemId: string;
      orderId: string;
      packageId?: string;
      contributedQuantity: number;
      contributedValue: number;
    }>,
  ) {
    if (items.length === 0) return [];

    const createData = items.map((item) => ({
      lineId,
      orderItemId: item.orderItemId,
      orderId: item.orderId,
      packageId: item.packageId ?? null,
      contributedQuantity: item.contributedQuantity,
      contributedValue: item.contributedValue,
    }));

    await this.prisma.customsLineSourceItem.createMany({
      data: createData,
    });

    return this.prisma.customsLineSourceItem.findMany({
      where: { lineId },
    });
  }

  /**
   * Delete all source items for a line.
   */
  async deleteSourceItems(lineId: string) {
    return this.prisma.customsLineSourceItem.deleteMany({
      where: { lineId },
    });
  }

  /**
   * Create a status history record.
   */
  async createStatusHistory(data: {
    declarationId: string;
    fromStatus?: string;
    toStatus: string;
    channel?: string;
    note?: string;
    changedBy: string;
  }) {
    return this.prisma.customsStatusHistory.create({
      data: {
        declarationId: data.declarationId,
        fromStatus: data.fromStatus ?? null,
        toStatus: data.toStatus,
        channel: (data.channel as any) ?? null,
        note: data.note ?? null,
        changedBy: data.changedBy,
      },
    });
  }

  /**
   * Find a declaration by container ID.
   */
  async findByContainerId(containerId: string) {
    return this.prisma.customsDeclaration.findFirst({
      where: { containerId },
      include: {
        lines: {
          where: { deletedAt: null },
          include: { sourceItems: true },
          orderBy: { lineNumber: 'asc' },
        },
        container: {
          select: { id: true, code: true, shippingRoute: true },
        },
      },
    });
  }

  /**
   * Find a declaration line by ID with its declaration.
   */
  async findLineById(lineId: string) {
    return this.prisma.customsDeclarationLine.findUnique({
      where: { id: lineId },
      include: {
        sourceItems: true,
        declaration: {
          select: {
            id: true,
            code: true,
            status: true,
            containerId: true,
          },
        },
      },
    });
  }

  /**
   * Find lines by declaration ID.
   */
  async findLinesByDeclarationId(declarationId: string) {
    return this.prisma.customsDeclarationLine.findMany({
      where: { declarationId, deletedAt: null },
      include: { sourceItems: true },
      orderBy: { lineNumber: 'asc' },
    });
  }

  /**
   * Search HS code library.
   */
  async searchHSCodes(query: string, limit = 20) {
    return this.prisma.hSCodeLibrary.findMany({
      where: {
        isActive: true,
        OR: [
          { code: { contains: query, mode: 'insensitive' } },
          { descriptionVi: { contains: query, mode: 'insensitive' } },
          { descriptionEn: { contains: query, mode: 'insensitive' } },
          {
            keywords: {
              some: {
                keyword: { contains: query, mode: 'insensitive' },
              },
            },
          },
        ],
      },
      include: { keywords: true },
      orderBy: [{ usageCount: 'desc' }, { code: 'asc' }],
      take: limit,
    });
  }

  /**
   * Suggest HS code based on product description keywords.
   */
  async suggestHSCode(description: string, limit = 5) {
    const words = description
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (words.length === 0) return [];

    return this.prisma.hSCodeLibrary.findMany({
      where: {
        isActive: true,
        OR: [
          ...words.map((word) => ({
            keywords: {
              some: {
                keyword: { contains: word, mode: 'insensitive' as const },
              },
            },
          })),
          ...words.map((word) => ({
            descriptionVi: { contains: word, mode: 'insensitive' as const },
          })),
          ...words.map((word) => ({
            descriptionEn: { contains: word, mode: 'insensitive' as const },
          })),
        ],
      },
      include: { keywords: true },
      orderBy: [{ usageCount: 'desc' }, { code: 'asc' }],
      take: limit,
    });
  }

  /**
   * Increment HS code usage count.
   */
  async incrementHSCodeUsage(hsCode: string) {
    try {
      await this.prisma.hSCodeLibrary.update({
        where: { code: hsCode },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });
    } catch {
      // Silently ignore if HS code not found in library
      this.logger.debug(`HS code ${hsCode} not found in library for usage tracking`);
    }
  }

  /**
   * Find compliance rules matching an HS code.
   */
  async findMatchingComplianceRules(_hsCode: string) {
    return this.prisma.complianceRule.findMany({
      where: {
        isActive: true,
      },
    });
  }

  /**
   * Find all active compliance rules.
   */
  async findAllComplianceRules() {
    return this.prisma.complianceRule.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a compliance rule.
   */
  async createComplianceRule(data: Prisma.ComplianceRuleCreateInput) {
    return this.prisma.complianceRule.create({ data });
  }

  /**
   * Update a compliance rule.
   */
  async updateComplianceRule(id: string, data: Prisma.ComplianceRuleUpdateInput) {
    return this.prisma.complianceRule.update({
      where: { id },
      data,
    });
  }

  /**
   * Create compliance alerts for a declaration.
   */
  async createComplianceAlerts(
    alerts: Array<{
      declarationId: string;
      lineId?: string;
      alertType: string;
      severity: string;
      message: string;
      hsCode?: string;
    }>,
  ) {
    if (alerts.length === 0) return [];

    await this.prisma.complianceAlert.createMany({
      data: alerts.map((a) => ({
        declarationId: a.declarationId,
        lineId: a.lineId ?? null,
        alertType: a.alertType,
        severity: a.severity,
        message: a.message,
        hsCode: a.hsCode ?? null,
      })),
    });

    return this.prisma.complianceAlert.findMany({
      where: { declarationId: alerts[0].declarationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Acknowledge a compliance alert.
   */
  async acknowledgeAlert(alertId: string, userId: string) {
    return this.prisma.complianceAlert.update({
      where: { id: alertId },
      data: {
        isAcknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });
  }

  /**
   * Delete existing tax allocations for a declaration.
   */
  async deleteTaxAllocations(declarationId: string) {
    return this.prisma.customsTaxAllocation.deleteMany({
      where: { declarationId },
    });
  }

  /**
   * Create tax allocation records.
   */
  async createTaxAllocations(
    allocations: Array<{
      declarationId: string;
      orderId: string;
      importDuty: number;
      vat: number;
      specialTax: number;
      otherTax: number;
      totalAllocated: number;
      method: string;
      proportion: number;
    }>,
  ) {
    if (allocations.length === 0) return [];

    await this.prisma.customsTaxAllocation.createMany({
      data: allocations,
    });

    return this.prisma.customsTaxAllocation.findMany({
      where: { declarationId: allocations[0].declarationId },
    });
  }

  /**
   * Delete all compliance alerts for a declaration.
   */
  async deleteComplianceAlerts(declarationId: string) {
    return this.prisma.complianceAlert.deleteMany({
      where: { declarationId },
    });
  }
}
