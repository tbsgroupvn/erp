import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { WarehouseVNStatus } from '@prisma/client';

/**
 * Storage Location Management Service (KhoVN-1).
 *
 * Manages warehouse bin locations at the VN warehouse. Each storage location
 * follows the format Shelf-Level-Slot (e.g., A1-02-05) and can hold one
 * package at a time. The service handles:
 *  - Suggesting optimal locations based on customer zone affinity
 *  - Assigning and releasing storage locations
 *  - Generating pick lists sorted by location for efficient retrieval
 */
@Injectable()
export class WarehouseVNStorageService {
  private readonly logger = new Logger(WarehouseVNStorageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Suggests an optimal storage location for a package.
   *
   * Location preference strategy:
   *  1. If a customerId is provided, prefer empty locations in the same
   *     zone where the customer already has packages stored (zone affinity)
   *  2. Fall back to any empty location in the specified branch
   *
   * @param branch - Warehouse branch (HN or HCM)
   * @param customerId - Optional customer ID for zone affinity matching
   */
  async suggestLocation(branch: string, customerId?: string) {
    // If customer is specified, try to find empty locations near their existing packages
    if (customerId) {
      // Find zones where this customer already has packages stored
      const customerPackages = await this.prisma.package.findMany({
        where: {
          order: { customerId },
          storageLocationId: { not: null },
          warehouseVNStatus: { in: [WarehouseVNStatus.RECEIVED, WarehouseVNStatus.SORTED, WarehouseVNStatus.READY] },
        },
        select: { storageLocationId: true },
      });

      if (customerPackages.length > 0) {
        const locationIds = customerPackages
          .map((p) => p.storageLocationId)
          .filter((id): id is string => id !== null);

        // Get the zones of existing customer locations
        const existingLocations = await this.prisma.storageLocation.findMany({
          where: { id: { in: locationIds } },
          select: { zone: true, shelf: true },
        });

        const zones = [...new Set(existingLocations.map((l) => l.zone).filter(Boolean))];
        const shelves = [...new Set(existingLocations.map((l) => l.shelf))];

        // Try to find an empty location in the same zone and shelf first
        if (shelves.length > 0) {
          const sameShelfLocation = await this.prisma.storageLocation.findFirst({
            where: {
              branch: branch as any,
              isOccupied: false,
              shelf: { in: shelves },
            },
            orderBy: [{ shelf: 'asc' }, { level: 'asc' }, { slot: 'asc' }],
          });

          if (sameShelfLocation) {
            this.logger.log(
              `Suggested location ${sameShelfLocation.code} for customer ${customerId} ` +
                `(same shelf affinity: ${sameShelfLocation.shelf})`,
            );
            return sameShelfLocation;
          }
        }

        // Try same zone if same shelf not available
        if (zones.length > 0) {
          const sameZoneLocation = await this.prisma.storageLocation.findFirst({
            where: {
              branch: branch as any,
              isOccupied: false,
              zone: { in: zones as string[] },
            },
            orderBy: [{ shelf: 'asc' }, { level: 'asc' }, { slot: 'asc' }],
          });

          if (sameZoneLocation) {
            this.logger.log(
              `Suggested location ${sameZoneLocation.code} for customer ${customerId} ` +
                `(same zone affinity: ${sameZoneLocation.zone})`,
            );
            return sameZoneLocation;
          }
        }
      }
    }

    // Fall back to any empty location in the branch
    const emptyLocation = await this.prisma.storageLocation.findFirst({
      where: {
        branch: branch as any,
        isOccupied: false,
      },
      orderBy: [{ shelf: 'asc' }, { level: 'asc' }, { slot: 'asc' }],
    });

    if (!emptyLocation) {
      throw new NotFoundException(`No empty storage locations available in branch ${branch}`);
    }

    this.logger.log(
      `Suggested location ${emptyLocation.code} in branch ${branch} (no customer affinity)`,
    );

    return emptyLocation;
  }

  /**
   * Assigns a package to a specific storage location.
   *
   * Updates both the StorageLocation (marks as occupied with package reference)
   * and the Package (sets storageLocationId).
   *
   * @param packageId - The package to assign
   * @param locationCode - The storage location code (e.g., A1-02-05)
   */
  async assignLocation(packageId: string, locationCode: string) {
    // Verify the package exists
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: { id: true, code: true, storageLocationId: true },
    });

    if (!pkg) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    // Verify the storage location exists
    const location = await this.prisma.storageLocation.findUnique({
      where: { code: locationCode },
    });

    if (!location) {
      throw new NotFoundException(`Storage location with code ${locationCode} not found`);
    }

    // Check if the location is already occupied
    if (location.isOccupied) {
      throw new BadRequestException(
        `Storage location ${locationCode} is already occupied by package ${location.currentPackageId}`,
      );
    }

    // If the package was previously assigned, release the old location
    if (pkg.storageLocationId) {
      await this.prisma.storageLocation.updateMany({
        where: { currentPackageId: packageId },
        data: {
          isOccupied: false,
          currentPackageId: null,
        },
      });
    }

    // Assign the package to the location in a transaction
    const [updatedLocation, updatedPackage] = await this.prisma.$transaction([
      this.prisma.storageLocation.update({
        where: { code: locationCode },
        data: {
          isOccupied: true,
          currentPackageId: packageId,
        },
      }),
      this.prisma.package.update({
        where: { id: packageId },
        data: { storageLocationId: location.id },
      }),
    ]);

    this.logger.log(`Package ${pkg.code} assigned to storage location ${locationCode}`);

    return { location: updatedLocation, package: updatedPackage };
  }

  /**
   * Releases a storage location, making it available for new packages.
   *
   * Clears the occupied flag and removes the package reference.
   * Also clears the storageLocationId on the package if one was assigned.
   *
   * @param locationCode - The storage location code to release
   */
  async releaseLocation(locationCode: string) {
    const location = await this.prisma.storageLocation.findUnique({
      where: { code: locationCode },
    });

    if (!location) {
      throw new NotFoundException(`Storage location with code ${locationCode} not found`);
    }

    if (!location.isOccupied) {
      this.logger.warn(`Storage location ${locationCode} is already empty`);
      return location;
    }

    // Clear the package reference if one exists
    if (location.currentPackageId) {
      await this.prisma.package.update({
        where: { id: location.currentPackageId },
        data: { storageLocationId: null },
      });
    }

    const updated = await this.prisma.storageLocation.update({
      where: { code: locationCode },
      data: {
        isOccupied: false,
        currentPackageId: null,
      },
    });

    this.logger.log(
      `Storage location ${locationCode} released (was occupied by package ${location.currentPackageId})`,
    );

    return updated;
  }

  /**
   * Generates a pick list for the given deliveries.
   *
   * Returns packages sorted by their storage location code in ascending
   * order (shelf -> level -> slot) so warehouse staff can pick items
   * efficiently by walking through the aisles sequentially.
   *
   * @param deliveryIds - Array of delivery IDs to generate the pick list for
   */
  async getPickList(deliveryIds: string[]) {
    if (deliveryIds.length === 0) {
      throw new BadRequestException('At least one delivery ID is required');
    }

    // Fetch deliveries with their associated orders
    const deliveries = await this.prisma.delivery.findMany({
      where: { id: { in: deliveryIds } },
      select: {
        id: true,
        code: true,
        orderId: true,
        recipientName: true,
        deliveryPackages: { select: { packageId: true } },
        order: {
          select: {
            id: true,
            code: true,
            customer: {
              select: { fullName: true, code: true },
            },
          },
        },
      },
    });

    if (deliveries.length !== deliveryIds.length) {
      const foundIds = deliveries.map((d) => d.id);
      const missing = deliveryIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(`Deliveries not found: ${missing.join(', ')}`);
    }

    // Collect all package IDs from delivery-package junction
    const allPackageIds = deliveries.flatMap((d) =>
      d.deliveryPackages.map((dp) => dp.packageId),
    );

    // Fetch packages that are still in warehouse
    const packages = await this.prisma.package.findMany({
      where: {
        id: { in: allPackageIds },
        warehouseVNStatus: { in: [WarehouseVNStatus.RECEIVED, WarehouseVNStatus.SORTED, WarehouseVNStatus.READY] },
      },
      select: {
        id: true,
        code: true,
        orderId: true,
        storageLocationId: true,
        chargeableWeight: true,
        description: true,
      },
    });

    // Fetch storage locations for these packages
    const locationIds = packages
      .map((p) => p.storageLocationId)
      .filter((id): id is string => id !== null);

    const locations = await this.prisma.storageLocation.findMany({
      where: { id: { in: locationIds } },
      select: {
        id: true,
        code: true,
        shelf: true,
        level: true,
        slot: true,
      },
    });

    const locationMap = new Map(locations.map((l) => [l.id, l]));

    // Build a map from packageId to delivery for efficient lookup
    const packageToDeliveryMap = new Map<string, (typeof deliveries)[number]>();
    for (const delivery of deliveries) {
      for (const dp of delivery.deliveryPackages) {
        packageToDeliveryMap.set(dp.packageId, delivery);
      }
    }

    // Build pick list items with location details
    const pickItems = packages.map((pkg) => {
      const location = pkg.storageLocationId ? locationMap.get(pkg.storageLocationId) : null;

      const delivery = packageToDeliveryMap.get(pkg.id);

      return {
        packageId: pkg.id,
        packageCode: pkg.code,
        description: pkg.description,
        chargeableWeight: pkg.chargeableWeight ? Number(pkg.chargeableWeight) : 0,
        orderId: pkg.orderId,
        orderCode: delivery?.order.code ?? '',
        customerName: delivery?.order.customer.fullName ?? '',
        customerCode: delivery?.order.customer.code ?? '',
        deliveryId: delivery?.id ?? '',
        deliveryCode: delivery?.code ?? '',
        recipientName: delivery?.recipientName ?? '',
        locationCode: location?.code ?? 'UNASSIGNED',
        shelf: location?.shelf ?? 'ZZZ',
        level: location?.level ?? 'ZZZ',
        slot: location?.slot ?? 'ZZZ',
      };
    });

    // Sort by location: shelf -> level -> slot (ASC)
    pickItems.sort((a, b) => {
      if (a.shelf !== b.shelf) return a.shelf.localeCompare(b.shelf);
      if (a.level !== b.level) return a.level.localeCompare(b.level);
      return a.slot.localeCompare(b.slot);
    });

    this.logger.log(
      `Pick list generated for ${deliveryIds.length} deliveries: ` +
        `${pickItems.length} packages to pick`,
    );

    return {
      deliveryCount: deliveries.length,
      packageCount: pickItems.length,
      items: pickItems,
    };
  }
}
