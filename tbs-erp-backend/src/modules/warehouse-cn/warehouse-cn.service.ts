import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { Prisma, ShippingRoute, UserRole, WarehouseCNStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { WarehouseCNRepository } from './warehouse-cn.repository';
import { ChargeableWeightService } from './domain/chargeable-weight.service';
import { PreAlertMatchingService } from './domain/pre-alert-matching.service';
import { BatchReceiveDto } from './dto/batch-receive.dto';
import { WarehouseCNStatusMachine } from './domain/warehouse-cn-status.machine';
import { ReceivePackageDto } from './dto/receive-package.dto';
import { MeasurePackageDto } from './dto/measure-package.dto';
import { UnlockWeightDto } from './dto/unlock-weight.dto';

// Gioi han toi da scan hang loat
const BATCH_SCAN_LIMIT = 50;

// Cache TTL constants
/** TTL cho barcode scan cache: 5 phut */
const BARCODE_CACHE_TTL_MS = 300_000;
/** TTL cho scan log cache (batch scan history): 24 gio */
const SCAN_LOG_CACHE_TTL_MS = 86_400_000;

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
      throw new NotFoundException(`Order with ID ${dto.orderId} not found`);
    }

    // Layer 4A: Mandatory photo validation (defense-in-depth, DTO also validates)
    if (!dto.imageUrls || dto.imageUrls.length === 0) {
      throw new BadRequestException('Bắt buộc chụp ảnh kiện hàng khi nhận tại kho TQ');
    }

    // Layer 1A: Check order status — cannot receive packages for closed orders
    if (['CANCELLED', 'COMPLETED'].includes(order.status)) {
      throw new BadRequestException(
        `Đơn hàng ${order.code} đã đóng (${order.status}), không thể nhận kiện`,
      );
    }

    // KhoTQ-2: Check for duplicate tracking number — multi-piece aware warning
    if (dto.trackingNumberCN) {
      const existingPackages = await this.warehouseRepo.findAllByTrackingNumber(dto.trackingNumberCN);
      if (existingPackages.length > 0 && !dto.forceReceive) {
        // Look up pre-alert to determine expectedPieces
        const preAlert = await this.prisma.preAlert.findFirst({
          where: {
            trackingNumber: { equals: dto.trackingNumberCN, mode: 'insensitive' },
          },
          select: { expectedPieces: true },
          orderBy: { createdAt: 'desc' },
        });

        const expectedPieces = preAlert?.expectedPieces ?? null;
        const receivedCount = existingPackages.length;
        const isMultiPiece = expectedPieces ? receivedCount < expectedPieces : true;
        const firstPkg = existingPackages[0];

        this.logger.warn(
          `Duplicate tracking number ${dto.trackingNumberCN} detected ` +
            `(${receivedCount} existing). isMultiPiece=${isMultiPiece}. Returning warning.`,
        );

        return {
          warning: true,
          message: isMultiPiece
            ? `Ma van don ${dto.trackingNumberCN} da co ${receivedCount} kien (${existingPackages.map(p => p.code).join(', ')}). ${expectedPieces ? `Pre-alert bao ${expectedPieces} kien.` : ''} Nhan kien tiep theo?`
            : `Ma van don ${dto.trackingNumberCN} da co ${receivedCount}/${expectedPieces} kien. Da du so luong.`,
          isMultiPiece,
          receivedCount,
          expectedPieces,
          existingPackages: existingPackages.map(p => ({
            id: p.id,
            code: p.code,
            orderId: p.orderId,
            warehouseCNStatus: p.warehouseCNStatus,
            receivedCNAt: p.receivedCNAt,
          })),
          suggestedOrderId: firstPkg.orderId,
          package: null,
          preAlertMatch: null,
        };
      }
      if (existingPackages.length > 0 && dto.forceReceive) {
        this.logger.warn(
          `Force receiving duplicate tracking number ${dto.trackingNumberCN} ` +
            `(${existingPackages.length} existing packages)`,
        );
      }
    }

    // Wrap package creation and pre-alert matching in a transaction
    return this.prisma.executeInTransaction(async (tx) => {
      // Create the package record using tx directly
      const code = await this.warehouseRepo.generatePackageCode();
      const pkg = await tx.package.create({
        data: {
          code,
          orderId: dto.orderId,
          trackingNumberCN: dto.trackingNumberCN,
          description: dto.description,
          imageUrls: dto.imageUrls ?? [],
          note: dto.note,
          warehouseCNStatus: 'RECEIVED',
          receivedCNAt: new Date(),
          receivedCNBy: userId,
        },
      });

      // Attempt pre-alert matching
      let matchResult = null;
      if (dto.trackingNumberCN) {
        matchResult = await this.preAlertMatching.matchTracking(dto.trackingNumberCN, pkg.id, userId);
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
    });
  }

  /**
   * Measures a package with dimensions and weight.
   *
   * Calculates volumetric weight based on the order's shipping route,
   * determines the chargeable weight (MAX of actual vs volumetric),
   * and updates the package record.
   */
  async measurePackage(packageId: string, dto: MeasurePackageDto, userId: string) {
    // Find the package with its order (needed for shipping route)
    const pkg = await this.warehouseRepo.findById(packageId);

    if (!pkg) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    const allowedStatuses: WarehouseCNStatus[] = [WarehouseCNStatus.RECEIVED, WarehouseCNStatus.CHECKED];
    if (!allowedStatuses.includes(pkg.warehouseCNStatus as WarehouseCNStatus)) {
      throw new BadRequestException(
        `Kien ${pkg.code} dang o trang thai ${pkg.warehouseCNStatus}. Chi co the can do kien RECEIVED hoac CHECKED.`,
      );
    }

    // Layer 1B: Weight lock — cannot re-measure after container assignment
    if (pkg.containerId) {
      throw new BadRequestException(`Kiện ${pkg.code} đã gán container, không thể cân lại`);
    }

    // Layer 1B: Weight lock — cannot re-measure after weight confirmation
    if (pkg.weightConfirmedAt) {
      throw new BadRequestException(
        `Cân nặng kiện ${pkg.code} đã được xác nhận, không thể cân lại`,
      );
    }

    // Determine shipping route (from order, or default to SEA)
    const route: ShippingRoute = pkg.order?.shippingRoute ?? ShippingRoute.SEA;

    // Calculate chargeable weight
    const weightResult = this.chargeableWeight.calculateChargeableWeight(
      dto.actualWeight,
      dto.length,
      dto.width,
      dto.height,
      route,
    );

    // Wrap measurements update + cnWeight save in a single transaction
    const result = await this.prisma.executeInTransaction(async (tx) => {
      // Update the package with measurements + cnWeight + auto-confirm weight
      const updatedPackage = await tx.package.update({
        where: { id: packageId },
        data: {
          actualWeight: new Decimal(dto.actualWeight),
          length: new Decimal(dto.length),
          width: new Decimal(dto.width),
          height: new Decimal(dto.height),
          volumetricWeight: new Decimal(weightResult.volumetricWeight),
          chargeableWeight: new Decimal(weightResult.chargeableWeight),
          cnWeight: new Decimal(dto.actualWeight),
          warehouseCNStatus: WarehouseCNStatus.CHECKED,
          weightConfirmedAt: new Date(),
          weightConfirmedBy: userId,
        },
      });

      // Write WeightAuditLog with old + new values
      const isRemeasure = pkg.actualWeight != null;
      await tx.weightAuditLog.create({
        data: {
          packageId,
          action: isRemeasure ? 'REMEASURE' : 'MEASURE',
          oldActualWeight: pkg.actualWeight,
          oldLength: pkg.length,
          oldWidth: pkg.width,
          oldHeight: pkg.height,
          oldChargeableWeight: pkg.chargeableWeight,
          newActualWeight: new Decimal(dto.actualWeight),
          newLength: new Decimal(dto.length),
          newWidth: new Decimal(dto.width),
          newHeight: new Decimal(dto.height),
          newChargeableWeight: new Decimal(weightResult.chargeableWeight),
          performedBy: userId,
        },
      });

      return {
        package: updatedPackage,
        calculation: weightResult,
      };
    });

    // Emit measurement event AFTER transaction commits
    // so listeners can read the committed package data
    this.eventEmitter.emit('warehouse.package.measured', {
      packageId,
      orderId: pkg.orderId,
      actualWeight: dto.actualWeight,
      volumetricWeight: weightResult.volumetricWeight,
      chargeableWeight: weightResult.chargeableWeight,
      route,
      isVolumetric: weightResult.isVolumetric,
    });

    // CW bulky alert: notify Sale when CW >> actual weight
    if (weightResult.isVolumetric) {
      const cwRatio = weightResult.chargeableWeight / dto.actualWeight;
      if (cwRatio >= 3) {
        this.eventEmitter.emit('package.bulky_cw_alert', {
          packageId,
          packageCode: pkg.code,
          orderId: pkg.orderId,
          actualWeight: dto.actualWeight,
          volumetricWeight: weightResult.volumetricWeight,
          chargeableWeight: weightResult.chargeableWeight,
          cwRatio: Math.round(cwRatio * 10) / 10,
          route,
          dimensions: { length: dto.length, width: dto.width, height: dto.height },
        });
      }
    }

    // Spot-check: CW reduction > 50% on remeasure → flag
    const isRemeasureCheck = pkg.chargeableWeight != null;
    if (isRemeasureCheck) {
      const oldCW = Number(pkg.chargeableWeight);
      const newCW = weightResult.chargeableWeight;
      if (oldCW > 0 && newCW < oldCW) {
        const reductionPercent = (oldCW - newCW) / oldCW;
        if (reductionPercent > 0.5) {
          this.eventEmitter.emit('package.remeasure_spot_check', {
            packageId,
            packageCode: pkg.code,
            orderId: pkg.orderId,
            oldCW,
            newCW,
            reductionPercent: Math.round(reductionPercent * 100),
            measuredBy: userId,
          });
        }
      }
    }

    // P1-3: CW vs quotation variance alert (>10% triggers notification)
    if (pkg.orderId) {
      try {
        const order = await this.prisma.order.findUnique({
          where: { id: pkg.orderId },
          select: {
            code: true,
            saleId: true,
            totalChargeableWeight: true,
          },
        });

        if (order?.totalChargeableWeight) {
          const quotedCW = Number(order.totalChargeableWeight);
          const actualCW = weightResult.chargeableWeight;
          if (quotedCW > 0) {
            const variancePercent = Math.abs(actualCW - quotedCW) / quotedCW * 100;
            if (variancePercent > 10) {
              this.eventEmitter.emit('package.cw_variance_alert', {
                packageId,
                packageCode: pkg.code,
                orderId: pkg.orderId,
                orderCode: order.code,
                quotedCW,
                actualCW,
                variancePercent: Math.round(variancePercent * 10) / 10,
                direction: actualCW > quotedCW ? 'OVER' : 'UNDER',
                saleId: order.saleId,
              });
            }
          }
        }
      } catch (err) {
        this.logger.warn(`CW variance check failed for package ${pkg.code}: ${err.message}`);
      }
    }

    this.logger.log(
      `Package ${pkg.code} measured: ${dto.actualWeight}kg actual, ` +
        `${weightResult.volumetricWeight}kg volumetric, ` +
        `${weightResult.chargeableWeight}kg chargeable (${route})`,
    );

    return result;
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
      where.warehouseCNStatus = query.status as WarehouseCNStatus;
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
    const sortOrder = (query.sortOrder?.toLowerCase() ?? 'desc') as 'asc' | 'desc';

    const { data, total } = await this.warehouseRepo.findAll(where, skip, limit, {
      [sortBy]: sortOrder,
    } as Prisma.PackageOrderByWithRelationInput);

    return { data, total, page, limit };
  }

  /**
   * Updates the warehouse CN status of a package.
   * Valid transitions: RECEIVED -> CHECKED -> PACKED -> SHIPPED
   */
  async updatePackageStatus(packageId: string, newStatus: WarehouseCNStatus) {
    const pkg = await this.warehouseRepo.findById(packageId);

    if (!pkg) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    const currentStatus = pkg.warehouseCNStatus ?? WarehouseCNStatus.RECEIVED;
    this.statusMachine.assertTransition(currentStatus, newStatus);

    const updated = await this.warehouseRepo.updateStatus(packageId, newStatus);

    // Emit status change events
    if (newStatus === WarehouseCNStatus.PACKED) {
      this.eventEmitter.emit('warehouse.package.packed', {
        packageId,
        orderId: pkg.orderId,
        chargeableWeight: pkg.chargeableWeight ? Number(pkg.chargeableWeight) : 0,
        shippingRoute: pkg.order?.shippingRoute ?? 'SEA',
      });
    }

    if (newStatus === WarehouseCNStatus.SHIPPED) {
      this.eventEmitter.emit('warehouse.cn.package.shipped', {
        packageId,
        orderId: pkg.orderId,
        containerId: pkg.containerId,
      });
    }

    this.logger.log(`Package ${pkg.code} CN status changed: ${currentStatus} -> ${newStatus}`);

    return updated;
  }

  /**
   * B3: Scan barcode to look up a package by tracking number with Redis cache.
   */
  async scanBarcode(trackingNumber: string) {
    return this.cacheService.getOrSet(
      `barcode:${trackingNumber}`,
      async () => {
        const packages = await this.prisma.package.findMany({
          where: {
            trackingNumberCN: { equals: trackingNumber, mode: 'insensitive' },
          },
          include: {
            order: {
              select: {
                id: true,
                code: true,
                customerId: true,
                status: true,
                customer: {
                  select: { id: true, fullName: true, code: true, phone: true },
                },
              },
            },
            container: { select: { id: true, code: true, status: true } },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (packages.length === 0) return null;
        // Backward compatible: return first package + siblings info
        return {
          ...packages[0],
          siblings: packages.slice(1),
          totalPieces: packages.length,
        };
      },
      BARCODE_CACHE_TTL_MS,
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
    const validStatuses = ['NORMAL', 'CONFISCATED_BY_CUSTOMS', 'HIGH_RISK_HOLD', 'CUSTOMS_HELD'];

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

    this.logger.log(`Package ${pkg.code} independent status set to ${status} by ${userId}`);

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
      throw new BadRequestException(`Package ${pkg.code} is not marked as high risk`);
    }

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: {
        highRiskDisclaimerAccepted: true,
        highRiskAcceptedAt: new Date(),
        highRiskAcceptedBy: userId,
      },
    });

    this.logger.log(`High risk disclaimer accepted for package ${pkg.code} by ${userId}`);

    return updated;
  }

  /**
   * Batch receive multiple packages by tracking number.
   *
   * Iterates through each tracking number and attempts to find a matching
   * pre-alert. Returns summary of received, duplicates, and not-found.
   */
  async batchReceive(dto: BatchReceiveDto) {
    const received: string[] = [];
    const duplicates: string[] = [];
    const notFound: string[] = [];
    const multiPieceReceived: string[] = [];

    // ── Batch-fetch all needed data upfront to eliminate N+1 queries ──

    // All existing packages for every tracking number in this batch (1 query instead of N)
    const existingPackages = await this.prisma.package.findMany({
      where: { trackingNumberCN: { in: dto.trackingNumbers } },
      select: { id: true, trackingNumberCN: true, orderId: true, code: true },
    });

    // Build lookup: trackingNumber → list of packages (supports multi-piece)
    const existingMap = new Map<string, typeof existingPackages>();
    for (const pkg of existingPackages) {
      if (!pkg.trackingNumberCN) continue;
      const list = existingMap.get(pkg.trackingNumberCN) ?? [];
      list.push(pkg);
      existingMap.set(pkg.trackingNumberCN, list);
    }

    // Pre-alerts for RECEIVED status (multi-piece check) — 1 query instead of N
    const receivedPreAlerts = await this.prisma.preAlert.findMany({
      where: { trackingNumber: { in: dto.trackingNumbers }, status: 'RECEIVED' },
      select: { id: true, trackingNumber: true, expectedPieces: true, orderId: true },
    });
    const receivedPreAlertMap = new Map(receivedPreAlerts.map(pa => [pa.trackingNumber, pa]));

    // Pre-alerts for WAITING status (new package creation) — 1 query instead of N
    const waitingPreAlerts = await this.prisma.preAlert.findMany({
      where: { trackingNumber: { in: dto.trackingNumbers }, status: 'WAITING' },
      select: { id: true, trackingNumber: true, orderId: true },
    });
    const waitingPreAlertMap = new Map(waitingPreAlerts.map(pa => [pa.trackingNumber, pa]));

    // ── Main processing loop (no individual queries per iteration) ──

    for (const trackingNumber of dto.trackingNumbers) {
      const existingList = existingMap.get(trackingNumber) ?? [];
      const existing = existingList.length > 0 ? existingList[0] : null;

      if (existing) {
        // Multi-piece check: does a RECEIVED pre-alert expect more pieces?
        const allWithTracking = existingList.length;
        const preAlert = receivedPreAlertMap.get(trackingNumber) ?? null;

        if (preAlert?.expectedPieces && allWithTracking < preAlert.expectedPieces && preAlert.orderId) {
          // Not enough pieces yet -- create additional piece
          const code = await this.warehouseRepo.generatePackageCode();
          const pkg = await this.prisma.package.create({
            data: {
              code,
              trackingNumberCN: trackingNumber,
              orderId: preAlert.orderId,
              warehouseCNStatus: WarehouseCNStatus.RECEIVED,
              receivedCNAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
              receivedCNBy: dto.receivedBy ?? undefined,
              imageUrls: [],
            },
          });
          await this.preAlertMatching.matchTracking(trackingNumber, pkg.id, dto.receivedBy ?? 'system');

          this.eventEmitter.emit('warehouse.package.received', {
            packageId: pkg.id,
            orderId: preAlert.orderId,
            warehouse: 'CN',
            trackingNumberCN: trackingNumber,
            receivedBy: dto.receivedBy ?? 'system',
          });

          multiPieceReceived.push(trackingNumber);
          continue;
        }

        duplicates.push(trackingNumber);
        continue;
      }

      // Try to find a matching pre-alert (already fetched)
      const preAlert = waitingPreAlertMap.get(trackingNumber) ?? null;

      if (!preAlert || !preAlert.orderId) {
        notFound.push(trackingNumber);
        continue;
      }

      // Create the package record
      const code = await this.warehouseRepo.generatePackageCode();
      const pkg = await this.prisma.package.create({
        data: {
          code,
          trackingNumberCN: trackingNumber,
          orderId: preAlert.orderId,
          warehouseCNStatus: WarehouseCNStatus.RECEIVED,
          receivedCNAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
          receivedCNBy: dto.receivedBy ?? undefined,
          imageUrls: [],
        },
      });

      // Run pre-alert matching for side effects (linking, events, etc.)
      await this.preAlertMatching.matchTracking(trackingNumber, pkg.id, dto.receivedBy ?? 'system');

      this.eventEmitter.emit('warehouse.package.received', {
        packageId: pkg.id,
        orderId: preAlert.orderId,
        warehouse: 'CN',
        trackingNumberCN: trackingNumber,
        receivedBy: dto.receivedBy ?? 'system',
      });

      received.push(trackingNumber);
    }

    this.logger.log(
      `Batch receive: ${received.length} received, ${multiPieceReceived.length} multi-piece, ` +
        `${duplicates.length} duplicates, ${notFound.length} not found`,
    );

    return {
      received,
      multiPieceReceived,
      duplicates,
      notFound,
      total: dto.trackingNumbers.length,
    };
  }

  /**
   * Unlocks weight for a package so it can be re-measured.
   * Only allowed for WAREHOUSE_MANAGER, CEO, COO.
   */
  async unlockWeight(packageId: string, dto: UnlockWeightDto, userId: string, userRole: UserRole) {
    const allowedRoles: UserRole[] = [UserRole.WAREHOUSE_MANAGER, UserRole.CEO, UserRole.COO];
    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenException(
        `Role ${userRole} khong duoc phep mo khoa can nang`,
      );
    }

    const pkg = await this.warehouseRepo.findById(packageId);
    if (!pkg) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    if (!pkg.weightConfirmedAt) {
      throw new BadRequestException(`Kien ${pkg.code} chua duoc xac nhan can nang`);
    }

    await this.prisma.executeInTransaction(async (tx) => {
      // Clear weight confirmation
      await tx.package.update({
        where: { id: packageId },
        data: {
          weightConfirmedAt: null,
          weightConfirmedBy: null,
        },
      });

      // Write audit log
      await tx.weightAuditLog.create({
        data: {
          packageId,
          action: 'UNLOCK',
          oldActualWeight: pkg.actualWeight,
          oldLength: pkg.length,
          oldWidth: pkg.width,
          oldHeight: pkg.height,
          oldChargeableWeight: pkg.chargeableWeight,
          reason: dto.reason,
          performedBy: userId,
        },
      });
    });

    this.eventEmitter.emit('package.weight.unlocked', {
      packageId,
      packageCode: pkg.code,
      orderId: pkg.orderId,
      reason: dto.reason,
      unlockedBy: userId,
    });

    this.logger.log(
      `Package ${pkg.code} weight unlocked by ${userId}. Reason: ${dto.reason}`,
    );

    return { packageId, unlocked: true };
  }

  /**
   * Returns weight audit log history for a package.
   */
  async getWeightAuditLog(packageId: string) {
    const pkg = await this.warehouseRepo.findById(packageId);
    if (!pkg) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    const logs = await this.prisma.weightAuditLog.findMany({
      where: { packageId },
      orderBy: { createdAt: 'desc' },
    });

    return logs;
  }

  // ─────────────────────────────────────────────────────────────────
  // BATCH SCAN — Scan nhieu ma van don song song
  // ─────────────────────────────────────────────────────────────────

  /**
   * Scan hang loat toi da 50 ma van don, tra ve ket qua cho tung ma.
   *
   * Su dung Promise.allSettled de xu ly song song khong chan nhau.
   * Ghi scan event vao audit log de theo doi lich su.
   */
  async batchScan(trackingNumbers: string[], userId: string) {
    if (!trackingNumbers || trackingNumbers.length === 0) {
      throw new BadRequestException('Can it nhat 1 ma van don');
    }
    if (trackingNumbers.length > BATCH_SCAN_LIMIT) {
      throw new BadRequestException(
        `Qua gioi han: toi da ${BATCH_SCAN_LIMIT} ma van don moi lan scan`,
      );
    }

    // Xu ly theo lo de tranh con pool bi bao hoa (toi da 10 query song song)
    const BATCH_SIZE = 10;
    const rawResults: PromiseSettledResult<{ trackingNumber: string; packages: any[] }>[] = [];

    for (let i = 0; i < trackingNumbers.length; i += BATCH_SIZE) {
      const batch = trackingNumbers.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (tn) => {
          const packages = await this.prisma.package.findMany({
            where: {
              trackingNumberCN: { equals: tn, mode: 'insensitive' },
            },
            select: {
              id: true,
              code: true,
              warehouseCNStatus: true,
              warehouseVNStatus: true,
              receivedCNAt: true,
              chargeableWeight: true,
              containerId: true,
              order: {
                select: {
                  id: true,
                  code: true,
                  customer: { select: { fullName: true, code: true } },
                },
              },
              container: { select: { id: true, code: true, status: true } },
            },
            orderBy: { createdAt: 'asc' },
          });

          return { trackingNumber: tn, packages };
        }),
      );
      rawResults.push(...batchResults);
    }

    const results = rawResults;

    // Ghi scan event vao audit log (WeightAuditLog khong phu hop —
    // dung AuditLog chung neu co, hoac ghi thang vao log)
    // Lay danh sach package tim thay de ghi log
    const scannedPackageIds: string[] = [];
    const output = results.map((r, idx) => {
      const tn = trackingNumbers[idx];
      if (r.status === 'fulfilled') {
        const { packages } = r.value;
        if (packages.length > 0) {
          scannedPackageIds.push(...packages.map(p => p.id));
          return {
            trackingNumber: tn,
            status: 'found' as const,
            packages,
            totalPieces: packages.length,
          };
        }
        return { trackingNumber: tn, status: 'not_found' as const, packages: [], totalPieces: 0 };
      }
      return { trackingNumber: tn, status: 'error' as const, packages: [], totalPieces: 0 };
    });

    // Ghi lich su scan vao WeightAuditLog — dung record scan rieng
    // Luu y: WeightAuditLog dung cho package cu the, nen ta log scan vao
    // redis cache nhu mot event don gian (khong them migration moi)
    if (scannedPackageIds.length > 0) {
      try {
        await this.cacheService.set(
          `scan:batch:${userId}:${Date.now()}`,
          {
            userId,
            trackingNumbers,
            found: output.filter(r => r.status === 'found').length,
            scannedAt: new Date().toISOString(),
          },
          SCAN_LOG_CACHE_TTL_MS,
        );
      } catch {
        // Khong nen chan scan neu cache loi
      }
    }

    this.logger.log(
      `Batch scan boi ${userId}: ${trackingNumbers.length} ma, ` +
        `${output.filter(r => r.status === 'found').length} tim thay, ` +
        `${output.filter(r => r.status === 'not_found').length} khong thay`,
    );

    return {
      results: output,
      summary: {
        total: trackingNumbers.length,
        found: output.filter(r => r.status === 'found').length,
        notFound: output.filter(r => r.status === 'not_found').length,
        error: output.filter(r => r.status === 'error').length,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // SCAN HISTORY & STATS — Lich su va thong ke scan
  // ─────────────────────────────────────────────────────────────────

  /**
   * Lay lich su scan cua nhan vien, lay tu WeightAuditLog (action=MEASURE/REMEASURE)
   * va Package receivedCNAt de uoc tinh hoat dong scan.
   *
   * Voi hien trang he thong (khong co bang ScanLog rieng), su dung
   * Package.receivedCNBy + receivedCNAt la proxy cho hoat dong scan nhan kien.
   */
  async getScanHistory(params: { userId?: string; date?: string; limit: number }) {
    const { userId, date, limit } = params;
    const effectiveLimit = Math.min(limit, 200);

    // Xay dung dieu kien loc theo ngay
    let dateFilter: Prisma.DateTimeFilter | undefined;
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      dateFilter = { gte: startOfDay, lte: endOfDay };
    }

    // Lay lich su nhan kien (moi nhan = 1 lan scan)
    const where: Prisma.PackageWhereInput = {
      receivedCNAt: { not: null },
      ...(userId ? { receivedCNBy: userId } : {}),
      ...(dateFilter ? { receivedCNAt: dateFilter } : {}),
    };

    const packages = await this.prisma.package.findMany({
      where,
      select: {
        id: true,
        code: true,
        trackingNumberCN: true,
        receivedCNAt: true,
        receivedCNBy: true,
        warehouseCNStatus: true,
        order: {
          select: {
            code: true,
            customer: { select: { fullName: true, code: true } },
          },
        },
      },
      orderBy: { receivedCNAt: 'desc' },
      take: effectiveLimit,
    });

    return {
      history: packages.map(p => ({
        packageId: p.id,
        packageCode: p.code,
        trackingNumber: p.trackingNumberCN ?? '',
        scannedAt: p.receivedCNAt,
        scannedBy: p.receivedCNBy,
        orderCode: p.order?.code ?? '',
        customerName: p.order?.customer?.fullName ?? '',
        status: p.warehouseCNStatus,
      })),
      total: packages.length,
    };
  }

  /**
   * Thong ke hoat dong scan:
   *   - Tong so kien nhan hom nay
   *   - Trung binh so kien/ngay trong 30 ngay
   *   - Top 5 nhan vien scan nhieu nhat trong 30 ngay
   */
  async getScanStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Tong scan hom nay
    const todayCount = await this.prisma.package.count({
      where: { receivedCNAt: { gte: today, lte: todayEnd } },
    });

    // Tong scan trong 30 ngay
    const thirtyDayCount = await this.prisma.package.count({
      where: { receivedCNAt: { gte: thirtyDaysAgo } },
    });

    const avgPerDay = Math.round(thirtyDayCount / 30 * 10) / 10;

    // Top scanners trong 30 ngay (nhom theo receivedCNBy)
    const topScanners = await this.prisma.package.groupBy({
      by: ['receivedCNBy'],
      where: {
        receivedCNAt: { gte: thirtyDaysAgo },
        receivedCNBy: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    // Lay ten nhan vien
    const scannerIds = topScanners
      .map(s => s.receivedCNBy)
      .filter((id): id is string => id !== null);

    const users = await this.prisma.user.findMany({
      where: { id: { in: scannerIds } },
      select: { id: true, fullName: true, role: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    return {
      today: todayCount,
      last30Days: thirtyDayCount,
      avgPerDay,
      topScanners: topScanners.map(s => ({
        userId: s.receivedCNBy,
        fullName: s.receivedCNBy ? (userMap.get(s.receivedCNBy)?.fullName ?? 'N/A') : 'N/A',
        role: s.receivedCNBy ? (userMap.get(s.receivedCNBy)?.role ?? '') : '',
        count: s._count.id,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PACKAGE TIMELINE — Hanh trinh di chuyen cua kien hang
  // ─────────────────────────────────────────────────────────────────

  /**
   * Lay toan bo hanh trinh cua kien hang tu kho TQ den khi giao:
   *   1. Nhan tai kho TQ
   *   2. Do luong (anh, trong luong, kich thuoc)
   *   3. Xep vao container
   *   4. Den kho VN
   *   5. Giao hang
   *
   * Query du lieu tu Package, TrackingEvent, Container.
   */
  async getPackageTimeline(packageId: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            customerId: true,
            customer: { select: { fullName: true, code: true } },
          },
        },
        container: {
          select: {
            id: true,
            code: true,
            status: true,
            actualDepartureAt: true,
            actualArrivalAt: true,
          },
        },
        trackingEvents: {
          orderBy: { eventTimestamp: 'asc' },
          select: {
            id: true,
            eventType: true,
            location: true,
            description: true,
            eventTimestamp: true,
            carrier: true,
            source: true,
          },
        },
        deliveryPackages: {
          select: {
            deliveryId: true,
            delivery: {
              select: {
                id: true,
                code: true,
                deliveredAt: true,
                dispatchedBy: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!pkg) {
      throw new NotFoundException(`Khong tim thay kien hang ID: ${packageId}`);
    }

    // Xay dung timeline theo thu tu thoi gian
    const milestones: TimelineMilestone[] = [];

    // Milestone 1: Nhan tai kho TQ
    if (pkg.receivedCNAt) {
      milestones.push({
        step: 1,
        event: 'RECEIVED_CN',
        label: 'Nhan tai kho Trung Quoc',
        timestamp: pkg.receivedCNAt,
        performedBy: pkg.receivedCNBy ?? undefined,
        photos: pkg.imageUrls,
        details: {
          orderCode: pkg.order.code,
          trackingNumberCN: pkg.trackingNumberCN ?? undefined,
        },
      });
    }

    // Milestone 2: Do luong
    if (pkg.weightConfirmedAt) {
      milestones.push({
        step: 2,
        event: 'MEASURED',
        label: 'Do luong kien hang',
        timestamp: pkg.weightConfirmedAt,
        performedBy: pkg.weightConfirmedBy ?? undefined,
        details: {
          actualWeight: pkg.actualWeight ? Number(pkg.actualWeight) : undefined,
          length: pkg.length ? Number(pkg.length) : undefined,
          width: pkg.width ? Number(pkg.width) : undefined,
          height: pkg.height ? Number(pkg.height) : undefined,
          chargeableWeight: pkg.chargeableWeight ? Number(pkg.chargeableWeight) : undefined,
        },
      });
    }

    // Milestone 3: Xep vao container
    if (pkg.container && pkg.containerId) {
      milestones.push({
        step: 3,
        event: 'LOADED_CONTAINER',
        label: 'Xep vao container',
        timestamp: pkg.packedAt ?? undefined,
        details: {
          containerCode: pkg.container.code,
          containerStatus: pkg.container.status,
          departedAt: pkg.container.actualDepartureAt ?? undefined,
        },
      });
    }

    // Milestone 4: Den kho VN
    if (pkg.receivedVNAt) {
      milestones.push({
        step: 4,
        event: 'RECEIVED_VN',
        label: 'Den kho Viet Nam',
        timestamp: pkg.receivedVNAt,
        performedBy: pkg.receivedVNBy ?? undefined,
        details: {
          containerArrivedAt: pkg.container?.actualArrivalAt ?? undefined,
        },
      });
    }

    // Milestone 5: Giao hang
    if (pkg.deliveredAt) {
      const delivery = pkg.deliveryPackages?.[0]?.delivery;
      milestones.push({
        step: 5,
        event: 'DELIVERED',
        label: 'Da giao hang',
        timestamp: pkg.deliveredAt,
        performedBy: delivery?.dispatchedBy ?? undefined,
        details: {
          deliveryCode: delivery?.code ?? undefined,
          deliveryStatus: delivery?.status ?? undefined,
        },
      });
    }

    // Them cac tracking events (tu carrier nhu 17track, kuaidi100) vao between milestones
    const trackingEvents = pkg.trackingEvents.map(te => ({
      event: te.eventType,
      label: te.description ?? te.eventType,
      timestamp: te.eventTimestamp,
      location: te.location ?? undefined,
      carrier: te.carrier ?? undefined,
      source: te.source ?? undefined,
    }));

    // Tinh thoi gian xu ly
    const firstEvent = pkg.receivedCNAt;
    const lastEvent = pkg.deliveredAt ?? pkg.receivedVNAt ?? pkg.packedAt ?? null;
    const processingDays = firstEvent && lastEvent
      ? Math.round((lastEvent.getTime() - firstEvent.getTime()) / 86_400_000 * 10) / 10
      : null;

    this.logger.log(`Timeline kien hang ${pkg.code}: ${milestones.length} moc`);

    return {
      packageId: pkg.id,
      packageCode: pkg.code,
      trackingNumberCN: pkg.trackingNumberCN ?? undefined,
      orderCode: pkg.order.code,
      customerName: pkg.order.customer?.fullName ?? undefined,
      currentStatus: {
        cn: pkg.warehouseCNStatus,
        vn: pkg.warehouseVNStatus,
      },
      milestones,
      trackingEvents,
      processingDays,
    };
  }
  // ─────────────────────────────────────────────────────────────────
  // CRON: LONG STORAGE ALERT — Cảnh báo kiện tồn kho TQ > 30 ngày
  // ─────────────────────────────────────────────────────────────────

  /**
   * Cron job: Alert packages stored in CN warehouse for more than 30 days.
   * Runs daily at 9AM. Emits notification for each overdue package.
   */
  @Cron('0 9 * * *')
  async alertLongStoragePackages(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const overduePackages = await this.prisma.package.findMany({
      where: {
        receivedCNAt: { not: null, lt: cutoff },
        warehouseCNStatus: { notIn: ['SHIPPED'] },
      },
      select: {
        id: true,
        code: true,
        orderId: true,
        trackingNumberCN: true,
        receivedCNAt: true,
        warehouseCNStatus: true,
        order: {
          select: {
            code: true,
            saleId: true,
            customer: { select: { fullName: true, code: true } },
          },
        },
      },
    });

    if (overduePackages.length === 0) {
      return;
    }

    this.logger.warn(
      `Long storage alert: ${overduePackages.length} package(s) in CN warehouse > 30 days`,
    );

    for (const pkg of overduePackages) {
      const storageDays = Math.floor(
        (Date.now() - (pkg.receivedCNAt?.getTime() ?? Date.now())) / 86_400_000,
      );

      this.eventEmitter.emit('package.storage_exceeded', {
        packageId: pkg.id,
        packageCode: pkg.code,
        orderId: pkg.orderId,
        orderCode: pkg.order?.code,
        trackingNumberCN: pkg.trackingNumberCN,
        storageDays,
        customerName: pkg.order?.customer?.fullName,
        customerCode: pkg.order?.customer?.code,
        saleId: pkg.order?.saleId,
        status: pkg.warehouseCNStatus,
      });
    }

    this.eventEmitter.emit('package.storage_exceeded.summary', {
      count: overduePackages.length,
      checkedAt: new Date(),
    });
  }
}

// ─────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────

export interface TimelineMilestone {
  step: number;
  event: string;
  label: string;
  timestamp: Date | undefined;
  performedBy?: string;
  photos?: string[];
  details?: Record<string, unknown>;
}
