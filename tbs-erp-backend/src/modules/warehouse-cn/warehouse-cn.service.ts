import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { Prisma, ShippingRoute } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { WarehouseCNRepository } from './warehouse-cn.repository';
import { ChargeableWeightService } from './domain/chargeable-weight.service';
import { PreAlertMatchingService } from './domain/pre-alert-matching.service';
import { WarehouseCNStatusMachine } from './domain/warehouse-cn-status.machine';
import { ReceivePackageDto } from './dto/receive-package.dto';
import { MeasurePackageDto } from './dto/measure-package.dto';

@Injectable()
export class WarehouseCNService {
  private readonly logger = new Logger(WarehouseCNService.name);

  constructor(
    private readonly warehouseRepo: WarehouseCNRepository,
    private readonly chargeableWeight: ChargeableWeightService,
    private readonly preAlertMatching: PreAlertMatchingService,
    private readonly statusMachine: WarehouseCNStatusMachine,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheService: CacheService,
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

    // Layer 4A: Mandatory photo validation (defense-in-depth, DTO also validates)
    if (!dto.imageUrls || dto.imageUrls.length === 0) {
      throw new BadRequestException(
        'Bắt buộc chụp ảnh kiện hàng khi nhận tại kho TQ',
      );
    }

    // Layer 1A: Check order status — cannot receive packages for closed orders
    if (['CANCELLED', 'COMPLETED'].includes(order.status)) {
      throw new BadRequestException(
        `Đơn hàng ${order.code} đã đóng (${order.status}), không thể nhận kiện`,
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

    // Layer 1B: Weight lock — cannot re-measure after container assignment
    if (pkg.containerId) {
      throw new BadRequestException(
        `Kiện ${pkg.code} đã gán container, không thể cân lại`,
      );
    }

    // Layer 1B: Weight lock — cannot re-measure after weight confirmation
    if (pkg.weightConfirmedAt) {
      throw new BadRequestException(
        `Cân nặng kiện ${pkg.code} đã được xác nhận, không thể cân lại`,
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

    // Update the package with measurements (B4: also save cnWeight)
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

    // B4: Save cnWeight = actualWeight at CN warehouse
    await this.prisma.package.update({
      where: { id: packageId },
      data: { cnWeight: new Decimal(dto.actualWeight) },
    });

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

    const currentStatus = pkg.warehouseCNStatus ?? 'RECEIVED';
    this.statusMachine.assertTransition(currentStatus, newStatus);

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

  /**
   * B3: Scan barcode to look up a package by tracking number with Redis cache.
   */
  async scanBarcode(trackingNumber: string) {
    return this.cacheService.getOrSet(
      `barcode:${trackingNumber}`,
      async () => {
        const pkg = await this.prisma.package.findFirst({
          where: {
            trackingNumberCN: {
              equals: trackingNumber,
              mode: 'insensitive',
            },
          },
          include: {
            order: {
              select: {
                id: true,
                code: true,
                customerId: true,
                status: true,
                customer: {
                  select: {
                    id: true,
                    fullName: true,
                    code: true,
                    phone: true,
                  },
                },
              },
            },
            container: {
              select: { id: true, code: true, status: true },
            },
          },
        });

        if (!pkg) {
          return null;
        }

        return pkg;
      },
      300_000, // TTL 300 seconds
    );
  }

  /**
   * B5: Set independent status for a package.
   * Valid statuses: NORMAL, CONFISCATED_BY_CUSTOMS, HIGH_RISK_HOLD
   */
  async setPackageIndependentStatus(
    packageId: string,
    status: string,
    reason: string,
    userId: string,
  ) {
    const validStatuses = ['NORMAL', 'CONFISCATED_BY_CUSTOMS', 'HIGH_RISK_HOLD'];

    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        `Invalid independent status: ${status}. Valid values: ${validStatuses.join(', ')}`,
      );
    }

    const pkg = await this.warehouseRepo.findById(packageId);
    if (!pkg) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    const updateData: Prisma.PackageUpdateInput = {
      independentStatus: status,
    };

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: updateData,
    });

    // If confiscated, also update the order status to ISSUE and emit event
    if (status === 'CONFISCATED_BY_CUSTOMS') {
      await this.prisma.order.update({
        where: { id: pkg.orderId },
        data: { status: 'ISSUE' as any },
      });

      this.eventEmitter.emit('package.confiscated', {
        packageId,
        packageCode: pkg.code,
        orderId: pkg.orderId,
        reason,
        setBy: userId,
      });

      this.logger.warn(
        `Package ${pkg.code} confiscated by customs. Order ${pkg.orderId} set to ISSUE. Reason: ${reason}`,
      );
    }

    this.logger.log(
      `Package ${pkg.code} independent status set to ${status} by ${userId}`,
    );

    return updated;
  }

  /**
   * B10: Mark a package as high risk.
   */
  async markHighRisk(packageId: string, userId: string) {
    const pkg = await this.warehouseRepo.findById(packageId);
    if (!pkg) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: { isHighRisk: true },
    });

    this.eventEmitter.emit('package.marked_high_risk', {
      packageId,
      packageCode: pkg.code,
      orderId: pkg.orderId,
      markedBy: userId,
    });

    this.logger.log(`Package ${pkg.code} marked as high risk by ${userId}`);

    return updated;
  }

  /**
   * B10: Accept high risk disclaimer for a package.
   */
  async acceptDisclaimer(packageId: string, userId: string) {
    const pkg = await this.warehouseRepo.findById(packageId);
    if (!pkg) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    if (!pkg.isHighRisk) {
      throw new BadRequestException(
        `Package ${pkg.code} is not marked as high risk`,
      );
    }

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: {
        highRiskDisclaimerAccepted: true,
        highRiskAcceptedAt: new Date(),
        highRiskAcceptedBy: userId,
      },
    });

    this.logger.log(
      `High risk disclaimer accepted for package ${pkg.code} by ${userId}`,
    );

    return updated;
  }
}
