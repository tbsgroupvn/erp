import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

/**
 * Inventory Counting Service (KhoVN-4).
 *
 * Manages periodic stock counting at the VN warehouse to ensure accuracy
 * between the system records and physical inventory. Supports two count types:
 *  - CYCLE: Daily counting of a specific zone/area
 *  - FULL: Monthly full warehouse count
 *
 * Each count generates items based on packages currently in the zone,
 * warehouse staff then records actual quantities found, and the system
 * calculates discrepancies for investigation.
 */
@Injectable()
export class WarehouseVNInventoryService {
  private readonly logger = new Logger(WarehouseVNInventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new inventory count session.
   *
   * Flow:
   *  1. Generate count code: IC-YYYYMM-XXXX
   *  2. Query all packages currently stored in the specified zone/branch
   *  3. Group packages by storage location
   *  4. Create InventoryCount record with status DRAFT
   *  5. Create InventoryCountItem for each occupied location (systemQty = 1 per package)
   *
   * @param type - Count type: CYCLE (daily zone) or FULL (monthly all)
   * @param branch - Warehouse branch (HN or HCM)
   * @param countedBy - User ID performing the count
   * @param zone - Optional zone filter (REGULAR, COLD, HAZARDOUS). Null = entire warehouse
   */
  async createCount(type: string, branch: string, countedBy: string, zone?: string) {
    // Validate count type
    const validTypes = ['CYCLE', 'FULL'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(
        `Invalid count type: ${type}. Valid types: ${validTypes.join(', ')}`,
      );
    }

    // Generate count code: IC-YYYYMM-XXXX
    const countCode = await this.generateCountCode();

    // Build the storage location filter for packages in this zone/branch
    const locationWhere: any = {
      branch: branch as any,
      isOccupied: true,
    };

    if (zone) {
      locationWhere.zone = zone;
    }

    // Find all occupied storage locations in the target zone
    const occupiedLocations = await this.prisma.storageLocation.findMany({
      where: locationWhere,
      select: {
        id: true,
        code: true,
        currentPackageId: true,
      },
      orderBy: [{ shelf: 'asc' }, { level: 'asc' }, { slot: 'asc' }],
    });

    const totalSystemQty = occupiedLocations.length;

    // Create the count and items in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the inventory count record
      const inventoryCount = await tx.inventoryCount.create({
        data: {
          code: countCode,
          type,
          branch: branch as any,
          zone: zone ?? null,
          status: 'DRAFT',
          totalSystemQty,
          totalActualQty: 0,
          discrepancy: 0,
          countedBy,
        },
      });

      // Create count items for each occupied location
      if (occupiedLocations.length > 0) {
        await tx.inventoryCountItem.createMany({
          data: occupiedLocations.map((loc) => ({
            countId: inventoryCount.id,
            packageId: loc.currentPackageId,
            locationCode: loc.code,
            systemQty: 1, // Each location holds 1 package
            actualQty: 0, // To be filled by warehouse staff
            discrepancy: -1, // Will be recalculated when actual qty is recorded
          })),
        });
      }

      // Fetch the complete count with items
      const fullCount = await tx.inventoryCount.findUnique({
        where: { id: inventoryCount.id },
        include: { items: true },
      });

      return fullCount;
    });

    this.logger.log(
      `Inventory count ${countCode} created: type=${type}, branch=${branch}, ` +
        `zone=${zone ?? 'ALL'}, locations=${totalSystemQty}`,
    );

    return result;
  }

  /**
   * Updates the actual quantity found for a specific count item.
   *
   * Warehouse staff records what they physically found at each location.
   * The discrepancy is automatically calculated as (actualQty - systemQty).
   *
   * @param itemId - The InventoryCountItem ID
   * @param actualQty - The actual quantity found at the location
   * @param explanation - Optional explanation for any discrepancy
   */
  async updateCountItem(itemId: string, actualQty: number, explanation?: string) {
    const item = await this.prisma.inventoryCountItem.findUnique({
      where: { id: itemId },
      include: {
        count: {
          select: { id: true, code: true, status: true },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Inventory count item with ID ${itemId} not found`);
    }

    if (item.count.status === 'COMPLETED') {
      throw new BadRequestException(`Cannot update items for completed count ${item.count.code}`);
    }

    if (actualQty < 0) {
      throw new BadRequestException('Actual quantity cannot be negative');
    }

    const discrepancy = actualQty - item.systemQty;

    const updated = await this.prisma.inventoryCountItem.update({
      where: { id: itemId },
      data: {
        actualQty,
        discrepancy,
        explanation: explanation ?? item.explanation,
      },
    });

    // If the count is still in DRAFT, move it to IN_PROGRESS
    if (item.count.status === 'DRAFT') {
      await this.prisma.inventoryCount.update({
        where: { id: item.count.id },
        data: { status: 'IN_PROGRESS' },
      });
    }

    this.logger.log(
      `Count item ${itemId} updated: location=${item.locationCode}, ` +
        `system=${item.systemQty}, actual=${actualQty}, discrepancy=${discrepancy}`,
    );

    return updated;
  }

  /**
   * Completes an inventory count by aggregating all item results.
   *
   * Calculates totals for system qty, actual qty, and net discrepancy.
   * Sets the count status to COMPLETED and records the completion timestamp.
   *
   * @param countId - The InventoryCount ID to complete
   */
  async completeCount(countId: string) {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { id: countId },
      include: { items: true },
    });

    if (!count) {
      throw new NotFoundException(`Inventory count with ID ${countId} not found`);
    }

    if (count.status === 'COMPLETED') {
      throw new BadRequestException(`Inventory count ${count.code} is already completed`);
    }

    // Check that all items have been counted (actualQty > 0 or explicitly 0 with explanation)
    const uncountedItems = count.items.filter(
      (item) => item.actualQty === 0 && item.discrepancy === -1,
    );

    if (uncountedItems.length > 0) {
      throw new BadRequestException(
        `Cannot complete count ${count.code}: ${uncountedItems.length} items have not been counted yet. ` +
          `Uncounted locations: ${uncountedItems
            .map((i) => i.locationCode)
            .slice(0, 10)
            .join(', ')}${uncountedItems.length > 10 ? '...' : ''}`,
      );
    }

    // Aggregate totals
    const totalSystemQty = count.items.reduce((sum, item) => sum + item.systemQty, 0);
    const totalActualQty = count.items.reduce((sum, item) => sum + item.actualQty, 0);
    const discrepancy = totalActualQty - totalSystemQty;

    const updated = await this.prisma.inventoryCount.update({
      where: { id: countId },
      data: {
        status: 'COMPLETED',
        totalSystemQty,
        totalActualQty,
        discrepancy,
        completedAt: new Date(),
      },
    });

    this.logger.log(
      `Inventory count ${count.code} completed: ` +
        `system=${totalSystemQty}, actual=${totalActualQty}, ` +
        `discrepancy=${discrepancy}`,
    );

    return updated;
  }

  /**
   * Returns a detailed count report including all items and a discrepancy summary.
   *
   * The summary breaks down items into:
   *  - matched: Items where actual matches system qty
   *  - surplus: Items where actual exceeds system qty
   *  - missing: Items where actual is less than system qty
   *
   * @param countId - The InventoryCount ID to report on
   */
  async getCountReport(countId: string) {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { id: countId },
      include: {
        items: {
          orderBy: { locationCode: 'asc' },
        },
      },
    });

    if (!count) {
      throw new NotFoundException(`Inventory count with ID ${countId} not found`);
    }

    // Calculate discrepancy summary
    const matched = count.items.filter((item) => item.discrepancy === 0);
    const surplus = count.items.filter((item) => item.discrepancy > 0);
    const missing = count.items.filter((item) => item.discrepancy < 0);

    const summary = {
      totalLocations: count.items.length,
      matchedCount: matched.length,
      surplusCount: surplus.length,
      missingCount: missing.length,
      totalSystemQty: count.totalSystemQty,
      totalActualQty: count.totalActualQty,
      netDiscrepancy: count.discrepancy,
      accuracyRate:
        count.items.length > 0
          ? Math.round((matched.length / count.items.length) * 10000) / 100
          : 100,
    };

    // Collect package details for items with discrepancies
    const discrepancyPackageIds = [...surplus, ...missing]
      .map((item) => item.packageId)
      .filter((id): id is string => id !== null);

    let discrepancyPackages: Record<string, { code: string; orderId: string }> = {};
    if (discrepancyPackageIds.length > 0) {
      const packages = await this.prisma.package.findMany({
        where: { id: { in: discrepancyPackageIds } },
        select: { id: true, code: true, orderId: true },
      });
      discrepancyPackages = Object.fromEntries(
        packages.map((p) => [p.id, { code: p.code, orderId: p.orderId }]),
      );
    }

    this.logger.log(
      `Count report generated for ${count.code}: ` +
        `${summary.matchedCount} matched, ${summary.surplusCount} surplus, ` +
        `${summary.missingCount} missing (${summary.accuracyRate}% accuracy)`,
    );

    return {
      count: {
        id: count.id,
        code: count.code,
        type: count.type,
        branch: count.branch,
        zone: count.zone,
        status: count.status,
        countedBy: count.countedBy,
        completedAt: count.completedAt,
        createdAt: count.createdAt,
      },
      items: count.items,
      discrepancyDetails: {
        surplus: surplus.map((item) => ({
          ...item,
          package: item.packageId ? (discrepancyPackages[item.packageId] ?? null) : null,
        })),
        missing: missing.map((item) => ({
          ...item,
          package: item.packageId ? (discrepancyPackages[item.packageId] ?? null) : null,
        })),
      },
      summary,
    };
  }

  /**
   * List inventory counts with optional filters.
   */
  async findAll(
    params: {
      page?: number;
      limit?: number;
      branch?: string;
      type?: string;
      status?: string;
    } = {},
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.branch) where.branch = params.branch;
    if (params.type) where.type = params.type;
    if (params.status) where.status = params.status;

    const [data, total] = await Promise.all([
      this.prisma.inventoryCount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { items: true } },
        },
      }),
      this.prisma.inventoryCount.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Generates the next inventory count code: IC-YYYYMM-XXXX.
   */
  private async generateCountCode(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `IC-${yearMonth}`;

    const latest = await this.prisma.inventoryCount.findFirst({
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
}
