import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, CustomsDeclarationStatus, CustomsChannel } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CustomsDeclarationRepository } from './customs-declaration.repository';
import { CustomsStatusMachine } from './domain/customs-status.machine';
import { DutyCalculatorService } from './domain/duty-calculator.service';
import { GroupingService } from './domain/grouping.service';
import { HsCodeSuggestionService } from './domain/hs-code-suggestion.service';
import { ComplianceCheckerService } from './domain/compliance-checker.service';
import { TaxAllocationService } from './domain/tax-allocation.service';
import { EcusExportService } from './domain/ecus-export.service';
import { DeclarationQueryDto } from './dto/declaration-query.dto';
import { UpdateDeclarationHeaderDto } from './dto/update-declaration-header.dto';
import { UpdateDeclarationLineDto } from './dto/update-declaration-line.dto';
import { GroupItemsDto } from './dto/group-items.dto';

@Injectable()
export class CustomsDeclarationService {
  private readonly logger = new Logger(CustomsDeclarationService.name);

  constructor(
    private readonly repository: CustomsDeclarationRepository,
    private readonly statusMachine: CustomsStatusMachine,
    private readonly dutyCalculator: DutyCalculatorService,
    private readonly groupingService: GroupingService,
    private readonly hsCodeSuggestion: HsCodeSuggestionService,
    private readonly complianceChecker: ComplianceCheckerService,
    private readonly taxAllocation: TaxAllocationService,
    private readonly ecusExport: EcusExportService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a customs declaration from a container.
   *
   * Flow:
   *  1. Validate the container exists and has packages/orders
   *  2. Check for existing declaration for this container
   *  3. Load container with packages -> orders -> orderItems
   *  4. Create DRAFT declaration pre-populated from container data
   *  5. For each OrderItem in the container's orders, create a CustomsDeclarationLine
   *     (one-to-one initially) with internal data from the real order item and
   *     declared data initialized to the same values
   *  6. Create CustomsLineSourceItem junction records
   *  7. Emit creation event
   */
  async createFromContainer(containerId: string, userId: string) {
    // Check for existing declaration for this container
    const existing = await this.repository.findByContainerId(containerId);
    if (existing) {
      throw new ConflictException(
        `A customs declaration already exists for container ${containerId}: ${existing.code}`,
      );
    }

    // Load and validate container with orders
    const container = await this.loadContainerWithOrders(containerId);

    const code = await this.repository.generateCode();

    // Build declaration line items from container orders
    const lineInputs = this.buildDeclarationLines(container.orders);

    // Create declaration record with lines and source items in a transaction
    const declaration = await this.createDeclarationRecord(container, code, lineInputs, userId);

    // Reload with full relations
    const result = await this.repository.findById(declaration.id);

    this.eventEmitter.emit('customs.declaration.created', {
      declarationId: declaration.id,
      code: declaration.code,
      containerId,
      containerCode: container.code,
      totalLines: lineInputs.length,
      createdBy: userId,
    });

    this.logger.log(
      `Customs declaration ${code} created from container ${container.code} with ${lineInputs.length} lines`,
    );

    return result;
  }

  /**
   * Loads a container with its orders, items, customer, and packages.
   * Validates that the container exists and has orders.
   */
  private async loadContainerWithOrders(containerId: string) {
    const container = await this.prisma.container.findUnique({
      where: { id: containerId },
      include: {
        orders: {
          include: {
            items: {
              where: { deletedAt: null },
            },
            customer: {
              select: { id: true, fullName: true },
            },
            packages: {
              where: { containerId },
              select: {
                id: true,
                code: true,
                actualWeight: true,
                chargeableWeight: true,
              },
            },
          },
        },
      },
    });

    if (!container) {
      throw new NotFoundException(`Container with ID ${containerId} not found`);
    }

    if (container.orders.length === 0) {
      throw new BadRequestException(
        `Container ${container.code} has no orders. Cannot create customs declaration.`,
      );
    }

    return container;
  }

  /**
   * Builds declaration line item inputs from orders in a container.
   * Each order item becomes a separate declaration line.
   */
  private buildDeclarationLines(
    orders: Array<{
      id: string;
      items: any[];
      packages: Array<{ id: string }>;
    }>,
  ): Array<{
    lineNumber: number;
    orderItem: any;
    orderId: string;
    packageIds: string[];
  }> {
    const lineInputs: Array<{
      lineNumber: number;
      orderItem: any;
      orderId: string;
      packageIds: string[];
    }> = [];

    let lineNumber = 1;
    for (const order of orders) {
      const packageIds = order.packages.map((p) => p.id);
      for (const item of order.items) {
        lineInputs.push({
          lineNumber: lineNumber++,
          orderItem: item,
          orderId: order.id,
          packageIds,
        });
      }
    }

    return lineInputs;
  }

  /**
   * Creates the customs declaration record with lines and source items in a transaction.
   */
  private async createDeclarationRecord(
    container: { id: string; code: string; shippingRoute?: string | null; vesselName?: string | null },
    code: string,
    lineInputs: Array<{
      lineNumber: number;
      orderItem: any;
      orderId: string;
      packageIds: string[];
    }>,
    userId: string,
  ) {
    return this.prisma.executeInTransaction(async (tx) => {
      // Create the declaration header
      const decl = await tx.customsDeclaration.create({
        data: {
          code,
          containerId: container.id,
          declarationType: 'IMPORT',
          importerTaxCode: '',
          importerName: '',
          shippingMethod: container.shippingRoute ?? null,
          vesselName: container.vesselName ?? null,
          status: CustomsDeclarationStatus.DRAFT,
          createdBy: userId,
          lines: {
            create: lineInputs.map((input) => ({
              lineNumber: input.lineNumber,
              // Declared data (initialized from internal data)
              declaredHsCode: '',
              declaredDescription: input.orderItem.productName,
              declaredQuantity: input.orderItem.quantity,
              declaredUnit: 'PCS',
              declaredUnitPrice: input.orderItem.unitPrice,
              declaredTotalValue: input.orderItem.totalPrice,
              declaredCountryOrigin: 'CN',
              // Internal data (real values)
              internalDescription: input.orderItem.productName,
              internalQuantity: input.orderItem.quantity,
              internalUnitPrice: input.orderItem.unitPrice,
              internalTotalValue: input.orderItem.totalPrice,
            })),
          },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: CustomsDeclarationStatus.DRAFT,
              changedBy: userId,
              note: `Created from container ${container.code}`,
            },
          },
        },
        include: {
          lines: true,
        },
      });

      // Create source item junction records for each line
      for (let i = 0; i < decl.lines.length; i++) {
        const line = decl.lines[i];
        const input = lineInputs[i];
        if (input) {
          await tx.customsLineSourceItem.create({
            data: {
              lineId: line.id,
              orderItemId: input.orderItem.id,
              orderId: input.orderId,
              packageId: input.packageIds[0] ?? null,
              contributedQuantity: input.orderItem.quantity,
              contributedValue: input.orderItem.totalPrice,
            },
          });
        }
      }

      return decl;
    });
  }

  /**
   * Lists declarations with pagination and filters.
   */
  async findAll(query: DeclarationQueryDto) {
    const where: Prisma.CustomsDeclarationWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.channel) {
      where.channel = query.channel;
    }

    if (query.containerId) {
      where.containerId = query.containerId;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { importerName: { contains: query.search, mode: 'insensitive' } },
        { blAwbNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.startDate || query.endDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (query.startDate) {
        dateFilter.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const endOfDay = new Date(query.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter.lte = endOfDay;
      }
      where.createdAt = dateFilter;
    }

    const { data, total } = await this.repository.findAll(
      where,
      query.skip,
      query.limit,
      query.orderBy as Prisma.CustomsDeclarationOrderByWithRelationInput,
    );

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets full declaration detail by ID.
   */
  async findById(id: string) {
    const declaration = await this.repository.findById(id);

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${id} not found`);
    }

    return declaration;
  }

  /**
   * Updates declaration header metadata.
   * Only allowed for DRAFT or READY status.
   */
  async updateHeader(id: string, dto: UpdateDeclarationHeaderDto, userId: string) {
    const declaration = await this.repository.findById(id);

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${id} not found`);
    }

    if (
      declaration.status !== CustomsDeclarationStatus.DRAFT &&
      declaration.status !== CustomsDeclarationStatus.READY
    ) {
      throw new BadRequestException(
        `Cannot update declaration in ${declaration.status} status. Only DRAFT or READY declarations can be edited.`,
      );
    }

    const updateData: Prisma.CustomsDeclarationUpdateInput = {};

    if (dto.customsOfficeCode !== undefined) updateData.customsOfficeCode = dto.customsOfficeCode;
    if (dto.importerTaxCode !== undefined) updateData.importerTaxCode = dto.importerTaxCode;
    if (dto.importerName !== undefined) updateData.importerName = dto.importerName;
    if (dto.importerAddress !== undefined) updateData.importerAddress = dto.importerAddress;
    if (dto.shippingMethod !== undefined) updateData.shippingMethod = dto.shippingMethod;
    if (dto.blAwbNumber !== undefined) updateData.blAwbNumber = dto.blAwbNumber;
    if (dto.portOfLoading !== undefined) updateData.portOfLoading = dto.portOfLoading;
    if (dto.portOfDischarge !== undefined) updateData.portOfDischarge = dto.portOfDischarge;
    if (dto.vesselName !== undefined) updateData.vesselName = dto.vesselName;
    if (dto.declaredCurrency !== undefined)
      updateData.declaredCurrency = dto.declaredCurrency as any;
    if (dto.declaredFreight !== undefined)
      updateData.declaredFreight = new Decimal(dto.declaredFreight);
    if (dto.declaredInsurance !== undefined)
      updateData.declaredInsurance = new Decimal(dto.declaredInsurance);
    if (dto.note !== undefined) updateData.note = dto.note;

    const result = await this.repository.update(id, updateData);

    this.logger.log(`Customs declaration ${declaration.code} header updated by ${userId}`);

    return result;
  }

  /**
   * Updates a declaration line.
   * Recalculates line-level taxes after update.
   */
  async updateLine(lineId: string, dto: UpdateDeclarationLineDto, userId: string) {
    const line = await this.repository.findLineById(lineId);

    if (!line) {
      throw new NotFoundException(`Declaration line with ID ${lineId} not found`);
    }

    if (
      line.declaration.status !== CustomsDeclarationStatus.DRAFT &&
      line.declaration.status !== CustomsDeclarationStatus.READY
    ) {
      throw new BadRequestException(
        `Cannot update line in ${line.declaration.status} status. Only DRAFT or READY declarations can be edited.`,
      );
    }

    const updateData: Prisma.CustomsDeclarationLineUpdateInput = {};

    if (dto.declaredHsCode !== undefined) updateData.declaredHsCode = dto.declaredHsCode;
    if (dto.declaredDescription !== undefined)
      updateData.declaredDescription = dto.declaredDescription;
    if (dto.declaredQuantity !== undefined)
      updateData.declaredQuantity = new Decimal(dto.declaredQuantity);
    if (dto.declaredUnit !== undefined) updateData.declaredUnit = dto.declaredUnit;
    if (dto.declaredUnitPrice !== undefined)
      updateData.declaredUnitPrice = new Decimal(dto.declaredUnitPrice);
    if (dto.declaredTotalValue !== undefined)
      updateData.declaredTotalValue = new Decimal(dto.declaredTotalValue);
    if (dto.declaredCountryOrigin !== undefined)
      updateData.declaredCountryOrigin = dto.declaredCountryOrigin;
    if (dto.declaredNetWeight !== undefined)
      updateData.declaredNetWeight = new Decimal(dto.declaredNetWeight);
    if (dto.declaredGrossWeight !== undefined)
      updateData.declaredGrossWeight = new Decimal(dto.declaredGrossWeight);

    // If HS code changed, look up tax rates from library and track usage
    if (dto.declaredHsCode) {
      const hsCodeEntry = await this.prisma.hSCodeLibrary.findUnique({
        where: { code: dto.declaredHsCode },
      });
      if (hsCodeEntry) {
        updateData.importDutyRate = hsCodeEntry.importDutyRate;
        updateData.vatRate = hsCodeEntry.vatRate;
        updateData.specialTaxRate = hsCodeEntry.specialTaxRate;
        updateData.requiresPermit = hsCodeEntry.requiresPermit;
        updateData.permitType = hsCodeEntry.permitType;
      }

      // Track HS code usage
      await this.repository.incrementHSCodeUsage(dto.declaredHsCode);
    }

    await this.repository.updateLine(lineId, updateData);

    // Recalculate all duties (line-level and header totals)
    await this.dutyCalculator.recalculateDeclaration(line.declaration.id);

    this.logger.log(`Declaration line ${lineId} updated by ${userId}`);

    return this.repository.findLineById(lineId);
  }

  /**
   * Removes a line from a declaration.
   * Only allowed for DRAFT or READY status.
   */
  async removeLine(lineId: string, userId: string) {
    const line = await this.repository.findLineById(lineId);

    if (!line) {
      throw new NotFoundException(`Declaration line with ID ${lineId} not found`);
    }

    if (
      line.declaration.status !== CustomsDeclarationStatus.DRAFT &&
      line.declaration.status !== CustomsDeclarationStatus.READY
    ) {
      throw new BadRequestException(
        `Cannot remove line in ${line.declaration.status} status. Only DRAFT or READY declarations can be edited.`,
      );
    }

    const declarationId = line.declaration.id;

    await this.repository.deleteSourceItems(lineId);
    await this.repository.deleteLine(lineId);

    // Recalculate header totals
    await this.recalculateTaxes(declarationId);

    this.logger.log(
      `Declaration line ${lineId} removed from ${line.declaration.code} by ${userId}`,
    );

    return { success: true, declarationId };
  }

  /**
   * Adds a manual line to a declaration (not linked to any order item).
   */
  async addManualLine(declarationId: string, dto: UpdateDeclarationLineDto, userId: string) {
    const declaration = await this.repository.findById(declarationId);

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${declarationId} not found`);
    }

    if (
      declaration.status !== CustomsDeclarationStatus.DRAFT &&
      declaration.status !== CustomsDeclarationStatus.READY
    ) {
      throw new BadRequestException(
        `Cannot add line in ${declaration.status} status. Only DRAFT or READY declarations can be edited.`,
      );
    }

    const line = await this.repository.createLine(declarationId, {
      declaredHsCode: dto.declaredHsCode ?? '',
      declaredDescription: dto.declaredDescription ?? '',
      declaredQuantity: dto.declaredQuantity ?? 0,
      declaredUnit: dto.declaredUnit ?? 'PCS',
      declaredUnitPrice: dto.declaredUnitPrice ?? 0,
      declaredTotalValue: dto.declaredTotalValue ?? 0,
      declaredCountryOrigin: dto.declaredCountryOrigin ?? 'CN',
      declaredNetWeight: dto.declaredNetWeight ? new Decimal(dto.declaredNetWeight) : null,
      declaredGrossWeight: dto.declaredGrossWeight ? new Decimal(dto.declaredGrossWeight) : null,
      internalDescription: dto.declaredDescription ?? '',
      internalQuantity: dto.declaredQuantity ?? 0,
      internalUnitPrice: dto.declaredUnitPrice ?? 0,
      internalTotalValue: dto.declaredTotalValue ?? 0,
    });

    this.logger.log(`Manual line added to declaration ${declaration.code} by ${userId}`);

    return line;
  }

  /**
   * Updates the declaration status with FSM validation.
   * Emits status change events.
   */
  async updateStatus(
    id: string,
    newStatus: CustomsDeclarationStatus,
    userId: string,
    note?: string,
  ) {
    const declaration = await this.repository.findById(id);

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${id} not found`);
    }

    // Validate transition
    this.statusMachine.assertTransition(declaration.status, newStatus);

    const updateData: Prisma.CustomsDeclarationUpdateInput = {
      status: newStatus,
    };

    // Set timestamps for specific transitions
    switch (newStatus) {
      case CustomsDeclarationStatus.SUBMITTED:
        updateData.ecusSubmittedAt = new Date();
        break;
      case CustomsDeclarationStatus.CHANNEL_ASSIGNED:
        updateData.channelAssignedAt = new Date();
        break;
      case CustomsDeclarationStatus.INSPECTING:
        updateData.inspectionStartedAt = new Date();
        break;
      case CustomsDeclarationStatus.CLEARED:
        updateData.clearedAt = new Date();
        break;
    }

    const updated = await this.repository.update(id, updateData);

    // Log status history
    await this.repository.createStatusHistory({
      declarationId: id,
      fromStatus: declaration.status,
      toStatus: newStatus,
      channel: declaration.channel ?? undefined,
      note,
      changedBy: userId,
    });

    // Emit events
    this.eventEmitter.emit('customs.declaration.status.changed', {
      declarationId: id,
      code: declaration.code,
      containerId: declaration.containerId,
      fromStatus: declaration.status,
      toStatus: newStatus,
      channel: declaration.channel,
      changedBy: userId,
    });

    if (newStatus === CustomsDeclarationStatus.CLEARED) {
      this.eventEmitter.emit('customs.declaration.cleared', {
        declarationId: id,
        code: declaration.code,
        containerId: declaration.containerId,
        totalPayable: Number(declaration.totalPayable),
      });
    }

    if (newStatus === CustomsDeclarationStatus.REJECTED) {
      this.eventEmitter.emit('customs.declaration.rejected', {
        declarationId: id,
        code: declaration.code,
        containerId: declaration.containerId,
        note,
      });
    }

    this.logger.log(
      `Customs declaration ${declaration.code} status changed: ${declaration.status} -> ${newStatus} by ${userId}`,
    );

    return updated;
  }

  /**
   * Sets the customs inspection channel (GREEN/YELLOW/RED).
   * Emits channel assignment event.
   */
  async updateChannel(id: string, channel: CustomsChannel, userId: string) {
    const declaration = await this.repository.findById(id);

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${id} not found`);
    }

    // Channel can only be set during SUBMITTED or CHANNEL_ASSIGNED status
    if (
      declaration.status !== CustomsDeclarationStatus.SUBMITTED &&
      declaration.status !== CustomsDeclarationStatus.CHANNEL_ASSIGNED
    ) {
      throw new BadRequestException(
        `Cannot assign channel in ${declaration.status} status. Declaration must be SUBMITTED or CHANNEL_ASSIGNED.`,
      );
    }

    const updateData: Prisma.CustomsDeclarationUpdateInput = {
      channel,
      channelAssignedAt: new Date(),
    };

    // If not already CHANNEL_ASSIGNED, transition to it
    if (declaration.status === CustomsDeclarationStatus.SUBMITTED) {
      this.statusMachine.assertTransition(
        declaration.status,
        CustomsDeclarationStatus.CHANNEL_ASSIGNED,
      );
      updateData.status = CustomsDeclarationStatus.CHANNEL_ASSIGNED;
    }

    const updated = await this.repository.update(id, updateData);

    // Log status history
    if (declaration.status === CustomsDeclarationStatus.SUBMITTED) {
      await this.repository.createStatusHistory({
        declarationId: id,
        fromStatus: declaration.status,
        toStatus: CustomsDeclarationStatus.CHANNEL_ASSIGNED,
        channel: channel,
        note: `Channel assigned: ${channel}`,
        changedBy: userId,
      });
    }

    this.eventEmitter.emit('customs.declaration.channel.assigned', {
      declarationId: id,
      code: declaration.code,
      containerId: declaration.containerId,
      channel,
      assignedBy: userId,
    });

    // GREEN channel = auto-cleared: transition directly to CLEARED
    if (channel === CustomsChannel.GREEN) {
      this.logger.log(
        `GREEN channel assigned to ${declaration.code} — auto-clearing declaration`,
      );

      const clearedData: Prisma.CustomsDeclarationUpdateInput = {
        status: CustomsDeclarationStatus.CLEARED,
        clearedAt: new Date(),
      };

      const cleared = await this.repository.update(id, clearedData);

      await this.repository.createStatusHistory({
        declarationId: id,
        fromStatus: CustomsDeclarationStatus.CHANNEL_ASSIGNED,
        toStatus: CustomsDeclarationStatus.CLEARED,
        channel,
        note: 'Auto-cleared via GREEN channel',
        changedBy: userId,
      });

      this.eventEmitter.emit('customs.declaration.status.changed', {
        declarationId: id,
        code: declaration.code,
        containerId: declaration.containerId,
        fromStatus: CustomsDeclarationStatus.CHANNEL_ASSIGNED,
        toStatus: CustomsDeclarationStatus.CLEARED,
        channel,
        changedBy: userId,
      });

      this.eventEmitter.emit('customs.declaration.cleared', {
        declarationId: id,
        code: declaration.code,
        containerId: declaration.containerId,
        totalPayable: Number(declaration.totalPayable),
      });

      this.logger.log(
        `Customs declaration ${declaration.code} auto-cleared (GREEN channel) by ${userId}`,
      );

      return cleared;
    }

    this.logger.log(
      `Customs declaration ${declaration.code} assigned to ${channel} channel by ${userId}`,
    );

    return updated;
  }

  /**
   * Recalculates all line taxes and header totals for a declaration.
   * Delegates to DutyCalculatorService which handles both line-level and header totals.
   */
  async recalculateTaxes(declarationId: string) {
    const declaration = await this.repository.findById(declarationId);

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${declarationId} not found`);
    }

    const result = await this.dutyCalculator.recalculateDeclaration(declarationId);

    this.logger.log(`Taxes recalculated for declaration ${declaration.code}`);

    return result;
  }

  /**
   * Exports the declaration in ECUS5-compatible Excel format.
   * Delegates to the EcusExportService.
   */
  async exportEcus5(id: string) {
    const declaration = await this.repository.findById(id);

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${id} not found`);
    }

    const buffer = await this.ecusExport.exportToExcel(id);
    return {
      buffer,
      filename: `ECUS5_${declaration.code.replace(/\//g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /**
   * Allocates customs taxes to individual orders proportionally.
   * Delegates to the TaxAllocationService.
   */
  async allocateTaxToOrders(id: string, method: string, _userId: string) {
    const declaration = await this.repository.findById(id);

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${id} not found`);
    }

    if (declaration.status !== CustomsDeclarationStatus.CLEARED) {
      throw new BadRequestException(
        `Tax allocation can only be performed on CLEARED declarations. Current status: ${declaration.status}`,
      );
    }

    let allocations;
    if (method === 'WEIGHT') {
      allocations = await this.taxAllocation.allocateByWeight(id);
    } else {
      allocations = await this.taxAllocation.allocateByValue(id);
    }

    this.logger.log(
      `Tax allocated for declaration ${declaration.code} using ${method} method to ${allocations.length} orders`,
    );

    return allocations;
  }

  /**
   * Groups multiple lines by HS code into a single line.
   * Delegates to GroupingService.
   */
  async groupByHsCode(declarationId: string, userId: string) {
    const declaration = await this.repository.findById(declarationId);

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${declarationId} not found`);
    }

    if (
      declaration.status !== CustomsDeclarationStatus.DRAFT &&
      declaration.status !== CustomsDeclarationStatus.READY
    ) {
      throw new BadRequestException(
        `Cannot group lines in ${declaration.status} status. Only DRAFT or READY declarations can be edited.`,
      );
    }

    const result = await this.groupingService.groupByHsCode(declarationId);

    this.logger.log(`Lines grouped by HS code for declaration ${declaration.code} by ${userId}`);

    return result;
  }

  /**
   * Custom grouping of selected lines.
   */
  async groupCustom(declarationId: string, dto: GroupItemsDto, userId: string) {
    const declaration = await this.repository.findById(declarationId);

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${declarationId} not found`);
    }

    if (
      declaration.status !== CustomsDeclarationStatus.DRAFT &&
      declaration.status !== CustomsDeclarationStatus.READY
    ) {
      throw new BadRequestException(
        `Cannot group lines in ${declaration.status} status. Only DRAFT or READY declarations can be edited.`,
      );
    }

    const result = await this.groupingService.groupCustom(declarationId, {
      lineIds: dto.lineIds,
      declaredDescription: dto.declaredDescription,
      declaredHsCode: dto.declaredHsCode,
      declaredUnit: dto.declaredUnit,
    });

    this.logger.log(`Custom grouping performed on declaration ${declaration.code} by ${userId}`);

    return result;
  }

  /**
   * Ungroups a line back to individual order item lines.
   */
  async ungroupLine(lineId: string, userId: string) {
    const line = await this.repository.findLineById(lineId);

    if (!line) {
      throw new NotFoundException(`Declaration line with ID ${lineId} not found`);
    }

    if (
      line.declaration.status !== CustomsDeclarationStatus.DRAFT &&
      line.declaration.status !== CustomsDeclarationStatus.READY
    ) {
      throw new BadRequestException(
        `Cannot ungroup line in ${line.declaration.status} status. Only DRAFT or READY declarations can be edited.`,
      );
    }

    const result = await this.groupingService.ungroupLine(lineId);

    this.logger.log(
      `Line ${lineId} ungrouped in declaration ${line.declaration.code} by ${userId}`,
    );

    return result;
  }

  /**
   * Suggests optimal line groupings for a declaration.
   */
  async suggestGroupings(declarationId: string) {
    const declaration = await this.repository.findById(declarationId);

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${declarationId} not found`);
    }

    return this.groupingService.suggestGroupings(declarationId);
  }

  /**
   * Searches the HS code library.
   */
  async searchHSCodes(query: string, limit?: number) {
    return this.repository.searchHSCodes(query, limit);
  }

  /**
   * Suggests HS codes based on product description.
   */
  async suggestHSCode(description: string, limit?: number) {
    return this.hsCodeSuggestion.suggest(description, limit);
  }

  /**
   * Runs compliance checks on a declaration.
   * Creates compliance alerts for any issues found.
   */
  async checkCompliance(declarationId: string, userId: string) {
    const declaration = await this.repository.findById(declarationId);

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${declarationId} not found`);
    }

    const alerts = await this.complianceChecker.checkDeclaration(declarationId);

    // Reload to get updated compliance status
    const updated = await this.repository.findById(declarationId);

    this.eventEmitter.emit('customs.compliance.checked', {
      declarationId,
      code: declaration.code,
      alertCount: alerts.length,
      complianceStatus: updated?.complianceStatus,
      checkedBy: userId,
    });

    this.logger.log(
      `Compliance check completed for declaration ${declaration.code}: ${updated?.complianceStatus} (${alerts.length} alerts)`,
    );

    return {
      alerts,
      overallStatus: updated?.complianceStatus,
      declaration: updated,
    };
  }

  /**
   * Acknowledges a compliance alert.
   */
  async acknowledgeAlert(alertId: string, userId: string) {
    return this.repository.acknowledgeAlert(alertId, userId);
  }

  /**
   * Lists all active compliance rules.
   */
  async getComplianceRules() {
    return this.repository.findAllComplianceRules();
  }

  /**
   * Creates a new compliance rule.
   */
  async createComplianceRule(
    data: {
      hsCodePattern: string;
      ruleType: string;
      permitType?: string;
      message: string;
      authority?: string;
    },
    userId: string,
  ) {
    return this.repository.createComplianceRule({
      hsCodePattern: data.hsCodePattern,
      ruleType: data.ruleType,
      permitType: data.permitType ?? null,
      message: data.message,
      authority: data.authority ?? null,
      createdBy: userId,
    });
  }

  /**
   * Updates a compliance rule.
   */
  async updateComplianceRule(
    id: string,
    data: {
      hsCodePattern?: string;
      ruleType?: string;
      permitType?: string;
      message?: string;
      authority?: string;
    },
  ) {
    const updateData: Prisma.ComplianceRuleUpdateInput = {};

    if (data.hsCodePattern !== undefined) updateData.hsCodePattern = data.hsCodePattern;
    if (data.ruleType !== undefined) updateData.ruleType = data.ruleType;
    if (data.permitType !== undefined) updateData.permitType = data.permitType;
    if (data.message !== undefined) updateData.message = data.message;
    if (data.authority !== undefined) updateData.authority = data.authority;

    return this.repository.updateComplianceRule(id, updateData);
  }
}
