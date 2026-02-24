import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@core/database/prisma.service';
import { Branch, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { WarehouseVNRepository } from './warehouse-vn.repository';
import { DeliveryDispatchService } from './domain/delivery-dispatch.service';
import { WarehouseVNStatusMachine } from './domain/warehouse-vn-status.machine';
import { ReceiveVNDto } from './dto/receive-vn.dto';
import { DispatchDto } from './dto/dispatch.dto';

@Injectable()
export class WarehouseVNService {
  private readonly logger = new Logger(WarehouseVNService.name);

  constructor(
    private readonly warehouseRepo: WarehouseVNRepository,
    private readonly deliveryDispatch: DeliveryDispatchService,
    private readonly statusMachine: WarehouseVNStatusMachine,
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
    for (const pkg of packages.filter(p => toReceive.includes(p.id))) {
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
      return !this.statusMachine.validateTransition(currentStatus, targetStatus);
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

    // Batch-fetch all orders upfront to avoid N+1 queries
    const orderIds = dto.deliveries.map(item => item.orderId);
    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, code: true, status: true, branch: true },
    });
    const orderMap = new Map(orders.map(o => [o.id, o]));

    // Validate all orders exist and are in correct status before creating any deliveries
    const validStatuses = ['WAREHOUSE_VN', 'READY_FOR_DELIVERY'];
    for (const item of dto.deliveries) {
      const order = orderMap.get(item.orderId);
      if (!order) {
        throw new NotFoundException(
          `Order with ID ${item.orderId} not found`,
        );
      }
      if (!validStatuses.includes(order.status)) {
        throw new BadRequestException(
          `Order ${order.code} is ${order.status}. Can only dispatch WAREHOUSE_VN/READY_FOR_DELIVERY orders.`,
        );
      }
    }

    // B1: Payment validation — hard stop VN dispatch
    const ordersWithCustomer = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        code: true,
        totalAmount: true,
        customer: {
          select: {
            id: true,
            creditLimit: true,
            currentDebt: true,
            tempOverdraftLimit: true,
            tempOverdraftExpiry: true,
            gracePeriodUntil: true,
          },
        },
      },
    });
    const orderCustomerMap = new Map(ordersWithCustomer.map(o => [o.id, o]));

    for (const item of dto.deliveries) {
      const orderData = orderCustomerMap.get(item.orderId);
      if (!orderData) continue;

      // 1. Check if fully paid
      const paymentAgg = await this.prisma.paymentAllocation.aggregate({
        where: { orderId: orderData.id, isReversed: false },
        _sum: { allocatedAmount: true },
      });
      const totalPaid = Number(paymentAgg._sum.allocatedAmount ?? 0);
      const fullyPaid = totalPaid >= Number(orderData.totalAmount);

      // 2. Check credit limit
      // D2: Include this order's unpaid amount in cumulative debt check
      const customer = orderData.customer;
      const orderUnpaid = Number(orderData.totalAmount) - totalPaid;
      const effectiveDebt = Number(customer.currentDebt) + Math.max(0, orderUnpaid);
      const creditApproved =
        Number(customer.creditLimit) > 0 &&
        effectiveDebt <= Number(customer.creditLimit);

      // 3. Check temporary overdraft
      const tempOverdraft =
        customer.tempOverdraftLimit !== null &&
        Number(customer.tempOverdraftLimit) > 0 &&
        customer.tempOverdraftExpiry !== null &&
        new Date(customer.tempOverdraftExpiry) > new Date();

      // 4. Check grace period
      const gracePeriodActive =
        customer.gracePeriodUntil !== null &&
        new Date(customer.gracePeriodUntil) > new Date();

      if (!fullyPaid && !creditApproved && !tempOverdraft && !gracePeriodActive) {
        throw new ForbiddenException(
          'Payment required before dispatch. Order ' +
            orderData.code +
            ' is not fully paid and customer has no credit approval.',
        );
      }

      // B10: High risk goods validation
      const highRiskPackages = await this.prisma.package.findMany({
        where: {
          orderId: orderData.id,
          isHighRisk: true,
          highRiskDisclaimerAccepted: false,
        },
        select: { id: true, code: true },
      });
      if (highRiskPackages.length > 0) {
        throw new ForbiddenException(
          `Cannot dispatch order ${orderData.code}. High risk packages require disclaimer acceptance: ${highRiskPackages.map(p => p.code).join(', ')}`,
        );
      }
    }

    for (const item of dto.deliveries) {
      const order = orderMap.get(item.orderId)!;

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
      deliveryProofUrls?: string[];
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

    // Layer 4B: Mandatory proof of delivery photos
    const hasProof =
      (data.deliveryProofUrls && data.deliveryProofUrls.length > 0) ||
      data.podImageUrl;
    if (!hasProof) {
      throw new BadRequestException(
        'Bắt buộc ảnh bằng chứng giao hàng (POD) để xác nhận giao hàng',
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

    // Save delivery proof URLs if provided
    if (data.deliveryProofUrls && data.deliveryProofUrls.length > 0) {
      await this.prisma.delivery.update({
        where: { id: deliveryId },
        data: { deliveryProofUrls: data.deliveryProofUrls },
      });
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

  /**
   * B4: Reweigh a package at VN warehouse and detect weight variance.
   */
  async reweighPackage(packageId: string, vnWeight: number, userId: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        code: true,
        cnWeight: true,
        orderId: true,
      },
    });

    if (!pkg) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    const cnWeight = pkg.cnWeight ? Number(pkg.cnWeight) : 0;
    let weightVariancePercent = 0;

    if (cnWeight > 0) {
      weightVariancePercent =
        Math.abs(vnWeight - cnWeight) / cnWeight * 100;
    }

    await this.prisma.package.update({
      where: { id: packageId },
      data: {
        vnWeight: new Decimal(vnWeight),
        weightVariancePercent: new Decimal(weightVariancePercent),
      },
    });

    if (weightVariancePercent > 5) {
      this.eventEmitter.emit('package.weight_variance_alert', {
        packageId: pkg.id,
        packageCode: pkg.code,
        orderId: pkg.orderId,
        cnWeight,
        vnWeight,
        variancePercent: weightVariancePercent,
        detectedBy: userId,
      });

      this.logger.warn(
        `Weight variance alert for package ${pkg.code}: CN=${cnWeight}kg, VN=${vnWeight}kg, variance=${weightVariancePercent.toFixed(2)}%`,
      );
    }

    this.logger.log(
      `Package ${pkg.code} reweighed at VN: ${vnWeight}kg (CN: ${cnWeight}kg, variance: ${weightVariancePercent.toFixed(2)}%)`,
    );

    return {
      packageId: pkg.id,
      packageCode: pkg.code,
      cnWeight,
      vnWeight,
      weightVariancePercent,
      alert: weightVariancePercent > 5,
    };
  }

  /**
   * B9: Accrue storage fees for RTO-received deliveries.
   * Runs daily at midnight.
   */
  @Cron('0 0 * * *')
  async accrueStorageFees() {
    const rtoDeliveries = await this.prisma.delivery.findMany({
      where: { status: 'RTO_RECEIVED' },
      select: {
        id: true,
        code: true,
        rtoReceivedAt: true,
        rtoStorageFee: true,
        rtoStorageDays: true,
      },
    });

    if (rtoDeliveries.length === 0) return;

    const now = new Date();
    let updatedCount = 0;

    for (const delivery of rtoDeliveries) {
      if (!delivery.rtoReceivedAt) continue;

      const daysSinceRTO = Math.floor(
        (now.getTime() - delivery.rtoReceivedAt.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const fee = daysSinceRTO * 10000; // 10,000 VND/day

      await this.prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          rtoStorageFee: new Decimal(fee),
          rtoStorageDays: daysSinceRTO,
        },
      });

      updatedCount++;
    }

    this.logger.log(
      `RTO storage fees accrued for ${updatedCount} deliveries`,
    );
  }
}
