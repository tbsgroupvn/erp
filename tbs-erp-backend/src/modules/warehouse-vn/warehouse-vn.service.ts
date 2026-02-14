import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { Branch, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { WarehouseVNRepository } from './warehouse-vn.repository';
import { DeliveryDispatchService } from './domain/delivery-dispatch.service';
import { ReceiveVNDto } from './dto/receive-vn.dto';
import { DispatchDto } from './dto/dispatch.dto';

@Injectable()
export class WarehouseVNService {
  private readonly logger = new Logger(WarehouseVNService.name);

  constructor(
    private readonly warehouseRepo: WarehouseVNRepository,
    private readonly deliveryDispatch: DeliveryDispatchService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Receives packages from a container at Warehouse VN.
   *
   * Validates the container exists and is in ARRIVED or CUSTOMS status,
   * then marks the specified packages as RECEIVED at VN warehouse.
   */
  async receiveFromContainer(dto: ReceiveVNDto, userId: string) {
    // Validate container
    const container = await this.prisma.container.findUnique({
      where: { id: dto.containerId },
      select: { id: true, code: true, status: true },
    });

    if (!container) {
      throw new NotFoundException(
        `Container with ID ${dto.containerId} not found`,
      );
    }

    if (!['ARRIVED', 'CUSTOMS', 'COMPLETED'].includes(container.status)) {
      throw new BadRequestException(
        `Container ${container.code} is in ${container.status} status. ` +
          `Only ARRIVED, CUSTOMS, or COMPLETED containers can be received.`,
      );
    }

    // Validate packages belong to this container
    const packages = await this.prisma.package.findMany({
      where: { id: { in: dto.packageIds } },
      select: {
        id: true,
        code: true,
        containerId: true,
        warehouseVNStatus: true,
        orderId: true,
      },
    });

    if (packages.length !== dto.packageIds.length) {
      const foundIds = packages.map((p) => p.id);
      const missing = dto.packageIds.filter(
        (id) => !foundIds.includes(id),
      );
      throw new NotFoundException(
        `Packages not found: ${missing.join(', ')}`,
      );
    }

    // Check packages belong to this container
    const wrongContainer = packages.filter(
      (p) => p.containerId !== dto.containerId,
    );
    if (wrongContainer.length > 0) {
      throw new BadRequestException(
        `Packages not in container ${container.code}: ${wrongContainer.map((p) => p.code).join(', ')}`,
      );
    }

    // Check for already received packages
    const alreadyReceived = packages.filter(
      (p) => p.warehouseVNStatus === 'RECEIVED',
    );
    if (alreadyReceived.length > 0) {
      this.logger.warn(
        `${alreadyReceived.length} packages already received at VN: ` +
          `${alreadyReceived.map((p) => p.code).join(', ')}`,
      );
    }

    // Filter to only unreceived packages
    const toReceive = packages
      .filter((p) => p.warehouseVNStatus !== 'RECEIVED')
      .map((p) => p.id);

    const receivedCount = await this.warehouseRepo.receivePackages(
      toReceive,
      userId,
    );

    // Emit events for each received package
    for (const pkg of packages) {
      this.eventEmitter.emit('warehouse.package.received', {
        packageId: pkg.id,
        orderId: pkg.orderId,
        warehouse: 'VN',
        receivedBy: userId,
      });
    }

    this.logger.log(
      `Received ${receivedCount} packages from container ${container.code} at Warehouse VN by ${userId}`,
    );

    return {
      containerId: dto.containerId,
      containerCode: container.code,
      receivedCount,
      skippedCount: alreadyReceived.length,
      total: dto.packageIds.length,
    };
  }

  /**
   * Lists packages at Warehouse VN with filters.
   */
  async listPackages(query: {
    page?: number;
    limit?: number;
    status?: string;
    orderId?: string;
    search?: string;
    branch?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PackageWhereInput = {
      receivedVNAt: { not: null },
    };

    if (query.status) {
      where.warehouseVNStatus = query.status;
    }

    if (query.orderId) {
      where.orderId = query.orderId;
    }

    if (query.branch) {
      where.order = {
        branch: query.branch as Branch,
      };
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
        {
          order: {
            code: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    const sortBy = query.sortBy ?? 'receivedVNAt';
    const sortOrder = (query.sortOrder?.toLowerCase() ?? 'desc') as
      | 'asc'
      | 'desc';

    const { data, total } = await this.warehouseRepo.findPackages(
      where,
      skip,
      limit,
      { [sortBy]: sortOrder } as Prisma.PackageOrderByWithRelationInput,
    );

    return { data, total, page, limit };
  }

  /**
   * Sorts packages by updating their VN warehouse status.
   * RECEIVED -> SORTED -> READY
   */
  async sortPackages(packageIds: string[], targetStatus: string) {
    const validTransitions: Record<string, string[]> = {
      RECEIVED: ['SORTED'],
      SORTED: ['READY'],
      READY: ['DELIVERED'],
    };

    // Validate all packages and their transitions
    const packages = await this.prisma.package.findMany({
      where: { id: { in: packageIds } },
      select: { id: true, code: true, warehouseVNStatus: true },
    });

    if (packages.length !== packageIds.length) {
      throw new NotFoundException('One or more packages not found');
    }

    const invalid = packages.filter((p) => {
      const currentStatus = p.warehouseVNStatus ?? 'RECEIVED';
      const allowed = validTransitions[currentStatus] ?? [];
      return !allowed.includes(targetStatus);
    });

    if (invalid.length > 0) {
      throw new BadRequestException(
        `Cannot transition to ${targetStatus} for packages: ${invalid.map((p) => `${p.code} (${p.warehouseVNStatus})`).join(', ')}`,
      );
    }

    await this.prisma.package.updateMany({
      where: { id: { in: packageIds } },
      data: { warehouseVNStatus: targetStatus },
    });

    this.logger.log(
      `Sorted ${packageIds.length} packages to status ${targetStatus}`,
    );

    return { updatedCount: packageIds.length, targetStatus };
  }

  /**
   * Dispatches deliveries from Warehouse VN.
   *
   * Creates delivery records for each order, optionally assigns a driver
   * and vehicle, and marks the related packages as dispatched.
   */
  async dispatchDelivery(dto: DispatchDto, userId: string, branch: Branch) {
    const deliveries = [];

    for (const item of dto.deliveries) {
      // Validate order exists and is in correct status
      const order = await this.prisma.order.findUnique({
        where: { id: item.orderId },
        select: { id: true, code: true, status: true, branch: true },
      });

      if (!order) {
        throw new NotFoundException(
          `Order with ID ${item.orderId} not found`,
        );
      }

      // Generate delivery code
      const code = await this.warehouseRepo.generateDeliveryCode();

      const delivery = await this.warehouseRepo.createDelivery({
        code,
        order: { connect: { id: item.orderId } },
        branch,
        recipientName: item.recipientName,
        recipientPhone: item.recipientPhone,
        deliveryAddress: item.deliveryAddress,
        codAmount: new Decimal(item.codAmount ?? 0),
        note: item.note,
        status: dto.driverId ? 'DISPATCHED' : 'PENDING',
        driver: dto.driverId
          ? { connect: { id: dto.driverId } }
          : undefined,
        vehicle: dto.vehicleId
          ? { connect: { id: dto.vehicleId } }
          : undefined,
        scheduledAt: dto.scheduledAt
          ? new Date(dto.scheduledAt)
          : undefined,
        dispatchedBy: userId,
      });

      deliveries.push(delivery);

      // Emit delivery created event
      this.eventEmitter.emit('delivery.created', {
        deliveryId: delivery.id,
        deliveryCode: code,
        orderId: item.orderId,
        driverId: dto.driverId,
        branch,
      });
    }

    // If driver is assigned, emit dispatch event
    if (dto.driverId) {
      this.eventEmitter.emit('delivery.dispatched', {
        deliveryIds: deliveries.map((d) => d.id),
        driverId: dto.driverId,
        vehicleId: dto.vehicleId,
        dispatchedBy: userId,
      });
    }

    this.logger.log(
      `Dispatched ${deliveries.length} deliveries from Warehouse VN ` +
        `(branch=${branch}, driver=${dto.driverId ?? 'unassigned'})`,
    );

    return deliveries;
  }

  /**
   * Confirms delivery of an order.
   *
   * Updates delivery record with proof of delivery, marks packages
   * as DELIVERED, and emits completion event.
   */
  async confirmDelivery(
    deliveryId: string,
    data: {
      podImageUrl?: string;
      signatureUrl?: string;
      codCollected?: boolean;
    },
  ) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        orderId: true,
        status: true,
        codAmount: true,
      },
    });

    if (!delivery) {
      throw new NotFoundException(
        `Delivery with ID ${deliveryId} not found`,
      );
    }

    if (!['DISPATCHED', 'PICKED_UP', 'DELIVERING'].includes(delivery.status)) {
      throw new BadRequestException(
        `Delivery ${deliveryId} cannot be confirmed in status ${delivery.status}`,
      );
    }

    // COD validation: if COD > 0, must confirm collection
    if (
      Number(delivery.codAmount) > 0 &&
      !data.codCollected
    ) {
      throw new BadRequestException(
        `COD amount of ${delivery.codAmount} must be collected before confirming delivery`,
      );
    }

    // Update delivery status
    await this.deliveryDispatch.updateDeliveryStatus(deliveryId, 'DELIVERED', {
      podImageUrl: data.podImageUrl,
      signatureUrl: data.signatureUrl,
      codCollected: data.codCollected,
    });

    // Update all packages for this order as DELIVERED
    await this.prisma.package.updateMany({
      where: {
        orderId: delivery.orderId,
        warehouseVNStatus: { in: ['READY', 'SORTED'] },
      },
      data: {
        warehouseVNStatus: 'DELIVERED',
        deliveredAt: new Date(),
      },
    });

    this.logger.log(`Delivery ${deliveryId} confirmed for order ${delivery.orderId}`);

    return { deliveryId, status: 'DELIVERED' };
  }

  /**
   * Gets a delivery plan grouped by area for the given branch.
   */
  async getDeliveryPlan(branch: Branch) {
    return this.deliveryDispatch.createDeliveryPlan(branch);
  }

  /**
   * Gets route optimization for a set of deliveries.
   */
  async optimizeRoute(deliveryIds: string[]) {
    return this.deliveryDispatch.optimizeRoute(deliveryIds);
  }
}
