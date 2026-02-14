import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, ShippingRoute } from '@prisma/client';
import { WarehouseCNRepository } from './warehouse-cn.repository';
import { ChargeableWeightService } from './domain/chargeable-weight.service';
import { PreAlertMatchingService } from './domain/pre-alert-matching.service';
import { ReceivePackageDto } from './dto/receive-package.dto';
import { MeasurePackageDto } from './dto/measure-package.dto';

@Injectable()
export class WarehouseCNService {
  private readonly logger = new Logger(WarehouseCNService.name);

  constructor(
    private readonly warehouseRepo: WarehouseCNRepository,
    private readonly chargeableWeight: ChargeableWeightService,
    private readonly preAlertMatching: PreAlertMatchingService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Receives a package at Warehouse CN.
   *
   * Flow:
   *  1. Validate the order exists
   *  2. Check for duplicate tracking number
   *  3. Create the package record with RECEIVED status
   *  4. Attempt pre-alert matching
   *  5. Emit package received event
   */
  async receivePackage(dto: ReceivePackageDto, userId: string) {
    // Validate order exists
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      select: {
        id: true,
        code: true,
        customerId: true,
        shippingRoute: true,
        status: true,
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Order with ID ${dto.orderId} not found`,
      );
    }

    // Check for duplicate tracking number
    if (dto.trackingNumberCN) {
      const existing = await this.warehouseRepo.findByTrackingNumber(
        dto.trackingNumberCN,
      );
      if (existing) {
        throw new ConflictException(
          `Package with tracking number ${dto.trackingNumberCN} already exists: ${existing.code}`,
        );
      }
    }

    // Create the package record
    const pkg = await this.warehouseRepo.createPackage({
      orderId: dto.orderId,
      trackingNumberCN: dto.trackingNumberCN,
      description: dto.description,
      imageUrls: dto.imageUrls,
      note: dto.note,
      receivedCNBy: userId,
    });

    // Attempt pre-alert matching
    let matchResult = null;
    if (dto.trackingNumberCN) {
      matchResult = await this.preAlertMatching.matchTracking(
        dto.trackingNumberCN,
        pkg.id,
        userId,
      );
    }

    // Emit events
    this.eventEmitter.emit('warehouse.package.received', {
      packageId: pkg.id,
      orderId: dto.orderId,
      warehouse: 'CN',
      trackingNumberCN: dto.trackingNumberCN,
      receivedBy: userId,
    });

    this.logger.log(
      `Package ${pkg.code} received at Warehouse CN for order ${order.code}. ` +
        `Pre-alert match: ${matchResult?.matched ? 'YES' : 'NO'}`,
    );

    return {
      package: pkg,
      preAlertMatch: matchResult,
    };
  }

  /**
   * Measures a package with dimensions and weight.
   *
   * Calculates volumetric weight based on the order's shipping route,
   * determines the chargeable weight (MAX of actual vs volumetric),
   * and updates the package record.
   */
  async measurePackage(
    packageId: string,
    dto: MeasurePackageDto,
    userId: string,
  ) {
    // Find the package with its order (needed for shipping route)
    const pkg = await this.warehouseRepo.findById(packageId);

    if (!pkg) {
      throw new NotFoundException(
        `Package with ID ${packageId} not found`,
      );
    }

    if (pkg.warehouseCNStatus !== 'RECEIVED') {
      throw new BadRequestException(
        `Package ${pkg.code} is in ${pkg.warehouseCNStatus} status. ` +
          `Only RECEIVED packages can be measured.`,
      );
    }

    // Determine shipping route (from order, or default to SEA)
    const route: ShippingRoute =
      pkg.order?.shippingRoute ?? ShippingRoute.SEA;

    // Calculate chargeable weight
    const weightResult = this.chargeableWeight.calculateChargeableWeight(
      dto.actualWeight,
      dto.length,
      dto.width,
      dto.height,
      route,
    );

    // Update the package with measurements
    const updatedPackage = await this.warehouseRepo.updateMeasurements(
      packageId,
      {
        actualWeight: dto.actualWeight,
        length: dto.length,
        width: dto.width,
        height: dto.height,
        volumetricWeight: weightResult.volumetricWeight,
        chargeableWeight: weightResult.chargeableWeight,
      },
    );

    // Emit measurement event
    this.eventEmitter.emit('warehouse.package.measured', {
      packageId,
      orderId: pkg.orderId,
      actualWeight: dto.actualWeight,
      volumetricWeight: weightResult.volumetricWeight,
      chargeableWeight: weightResult.chargeableWeight,
      route,
      isVolumetric: weightResult.isVolumetric,
    });

    this.logger.log(
      `Package ${pkg.code} measured: ${dto.actualWeight}kg actual, ` +
        `${weightResult.volumetricWeight}kg volumetric, ` +
        `${weightResult.chargeableWeight}kg chargeable (${route})`,
    );

    return {
      package: updatedPackage,
      calculation: weightResult,
    };
  }

  /**
   * Lists packages at Warehouse CN with pagination and filters.
   */
  async listPackages(query: {
    page?: number;
    limit?: number;
    status?: string;
    orderId?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PackageWhereInput = {
      // Only packages that have been received at CN warehouse
      receivedCNAt: { not: null },
    };

    if (query.status) {
      where.warehouseCNStatus = query.status;
    }

    if (query.orderId) {
      where.orderId = query.orderId;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        {
          trackingNumberCN: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const sortBy = query.sortBy ?? 'receivedCNAt';
    const sortOrder = (query.sortOrder?.toLowerCase() ?? 'desc') as
      | 'asc'
      | 'desc';

    const { data, total } = await this.warehouseRepo.findAll(
      where,
      skip,
      limit,
      { [sortBy]: sortOrder } as Prisma.PackageOrderByWithRelationInput,
    );

    return { data, total, page, limit };
  }

  /**
   * Updates the warehouse CN status of a package.
   * Valid transitions: RECEIVED -> CHECKED -> PACKED -> SHIPPED
   */
  async updatePackageStatus(packageId: string, newStatus: string) {
    const pkg = await this.warehouseRepo.findById(packageId);

    if (!pkg) {
      throw new NotFoundException(
        `Package with ID ${packageId} not found`,
      );
    }

    const validTransitions: Record<string, string[]> = {
      RECEIVED: ['CHECKED'],
      CHECKED: ['PACKED'],
      PACKED: ['SHIPPED'],
      SHIPPED: [],
    };

    const currentStatus = pkg.warehouseCNStatus ?? 'RECEIVED';
    const allowed = validTransitions[currentStatus] ?? [];

    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}. ` +
          `Allowed transitions: ${allowed.join(', ') || 'none'}`,
      );
    }

    const updated = await this.warehouseRepo.updateStatus(
      packageId,
      newStatus,
    );

    // Emit status change events
    if (newStatus === 'PACKED') {
      this.eventEmitter.emit('warehouse.package.packed', {
        packageId,
        orderId: pkg.orderId,
        chargeableWeight: pkg.chargeableWeight
          ? Number(pkg.chargeableWeight)
          : 0,
        shippingRoute: pkg.order?.shippingRoute ?? 'SEA',
      });
    }

    if (newStatus === 'SHIPPED') {
      this.eventEmitter.emit('warehouse.cn.package.shipped', {
        packageId,
        orderId: pkg.orderId,
        containerId: pkg.containerId,
      });
    }

    this.logger.log(
      `Package ${pkg.code} CN status changed: ${currentStatus} -> ${newStatus}`,
    );

    return updated;
  }
}
