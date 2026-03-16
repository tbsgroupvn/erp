import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { WarehouseCNStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Package Consolidation Service (KhoTQ-5).
 *
 * Handles merging multiple packages from the same customer into a single
 * consolidated package at the CN warehouse. This reduces shipping costs
 * and simplifies customs clearance when a customer has multiple small
 * packages that can be combined.
 */
@Injectable()
export class WarehouseCNConsolidationService {
  private readonly logger = new Logger(WarehouseCNConsolidationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Consolidates multiple packages belonging to the same customer
   * into a single combined package.
   *
   * Flow:
   *  1. Verify all packages exist and belong to the same customer
   *  2. Verify packages are in a consolidatable status (RECEIVED or CHECKED)
   *  3. Calculate total combined weight
   *  4. Create a new Package with the combined weight
   *  5. Create a PackageConsolidation record linking source packages
   *  6. Generate consolidation code: CONS-YYYYMM-XXXX
   *
   * @param customerId - The customer who owns all the packages
   * @param packageIds - Array of package IDs to consolidate
   * @param consolidatedBy - User ID performing the consolidation
   */
  async consolidatePackages(customerId: string, packageIds: string[], consolidatedBy: string) {
    if (packageIds.length < 2) {
      throw new BadRequestException('At least 2 packages are required for consolidation');
    }

    // Verify customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, fullName: true, code: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    // Fetch all packages and verify ownership
    const packages = await this.prisma.package.findMany({
      where: { id: { in: packageIds } },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            customerId: true,
            shippingRoute: true,
          },
        },
      },
    });

    if (packages.length !== packageIds.length) {
      const foundIds = packages.map((p) => p.id);
      const missing = packageIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(`Packages not found: ${missing.join(', ')}`);
    }

    // Verify all packages belong to the same customer
    const wrongCustomer = packages.filter((p) => p.order.customerId !== customerId);
    if (wrongCustomer.length > 0) {
      throw new BadRequestException(
        `Packages do not belong to customer ${customer.code}: ${wrongCustomer.map((p) => p.code).join(', ')}`,
      );
    }

    // Verify packages are in consolidatable status
    const validStatuses: WarehouseCNStatus[] = [WarehouseCNStatus.RECEIVED, WarehouseCNStatus.CHECKED];
    const invalidPackages = packages.filter(
      (p) => !validStatuses.includes(p.warehouseCNStatus as WarehouseCNStatus),
    );
    if (invalidPackages.length > 0) {
      throw new BadRequestException(
        `Packages must be in RECEIVED or CHECKED status for consolidation. Invalid: ${invalidPackages.map((p) => `${p.code} (${p.warehouseCNStatus})`).join(', ')}`,
      );
    }

    // Verify packages are not already in a container
    const containerAssigned = packages.filter((p) => p.containerId);
    if (containerAssigned.length > 0) {
      throw new BadRequestException(
        `Cannot consolidate packages already assigned to a container: ${containerAssigned.map((p) => p.code).join(', ')}`,
      );
    }

    // Calculate total weight from source packages
    const totalWeight = packages.reduce((sum, p) => {
      return sum + (p.chargeableWeight ? Number(p.chargeableWeight) : 0);
    }, 0);

    // Use the first package's order for the consolidated package
    const primaryOrder = packages[0].order;

    // Generate consolidation code: CONS-YYYYMM-XXXX
    const consolidationCode = await this.generateConsolidationCode();

    // Generate package code for the new consolidated package
    const packageCode = await this.generatePackageCode();

    // Create everything in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the consolidated package
      const consolidatedPackage = await tx.package.create({
        data: {
          code: packageCode,
          orderId: primaryOrder.id,
          description: `Consolidated package from ${packages.length} packages (${consolidationCode})`,
          warehouseCNStatus: WarehouseCNStatus.CHECKED,
          receivedCNAt: new Date(),
          receivedCNBy: consolidatedBy,
          chargeableWeight: new Decimal(totalWeight),
          actualWeight: new Decimal(totalWeight),
        },
      });

      // Create the consolidation record
      const consolidation = await tx.packageConsolidation.create({
        data: {
          code: consolidationCode,
          customerId,
          sourcePackageIds: packageIds,
          resultPackageId: consolidatedPackage.id,
          totalWeight: new Decimal(totalWeight),
          status: 'PENDING',
          consolidatedBy,
        },
      });

      return { consolidation, consolidatedPackage };
    });

    this.logger.log(
      `Consolidation ${consolidationCode} created for customer ${customer.code}: ` +
        `${packages.length} packages -> ${result.consolidatedPackage.code} ` +
        `(total weight: ${totalWeight}kg)`,
    );

    return result;
  }

  /**
   * Lists consolidation records with optional customer filter.
   *
   * @param customerId - Optional customer ID to filter by
   */
  async getConsolidations(customerId?: string) {
    const where = customerId ? { customerId } : {};

    const consolidations = await this.prisma.packageConsolidation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return consolidations;
  }

  /**
   * Cancels a consolidation if it is still in PENDING status.
   *
   * @param id - The consolidation record ID
   */
  async cancelConsolidation(id: string) {
    const consolidation = await this.prisma.packageConsolidation.findUnique({
      where: { id },
    });

    if (!consolidation) {
      throw new NotFoundException(`Consolidation with ID ${id} not found`);
    }

    if (consolidation.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot cancel consolidation ${consolidation.code} in status ${consolidation.status}. Only PENDING consolidations can be cancelled.`,
      );
    }

    const updated = await this.prisma.packageConsolidation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    this.logger.log(`Consolidation ${consolidation.code} cancelled`);

    return updated;
  }

  /**
   * Generates the next consolidation code: CONS-YYYYMM-XXXX.
   */
  private async generateConsolidationCode(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `CONS-${yearMonth}`;

    const latest = await this.prisma.packageConsolidation.findFirst({
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
   * Generates the next package code: TBS-PKG-NNNNNN.
   */
  private async generatePackageCode(): Promise<string> {
    const latest = await this.prisma.package.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latest) {
      const match = latest.code.match(/TBS-PKG-(\d+)/);
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    return `TBS-PKG-${String(sequence).padStart(6, '0')}`;
  }
}
