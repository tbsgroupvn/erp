import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { ContainerStatus, Prisma, TrackingEventType, WarehouseCNStatus, WarehouseVNStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { buildDateFilter } from '@common/utils/date.util';
import { ContainerRepository } from './container.repository';
import { ConsolidationService } from './domain/consolidation.service';
import { ContainerStatusMachine } from './domain/container-status.machine';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { ContainerQueryDto } from './dto/container-query.dto';
import { RecordDeliveryOrderDto } from './dto/delivery-order.dto';
import { UpdateFreeTimeDto } from './dto/free-time.dto';

@Injectable()
export class ContainerService {
  private readonly logger = new Logger(ContainerService.name);

  constructor(
    private readonly containerRepo: ContainerRepository,
    private readonly consolidation: ConsolidationService,
    private readonly statusMachine: ContainerStatusMachine,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new container in PLANNING status.
   */
  async createContainer(dto: CreateContainerDto, userId: string) {
    const code = await this.containerRepo.generateContainerCode();

    const container = await this.containerRepo.create({
      code,
      shippingRoute: dto.shippingRoute,
      status: 'PLANNING',
      origin: dto.origin,
      destination: dto.destination,
      carrier: dto.carrier,
      bookingRef: dto.bookingRef,
      sealNumber: dto.sealNumber,
      vesselName: dto.vesselName,
      maxCapacity: dto.maxCapacity ? new Decimal(dto.maxCapacity) : undefined,
      estimatedDepartureAt: dto.estimatedDepartureAt ? new Date(dto.estimatedDepartureAt) : undefined,
      estimatedArrivalAt: dto.estimatedArrivalAt ? new Date(dto.estimatedArrivalAt) : undefined,
      // New fields
      containerNumber: dto.containerNumber,
      containerSize: dto.containerSize,
      blNumber: dto.blNumber,
      voyageNumber: dto.voyageNumber,
      portOfLoading: dto.portOfLoading,
      portOfDischarge: dto.portOfDischarge,
      customsOfficeCode: dto.customsOfficeCode,
      declaredVgm: dto.declaredVgm ? new Decimal(dto.declaredVgm) : undefined,
      createdBy: userId,
    });

    this.eventEmitter.emit('container.created', {
      containerId: container.id,
      code: container.code,
      shippingRoute: dto.shippingRoute,
      createdBy: userId,
    });

    this.logger.log(`Container ${code} created for route ${dto.shippingRoute} by ${userId}`);

    return container;
  }

  /**
   * Lists containers with pagination and filters.
   */
  async findAll(query: ContainerQueryDto) {
    const where: Prisma.ContainerWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.shippingRoute) {
      where.shippingRoute = query.shippingRoute;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { bookingRef: { contains: query.search, mode: 'insensitive' } },
        { vesselName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const dateFilter = buildDateFilter(query.startDate, query.endDate);
    if (dateFilter) {
      where.createdAt = dateFilter;
    }

    const { data, total } = await this.containerRepo.findAll(
      where,
      query.skip,
      query.limit,
      query.orderBy as Prisma.ContainerOrderByWithRelationInput,
    );

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets container detail by ID.
   */
  async findById(id: string) {
    const container = await this.containerRepo.findById(id);

    if (!container) {
      throw new NotFoundException(`Container with ID ${id} not found`);
    }

    return container;
  }

  /**
   * Updates container metadata.
   */
  async updateContainer(id: string, dto: UpdateContainerDto) {
    const container = await this.containerRepo.findById(id);

    if (!container) {
      throw new NotFoundException(`Container with ID ${id} not found`);
    }

    if (container.status === 'COMPLETED') {
      throw new BadRequestException('Completed containers cannot be modified');
    }

    const updateData: Prisma.ContainerUpdateInput = {};

    if (dto.shippingRoute !== undefined) updateData.shippingRoute = dto.shippingRoute;
    if (dto.origin !== undefined) updateData.origin = dto.origin;
    if (dto.destination !== undefined) updateData.destination = dto.destination;
    if (dto.carrier !== undefined) updateData.carrier = dto.carrier;
    if (dto.bookingRef !== undefined) updateData.bookingRef = dto.bookingRef;
    if (dto.sealNumber !== undefined) updateData.sealNumber = dto.sealNumber;
    if (dto.vesselName !== undefined) updateData.vesselName = dto.vesselName;
    if (dto.maxCapacity !== undefined) updateData.maxCapacity = new Decimal(dto.maxCapacity);
    if (dto.estimatedDepartureAt !== undefined)
      updateData.estimatedDepartureAt = new Date(dto.estimatedDepartureAt);
    if (dto.estimatedArrivalAt !== undefined)
      updateData.estimatedArrivalAt = new Date(dto.estimatedArrivalAt);
    // New fields
    if (dto.containerNumber !== undefined) updateData.containerNumber = dto.containerNumber;
    if (dto.containerSize !== undefined) updateData.containerSize = dto.containerSize;
    if (dto.blNumber !== undefined) updateData.blNumber = dto.blNumber;
    if (dto.voyageNumber !== undefined) updateData.voyageNumber = dto.voyageNumber;
    if (dto.portOfLoading !== undefined) updateData.portOfLoading = dto.portOfLoading;
    if (dto.portOfDischarge !== undefined) updateData.portOfDischarge = dto.portOfDischarge;
    if (dto.customsOfficeCode !== undefined) updateData.customsOfficeCode = dto.customsOfficeCode;
    if (dto.declaredVgm !== undefined) updateData.declaredVgm = new Decimal(dto.declaredVgm);

    return this.containerRepo.update(id, updateData);
  }

  /**
   * Adds packages to a container.
   *
   * Validates that:
   *  - The container is in PLANNING or LOADING status
   *  - All packages exist and are not already assigned to another container
   *  - Packages are in PACKED status at Warehouse CN
   *
   * Recalculates container weight totals and fill rate after adding.
   */
  async addPackages(containerId: string, packageIds: string[]) {
    return this.prisma.executeInTransaction(async (tx) => {
      const container = await tx.container.findUnique({
        where: { id: containerId },
        include: { packages: { select: { id: true } } },
      });

      if (!container) {
        throw new NotFoundException(`Container with ID ${containerId} not found`);
      }

      // Only allow adding in PLANNING or LOADING
      if (!['PLANNING', 'LOADING'].includes(container.status)) {
        throw new BadRequestException(
          `Cannot add packages to a container in ${container.status} status`,
        );
      }

      // Validate all packages
      const packages = await tx.package.findMany({
        where: { id: { in: packageIds } },
        select: {
          id: true,
          code: true,
          containerId: true,
          warehouseCNStatus: true,
          chargeableWeight: true,
          order: { select: { id: true, shippingRoute: true } },
        },
      });

      if (packages.length !== packageIds.length) {
        const foundIds = packages.map((p) => p.id);
        const missing = packageIds.filter((pid) => !foundIds.includes(pid));
        throw new NotFoundException(`Packages not found: ${missing.join(', ')}`);
      }

      // Check for packages already assigned to a different container
      const alreadyAssigned = packages.filter((p) => p.containerId && p.containerId !== containerId);
      if (alreadyAssigned.length > 0) {
        throw new BadRequestException(
          `Packages already assigned to another container: ${alreadyAssigned.map((p) => p.code).join(', ')}`,
        );
      }

      // Check warehouse status
      const notReady = packages.filter((p) => p.warehouseCNStatus !== WarehouseCNStatus.PACKED);
      if (notReady.length > 0) {
        throw new BadRequestException(
          `Packages not in PACKED status: ${notReady.map((p) => p.code).join(', ')}. ` +
            `Only PACKED packages can be added to a container.`,
        );
      }

      // Assign packages to container
      await tx.package.updateMany({
        where: { id: { in: packageIds } },
        data: { containerId },
      });

      // Also link orders to container (for cost allocation)
      const orderIds = [...new Set(packages.map((p) => p.order?.id).filter(Boolean))] as string[];
      if (orderIds.length > 0) {
        await tx.order.updateMany({
          where: { id: { in: orderIds }, containerId: null },
          data: { containerId },
        });
      }

      // Recalculate container totals
      const allPackages = await tx.package.findMany({
        where: { containerId },
        select: { chargeableWeight: true },
      });

      const totalPackages = allPackages.length;
      const totalWeight = allPackages.reduce(
        (sum, p) => sum + (p.chargeableWeight ? Number(p.chargeableWeight) : 0),
        0,
      );
      const maxCapacity = container.maxCapacity ? Number(container.maxCapacity) : 0;

      // Check against max capacity within the transaction
      if (maxCapacity > 0 && totalWeight > maxCapacity) {
        throw new BadRequestException(
          `Adding these packages would exceed container capacity. ` +
            `Total weight: ${totalWeight}kg, Max capacity: ${maxCapacity}kg`,
        );
      }

      const fillRate = maxCapacity > 0 ? (totalWeight / maxCapacity) * 100 : 0;

      const updated = await tx.container.update({
        where: { id: containerId },
        data: {
          totalPackages,
          totalWeight: new Decimal(totalWeight),
          fillRate: new Decimal(Math.round(fillRate * 100) / 100),
        },
      });

      this.eventEmitter.emit('container.packages.added', {
        containerId,
        containerCode: container.code,
        packageIds,
        totalPackages: updated.totalPackages,
        totalWeight: Number(updated.totalWeight),
      });

      this.logger.log(
        `Added ${packageIds.length} packages to container ${container.code}. ` +
          `Total: ${updated.totalPackages} packages, ${updated.totalWeight}kg`,
      );

      return updated;
    });
  }

  /**
   * Updates the container status with validation.
   * Emits events on specific transitions (e.g., ARRIVED triggers warehouse notification).
   */
  async updateStatus(id: string, newStatus: string, userId: string) {
    return this.prisma.executeInTransaction(async (tx) => {
      const container = await tx.container.findUnique({ where: { id } });

      if (!container) {
        throw new NotFoundException(`Container with ID ${id} not found`);
      }

      // Validate status transition via FSM
      this.statusMachine.assertTransition(container.status, newStatus as ContainerStatus);

      // Build update data with timestamps
      const updateData: Prisma.ContainerUpdateInput = { status: newStatus as ContainerStatus };

      switch (newStatus) {
        case 'IN_TRANSIT':
          updateData.actualDepartureAt = new Date();
          break;
        case 'ARRIVED':
          updateData.actualArrivalAt = new Date();
          break;
        case 'CUSTOMS':
          // Trigger customs declaration workflow
          this.eventEmitter.emit('container.customs.started', {
            containerId: id,
            containerCode: container.code,
            shippingRoute: container.shippingRoute,
            totalPackages: container.totalPackages,
            totalWeight: Number(container.totalWeight),
          });
          break;
        case 'COMPLETED':
          updateData.customsClearedAt = new Date();
          break;
      }

      const updated = await tx.container.update({ where: { id }, data: updateData });

      // Emit status-specific events
      this.eventEmitter.emit('container.status.changed', {
        containerId: id,
        containerCode: container.code,
        fromStatus: container.status,
        toStatus: newStatus,
        changedBy: userId,
        shippingRoute: container.shippingRoute,
      });

      // When container arrives, notify Warehouse VN
      if (newStatus === 'ARRIVED') {
        this.eventEmitter.emit('container.arrived', {
          containerId: id,
          containerCode: container.code,
          shippingRoute: container.shippingRoute,
          totalPackages: container.totalPackages,
          totalWeight: Number(container.totalWeight),
        });
      }

      // When container is in transit, update related orders
      if (newStatus === 'IN_TRANSIT') {
        this.eventEmitter.emit('container.departed', {
          containerId: id,
          containerCode: container.code,
          shippingRoute: container.shippingRoute,
        });
      }

      // B2: When container is held at border, notify affected customers
      if (newStatus === 'ON_HOLD_BORDER') {
        const ordersInContainer = await tx.order.findMany({
          where: { containerId: id },
          select: { customerId: true },
        });
        const customerIds = [...new Set(ordersInContainer.map((o) => o.customerId))];

        this.eventEmitter.emit('container.on_hold_border', {
          containerId: id,
          containerCode: container.code,
          customerIds,
        });
      }

      this.logger.log(
        `Container ${container.code} status changed: ${container.status} -> ${newStatus} by ${userId}`,
      );

      return updated;
    });
  }

  /**
   * Calculates and returns the current fill rate of a container.
   */
  async calculateFillRate(id: string) {
    return this.consolidation.calculateOptimalFill(id);
  }

  /**
   * Gets the consolidation plan suggestion.
   */
  async getConsolidationPlan() {
    return this.consolidation.suggestContainerPlan();
  }

  // -------------------------------------------------------------------------
  // Unload (Dỡ hàng) operations
  // -------------------------------------------------------------------------

  /**
   * Returns the unload manifest for a container:
   * the container info and its expected packages.
   */
  async getUnloadManifest(containerId: string) {
    const container = await this.prisma.container.findUnique({
      where: { id: containerId },
      include: {
        packages: {
          include: {
            order: {
              select: {
                id: true,
                code: true,
                customerId: true,
                customer: {
                  select: { fullName: true, code: true },
                },
              },
            },
          },
        },
      },
    });

    if (!container) {
      throw new NotFoundException(`Container with ID ${containerId} not found`);
    }

    return {
      container,
      expectedPackages: container.packages,
    };
  }

  /**
   * Records a barcode scan during container unloading.
   * Finds the package by code or tracking number, marks it as received at VN.
   */
  async scanPackageUnload(containerId: string, barcode: string, userId: string) {
    const container = await this.containerRepo.findById(containerId);
    if (!container) {
      throw new NotFoundException(`Container with ID ${containerId} not found`);
    }

    // Find the package by code or tracking number within this container
    const pkg = await this.prisma.package.findFirst({
      where: {
        containerId,
        OR: [
          { code: { equals: barcode, mode: 'insensitive' } },
          { trackingNumberCN: { equals: barcode, mode: 'insensitive' } },
        ],
      },
    });

    if (!pkg) {
      // Package not found in this container — it might be a surplus
      this.logger.warn(`Barcode ${barcode} not found in container ${container.code} — surplus`);
      return { matched: false, barcode, message: 'Kiện không thuộc container này' };
    }

    // Update the package: mark as received at VN warehouse
    const updated = await this.prisma.package.update({
      where: { id: pkg.id },
      data: {
        warehouseVNStatus: WarehouseVNStatus.RECEIVED,
        receivedVNAt: new Date(),
        receivedVNBy: userId,
      },
    });

    this.eventEmitter.emit('warehouse.package.received.vn', {
      packageId: pkg.id,
      packageCode: pkg.code,
      containerId,
      receivedBy: userId,
    });

    this.logger.log(
      `Package ${pkg.code} scanned & received at VN from container ${container.code}`,
    );

    return { matched: true, package: updated };
  }

  /**
   * Completes the unload process for a container.
   * Marks received packages, logs surplus/missing, and emits events.
   */
  async completeUnload(
    containerId: string,
    receivedPackageIds: string[],
    surplusBarcodes: string[],
    notes: string | undefined,
    userId: string,
  ) {
    const container = await this.containerRepo.findById(containerId);
    if (!container) {
      throw new NotFoundException(`Container with ID ${containerId} not found`);
    }

    // Mark all received packages as RECEIVED at VN
    if (receivedPackageIds.length > 0) {
      await this.prisma.package.updateMany({
        where: {
          id: { in: receivedPackageIds },
          containerId,
        },
        data: {
          warehouseVNStatus: WarehouseVNStatus.RECEIVED,
          receivedVNAt: new Date(),
          receivedVNBy: userId,
        },
      });
    }

    // Identify missing packages (in container but not received)
    const allContainerPackages = await this.prisma.package.findMany({
      where: { containerId },
      select: { id: true, code: true },
    });

    const receivedSet = new Set(receivedPackageIds);
    const missingPackages = allContainerPackages.filter((p) => !receivedSet.has(p.id));

    // Emit unload completed event
    this.eventEmitter.emit('container.unload.completed', {
      containerId,
      containerCode: container.code,
      receivedCount: receivedPackageIds.length,
      missingCount: missingPackages.length,
      missingPackageCodes: missingPackages.map((p) => p.code),
      surplusBarcodes,
      notes,
      completedBy: userId,
    });

    this.logger.log(
      `Container ${container.code} unload completed: ` +
        `${receivedPackageIds.length} received, ${missingPackages.length} missing, ` +
        `${surplusBarcodes.length} surplus`,
    );

    return {
      message: 'Hoàn thành dỡ hàng',
      receivedCount: receivedPackageIds.length,
      missingCount: missingPackages.length,
      missingPackages: missingPackages.map((p) => p.code),
      surplusBarcodes,
    };
  }

  // -------------------------------------------------------------------------
  // D/O — Lệnh giao hàng (Delivery Order)
  // -------------------------------------------------------------------------

  /**
   * Ghi nhận việc nhận lệnh giao hàng (D/O) từ đại lý tàu.
   *
   * D/O là chứng từ bắt buộc để kéo container khỏi cảng. Phải có sau khi:
   *  1. Tờ khai hải quan đã thông quan (CLEARED)
   *  2. Đã thanh toán hết cước và phụ phí cho đại lý tàu
   *
   * Chỉ áp dụng khi container ở trạng thái ARRIVED / CUSTOMS / CUSTOMS_HOLD / COMPLETED.
   */
  async recordDeliveryOrder(id: string, dto: RecordDeliveryOrderDto, userId: string) {
    const container = await this.containerRepo.findById(id);
    if (!container) {
      throw new NotFoundException(`Container ${id} not found`);
    }

    const validStatuses: ContainerStatus[] = [
      ContainerStatus.ARRIVED,
      ContainerStatus.CUSTOMS,
      ContainerStatus.CUSTOMS_HOLD,
      ContainerStatus.COMPLETED,
    ];
    if (!validStatuses.includes(container.status)) {
      throw new BadRequestException(
        `D/O chỉ áp dụng khi container đã đến cảng. Trạng thái hiện tại: ${container.status}`,
      );
    }

    const updated = await this.prisma.container.update({
      where: { id },
      data: {
        doNumber: dto.doNumber,
        doReceivedAt: dto.doReceivedAt ? new Date(dto.doReceivedAt) : new Date(),
        doExpiryAt: dto.doExpiryAt ? new Date(dto.doExpiryAt) : undefined,
        doIssuedBy: dto.doIssuedBy,
      },
    });

    await this.prisma.trackingEvent.create({
      data: {
        containerId: id,
        eventType: TrackingEventType.DELIVERY_ORDER_RECEIVED,
        eventTimestamp: new Date(),
        description: `Nhận lệnh giao hàng D/O số: ${dto.doNumber}${dto.doIssuedBy ? ` từ ${dto.doIssuedBy}` : ''}${dto.doExpiryAt ? ` (hết hạn: ${new Date(dto.doExpiryAt).toLocaleDateString('vi-VN')})` : ''}`,
        location: container.portOfDischarge ?? '',
        createdBy: userId,
      },
    });

    this.eventEmitter.emit('container.do.received', {
      containerId: id,
      containerCode: container.code,
      doNumber: dto.doNumber,
      doExpiryAt: dto.doExpiryAt,
      doIssuedBy: dto.doIssuedBy,
    });

    this.logger.log(`Container ${container.code}: D/O ${dto.doNumber} received by ${userId}`);

    return updated;
  }

  // -------------------------------------------------------------------------
  // Free time / Demurrage — Lưu cont / Lưu bãi
  // -------------------------------------------------------------------------

  /**
   * Cập nhật thời hạn miễn phí lưu container tại cảng.
   *
   * Sau free time sẽ phát sinh phí demurrage (lưu cont) và detention (lưu rỗng).
   * Cần theo dõi để tránh phát sinh chi phí ngoài kế hoạch.
   */
  async updateFreeTime(id: string, dto: UpdateFreeTimeDto, userId: string) {
    const container = await this.containerRepo.findById(id);
    if (!container) {
      throw new NotFoundException(`Container ${id} not found`);
    }

    const freeTimeExpiry = new Date(dto.freeTimeExpiry);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((freeTimeExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const updated = await this.prisma.container.update({
      where: { id },
      data: {
        freeTimeExpiry,
        demurrageNote: dto.demurrageNote,
        // Nếu free time đã qua → set demurrageStartAt
        demurrageStartAt: freeTimeExpiry < now ? freeTimeExpiry : undefined,
      },
    });

    await this.prisma.trackingEvent.create({
      data: {
        containerId: id,
        eventType: TrackingEventType.FREE_TIME_UPDATED,
        eventTimestamp: new Date(),
        description: `Cập nhật hạn miễn phí lưu cont: ${freeTimeExpiry.toLocaleDateString('vi-VN')} (còn ${daysUntilExpiry} ngày)${dto.demurrageNote ? `. ${dto.demurrageNote}` : ''}`,
        location: container.portOfDischarge ?? '',
        createdBy: userId,
      },
    });

    this.logger.log(
      `Container ${container.code}: free time updated to ${dto.freeTimeExpiry} (${daysUntilExpiry} days left)`,
    );

    return updated;
  }

  // -------------------------------------------------------------------------
  // Timeline — Lịch sử hành trình container
  // -------------------------------------------------------------------------

  /**
   * Trả về toàn bộ lịch sử hành trình của container:
   *  - Các mốc trạng thái chính với ngày thực tế / dự kiến
   *  - Tất cả tracking events
   *  - Thông tin D/O và free time
   */
  async getTimeline(id: string) {
    const container = await this.prisma.container.findUnique({
      where: { id },
      include: {
        trackingEvents: {
          orderBy: { eventTimestamp: 'asc' },
        },
      },
    });

    if (!container) {
      throw new NotFoundException(`Container ${id} not found`);
    }

    // Các mốc hành trình theo FSM
    const milestones = [
      {
        status: 'PLANNING',
        label: 'Kế hoạch',
        icon: 'plan',
        estimatedDate: null,
        actualDate: container.createdAt,
        isDone: true,
      },
      {
        status: 'LOADING',
        label: 'Xếp hàng lên cont',
        icon: 'loading',
        estimatedDate: container.estimatedDepartureAt,
        actualDate: null,
        isDone: ['LOADING', 'IN_TRANSIT', 'ON_HOLD_BORDER', 'ARRIVED', 'CUSTOMS', 'CUSTOMS_HOLD', 'COMPLETED']
          .includes(container.status),
      },
      {
        status: 'IN_TRANSIT',
        label: 'Khởi hành',
        icon: 'ship',
        estimatedDate: container.estimatedDepartureAt,
        actualDate: container.actualDepartureAt,
        isDone: ['IN_TRANSIT', 'ON_HOLD_BORDER', 'ARRIVED', 'CUSTOMS', 'CUSTOMS_HOLD', 'COMPLETED']
          .includes(container.status),
      },
      {
        status: 'ARRIVED',
        label: 'Đến cảng VN',
        icon: 'anchor',
        estimatedDate: container.estimatedArrivalAt,
        actualDate: container.actualArrivalAt,
        isDone: ['ARRIVED', 'CUSTOMS', 'CUSTOMS_HOLD', 'COMPLETED'].includes(container.status),
      },
      {
        status: 'CUSTOMS',
        label: 'Thông quan',
        icon: 'stamp',
        estimatedDate: null,
        actualDate: null,
        isDone: ['CUSTOMS', 'CUSTOMS_HOLD', 'COMPLETED'].includes(container.status),
      },
      {
        status: 'COMPLETED',
        label: 'Hoàn thành',
        icon: 'check',
        estimatedDate: null,
        actualDate: container.customsClearedAt,
        isDone: container.status === 'COMPLETED',
      },
    ];

    // Thông tin D/O
    const doInfo = container.doNumber
      ? {
          doNumber: container.doNumber,
          doReceivedAt: container.doReceivedAt,
          doExpiryAt: container.doExpiryAt,
          doIssuedBy: container.doIssuedBy,
          isExpired: container.doExpiryAt ? new Date(container.doExpiryAt) < new Date() : false,
          daysUntilExpiry: container.doExpiryAt
            ? Math.ceil((new Date(container.doExpiryAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null,
        }
      : null;

    // Thông tin free time / demurrage
    const freeTimeInfo = container.freeTimeExpiry
      ? {
          freeTimeExpiry: container.freeTimeExpiry,
          demurrageStartAt: container.demurrageStartAt,
          demurrageNote: container.demurrageNote,
          isExpired: new Date(container.freeTimeExpiry) < new Date(),
          daysUntilExpiry: Math.ceil(
            (new Date(container.freeTimeExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          ),
        }
      : null;

    return {
      containerId: container.id,
      containerCode: container.code,
      status: container.status,
      milestones,
      trackingEvents: container.trackingEvents,
      doInfo,
      freeTimeInfo,
    };
  }

  // -------------------------------------------------------------------------
  // Cost Breakdown — Phân tích chi phí container
  // -------------------------------------------------------------------------

  /**
   * Tổng hợp chi phí vận hành phát sinh cho container, phân nhóm theo loại.
   *
   * Các loại chi phí điển hình của một lô hàng nhập khẩu:
   *  - FREIGHT: Cước vận chuyển
   *  - PORT_THC: Terminal Handling Charges
   *  - CUSTOMS_DUTY: Thuế nhập khẩu
   *  - CUSTOMS_SERVICE_FEE: Phí dịch vụ khai báo hải quan
   *  - DO_FEE: Phí lấy lệnh giao hàng
   *  - STORAGE_FEE: Phí lưu bãi / lưu cont
   *  - TRANSPORT_VN: Vận chuyển về kho VN
   */
  async getCostBreakdown(id: string) {
    const container = await this.prisma.container.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        totalWeight: true,
        totalPackages: true,
        shippingRoute: true,
      },
    });

    if (!container) {
      throw new NotFoundException(`Container ${id} not found`);
    }

    const costs = await this.prisma.operationCost.findMany({
      where: { containerId: id },
      select: {
        id: true,
        costType: true,
        amount: true,
        currency: true,
        description: true,
        invoiceRef: true,
        note: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Phân nhóm theo costType
    const groups: Record<string, { totalVND: number; items: typeof costs }> = {};
    let grandTotalVND = 0;

    for (const cost of costs) {
      const type = cost.costType;
      if (!groups[type]) {
        groups[type] = { totalVND: 0, items: [] };
      }
      const amount = Number(cost.amount);
      groups[type].totalVND += amount;
      grandTotalVND += amount;
      groups[type].items.push(cost);
    }

    // Tính chi phí / kg để đánh giá hiệu quả
    const totalWeight = Number(container.totalWeight);
    const costPerKg = totalWeight > 0 ? grandTotalVND / totalWeight : null;

    return {
      containerId: id,
      containerCode: container.code,
      totalWeight: totalWeight,
      totalPackages: container.totalPackages,
      costGroups: groups,
      grandTotalVND,
      costPerKg,
      itemCount: costs.length,
    };
  }

  // -------------------------------------------------------------------------
  // Weight Reconciliation — Đối chiếu trọng lượng CN vs VN
  // -------------------------------------------------------------------------

  /**
   * So sánh trọng lượng khai báo tại kho TQ (chargeableWeight)
   * với trọng lượng thực tế cân lại tại kho VN (vnWeight).
   *
   * Chênh lệch >0.5 kg/kiện cần xem xét điều chỉnh phí dịch vụ.
   */
  async getWeightReconciliation(id: string) {
    const container = await this.prisma.container.findUnique({
      where: { id },
      select: { id: true, code: true, totalPackages: true },
    });

    if (!container) {
      throw new NotFoundException(`Container ${id} not found`);
    }

    const packages = await this.prisma.package.findMany({
      where: { containerId: id },
      select: {
        id: true,
        code: true,
        chargeableWeight: true,
        actualWeight: true,
        vnWeight: true,
        orderId: true,
        order: {
          select: {
            code: true,
            customer: { select: { fullName: true, code: true } },
          },
        },
      },
    });

    const reconciled = packages.map((p) => {
      const cnWeight = p.chargeableWeight ? Number(p.chargeableWeight) : 0;
      const vnWeight = p.vnWeight ? Number(p.vnWeight) : null;
      const actualCnWeight = p.actualWeight ? Number(p.actualWeight) : null;
      const diff = vnWeight !== null ? vnWeight - cnWeight : null;
      const diffPct = diff !== null && cnWeight > 0 ? (diff / cnWeight) * 100 : null;

      return {
        packageId: p.id,
        packageCode: p.code,
        orderId: p.orderId,
        orderCode: p.order?.code ?? null,
        customerName: p.order?.customer?.fullName ?? null,
        customerCode: p.order?.customer?.code ?? null,
        cnChargeableWeight: cnWeight,
        cnActualWeight: actualCnWeight,
        vnWeight,
        diff,
        diffPct: diffPct ? Math.round(diffPct * 100) / 100 : null,
        hasSignificantDiff: diff !== null && Math.abs(diff) > 0.5,
      };
    });

    const scannedCount = reconciled.filter((p) => p.vnWeight !== null).length;
    const withDiff = reconciled.filter((p) => p.hasSignificantDiff);
    const totalCN = reconciled.reduce((s, p) => s + p.cnChargeableWeight, 0);
    const totalVN = reconciled
      .filter((p) => p.vnWeight !== null)
      .reduce((s, p) => s + (p.vnWeight ?? 0), 0);

    return {
      containerId: id,
      containerCode: container.code,
      totalPackages: container.totalPackages,
      scannedCount,
      pendingCount: container.totalPackages - scannedCount,
      totalCNWeight: Math.round(totalCN * 100) / 100,
      totalVNWeight: Math.round(totalVN * 100) / 100,
      weightDiff: Math.round((totalVN - totalCN) * 100) / 100,
      packagesWithSignificantDiff: withDiff.length,
      packages: reconciled,
    };
  }
}
