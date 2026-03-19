import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Branch, DeliveryStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface DeliveryPlan {
  /** Group identifier (e.g., district/area name) */
  area: string;
  /** Deliveries in this group */
  deliveries: Array<{
    orderId: string;
    orderCode: string;
    recipientName: string;
    recipientPhone: string;
    deliveryAddress: string;
    codAmount: number;
  }>;
  /** Total COD to collect */
  totalCOD: number;
  /** Estimated number of stops */
  stops: number;
}

export interface RouteOptimizationResult {
  /** Ordered list of delivery IDs in optimized sequence */
  orderedDeliveryIds: string[];
  /** Estimated total distance (stub value) */
  estimatedDistanceKm: number;
  /** Estimated total time in minutes (stub value) */
  estimatedTimeMinutes: number;
  /** Note about optimization method */
  method: string;
}

/**
 * Delivery Dispatch Service.
 *
 * Manages the last-mile delivery process from Warehouse VN to customers.
 * Provides:
 *  - Creating delivery plans grouped by delivery area
 *  - Assigning drivers and vehicles
 *  - Route optimization (stub for future Google Maps integration)
 *  - Tracking delivery status updates
 */
@Injectable()
export class DeliveryDispatchService {
  private readonly logger = new Logger(DeliveryDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a delivery plan by grouping orders by their delivery area.
   *
   * Analyzes pending deliveries and groups them by address area
   * (extracted from the district portion of the address) for
   * efficient route planning.
   */
  async createDeliveryPlan(branch: Branch): Promise<DeliveryPlan[]> {
    // Find all orders that are ready for delivery (status DELIVERING or packages at READY)
    const pendingDeliveries = await this.prisma.order.findMany({
      where: {
        branch,
        status: 'DELIVERING',
        deliveries: {
          none: {
            status: { in: ['DISPATCHED', 'DELIVERING', 'DELIVERED'] },
          },
        },
      },
      select: {
        id: true,
        code: true,
        customer: {
          select: {
            fullName: true,
            phone: true,
            address: true,
          },
        },
        totalAmount: true,
        depositPaid: true,
      },
    });

    // Group by area (extract district/area from address)
    const areaMap = new Map<string, DeliveryPlan>();

    for (const order of pendingDeliveries) {
      const address = order.customer.address ?? 'Unknown Area';
      const area = this.extractArea(address);

      if (!areaMap.has(area)) {
        areaMap.set(area, {
          area,
          deliveries: [],
          totalCOD: 0,
          stops: 0,
        });
      }

      const plan = areaMap.get(area)!;
      const remainingAmount = Math.max(0, Number(order.totalAmount) - Number(order.depositPaid));

      plan.deliveries.push({
        orderId: order.id,
        orderCode: order.code,
        recipientName: order.customer.fullName,
        recipientPhone: order.customer.phone,
        deliveryAddress: address,
        codAmount: remainingAmount,
      });

      plan.totalCOD += remainingAmount;
      plan.stops += 1;
    }

    const plans = Array.from(areaMap.values()).sort((a, b) => b.stops - a.stops);

    this.logger.log(
      `Delivery plan created for branch ${branch}: ${plans.length} areas, ` +
        `${pendingDeliveries.length} total deliveries`,
    );

    return plans;
  }

  /**
   * Assigns a driver and vehicle to delivery records.
   * B1: Validates payment status before dispatch.
   */
  async assignDriver(deliveryIds: string[], driverId: string, vehicleId?: string): Promise<void> {
    // P0-4: Check if driver is COD-blocked (>24h unreturned COD)
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true, fullName: true, isCODBlocked: true },
    });

    if (!driver) {
      throw new NotFoundException(`Driver with ID ${driverId} not found`);
    }

    if (driver.isCODBlocked) {
      throw new ForbiddenException(
        `Tài xế ${driver.fullName} đang bị chặn giao hàng do chưa nộp COD quá 24h. ` +
          'Vui lòng nộp COD trước khi nhận chuyến mới.',
      );
    }

    // B1: Payment validation before driver assignment (dispatch)
    const deliveries = await this.prisma.delivery.findMany({
      where: { id: { in: deliveryIds } },
      select: { id: true, orderId: true },
    });

    const orderIds = [...new Set(deliveries.map((d) => d.orderId))];
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
            isBlocked: true,
            blockReason: true,
          },
        },
      },
    });

    // DAT-09: Block delivery for customers with AR aging auto-block
    for (const orderData of ordersWithCustomer) {
      if (orderData.customer.isBlocked) {
        throw new ForbiddenException(
          `Khong the giao hang. Khach hang cua don ${orderData.code} da bi chan do cong no qua han. ` +
            `Ly do: ${orderData.customer.blockReason}. Vui long lien he bo phan tai chinh.`,
        );
      }
    }

    for (const orderData of ordersWithCustomer) {
      const paymentAgg = await this.prisma.paymentAllocation.aggregate({
        where: { orderId: orderData.id, isReversed: false },
        _sum: { allocatedAmount: true },
      });
      const totalPaid = Number(paymentAgg._sum.allocatedAmount ?? 0);
      const fullyPaid = totalPaid >= Number(orderData.totalAmount);

      const customer = orderData.customer;
      const creditApproved =
        Number(customer.creditLimit) > 0 &&
        Number(customer.currentDebt) <= Number(customer.creditLimit);
      const tempOverdraft =
        customer.tempOverdraftLimit !== null &&
        Number(customer.tempOverdraftLimit) > 0 &&
        customer.tempOverdraftExpiry !== null &&
        new Date(customer.tempOverdraftExpiry) > new Date();
      const gracePeriodActive =
        customer.gracePeriodUntil !== null && new Date(customer.gracePeriodUntil) > new Date();

      if (!fullyPaid && !creditApproved && !tempOverdraft && !gracePeriodActive) {
        throw new BadRequestException(
          'Payment required before dispatch. Order ' +
            orderData.code +
            ' is not fully paid and customer has no credit approval.',
        );
      }
    }

    await this.prisma.delivery.updateMany({
      where: { id: { in: deliveryIds } },
      data: {
        driverId,
        vehicleId: vehicleId ?? undefined,
        status: 'DISPATCHED',
      },
    });

    this.eventEmitter.emit('delivery.driver.assigned', {
      deliveryIds,
      driverId,
      vehicleId,
    });

    this.logger.log(`Driver ${driverId} assigned to ${deliveryIds.length} deliveries`);
  }

  /**
   * Optimizes the delivery route for a set of deliveries.
   *
   * This is a STUB implementation that returns deliveries in their
   * current order with estimated values. In production, this would
   * integrate with Google Maps Directions API for actual route optimization.
   */
  async optimizeRoute(deliveryIds: string[]): Promise<RouteOptimizationResult> {
    // STUB: In a real implementation, this would:
    // 1. Fetch all delivery addresses
    // 2. Call Google Maps Directions API with waypoints
    // 3. Use the optimized waypoint order
    // 4. Return the optimal sequence

    // For now, return deliveries in current order with stub estimates
    const deliveries = await this.prisma.delivery.findMany({
      where: { id: { in: deliveryIds } },
      select: { id: true, deliveryAddress: true },
    });

    const estimatedDistanceKm = deliveries.length * 5; // Rough estimate: 5km per stop
    const estimatedTimeMinutes = deliveries.length * 15; // Rough estimate: 15min per stop

    this.logger.log(
      `Route optimization (STUB): ${deliveries.length} stops, ` +
        `~${estimatedDistanceKm}km, ~${estimatedTimeMinutes}min`,
    );

    return {
      orderedDeliveryIds: deliveries.map((d) => d.id),
      estimatedDistanceKm,
      estimatedTimeMinutes,
      method: 'STUB_SEQUENTIAL',
    };
  }

  /**
   * Updates the status of a delivery.
   */
  async updateDeliveryStatus(
    deliveryId: string,
    status: string,
    data?: {
      podImageUrl?: string;
      signatureUrl?: string;
      failReason?: string;
      codCollected?: boolean;
    },
  ): Promise<void> {
    const updateData: Prisma.DeliveryUpdateInput = { status: status as DeliveryStatus };

    switch (status) {
      case 'PICKED_UP':
        updateData.pickedUpAt = new Date();
        break;
      case 'DELIVERED':
        updateData.deliveredAt = new Date();
        if (data?.podImageUrl) updateData.podImageUrl = data.podImageUrl;
        if (data?.signatureUrl) updateData.signatureUrl = data.signatureUrl;
        if (data?.codCollected) {
          updateData.codCollected = true;
          updateData.codCollectedAt = new Date();
        }
        break;
      case 'FAILED':
        updateData.failReason = data?.failReason ?? 'Delivery failed';
        break;
    }

    const delivery = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: updateData,
    });

    this.eventEmitter.emit('delivery.status.changed', {
      deliveryId,
      orderId: delivery.orderId,
      status,
      driverId: delivery.driverId,
    });

    if (status === 'DELIVERED') {
      this.eventEmitter.emit('delivery.completed', {
        deliveryId,
        orderId: delivery.orderId,
        codAmount: Number(delivery.codAmount),
        codCollected: data?.codCollected ?? false,
      });
    }

    this.logger.log(`Delivery ${deliveryId} status updated to ${status}`);
  }

  /**
   * B6: Create a delivery with specific packages (split delivery).
   *
   * Sets isPartialDelivery=true when not all packages of an order are included.
   * Does NOT change order status to DELIVERED until ALL packages are delivered.
   */
  async createSplitDelivery(
    orderId: string,
    packageIds: string[],
    deliveryData: {
      recipientName: string;
      recipientPhone: string;
      deliveryAddress: string;
      codAmount?: number;
      note?: string;
      driverId?: string;
      vehicleId?: string;
      branch: Branch;
      dispatchedBy: string;
    },
  ) {
    // Validate order
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, code: true, status: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Validate packages belong to this order
    const packages = await this.prisma.package.findMany({
      where: { id: { in: packageIds }, orderId },
      select: { id: true, code: true },
    });

    if (packages.length !== packageIds.length) {
      throw new BadRequestException(
        'One or more packages do not belong to this order or do not exist',
      );
    }

    // Count total packages for the order
    const totalPackageCount = await this.prisma.package.count({
      where: { orderId },
    });
    const isPartialDelivery = packageIds.length < totalPackageCount;

    // Generate delivery code
    const now = new Date();
    const datePrefix = [
      String(now.getFullYear()).slice(-2),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    const prefix = `TBS-DLV-${datePrefix}`;
    const latest = await this.prisma.delivery.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    let sequence = 1;
    if (latest) {
      const lastSeq = parseInt(latest.code.split('-').pop() || '0', 10);
      sequence = lastSeq + 1;
    }
    const code = `${prefix}-${String(sequence).padStart(4, '0')}`;

    const delivery = await this.prisma.delivery.create({
      data: {
        code,
        order: { connect: { id: orderId } },
        branch: deliveryData.branch,
        recipientName: deliveryData.recipientName,
        recipientPhone: deliveryData.recipientPhone,
        deliveryAddress: deliveryData.deliveryAddress,
        codAmount: new Decimal(deliveryData.codAmount ?? 0),
        note: deliveryData.note,
        status: deliveryData.driverId ? 'DISPATCHED' : 'PENDING',
        driver: deliveryData.driverId ? { connect: { id: deliveryData.driverId } } : undefined,
        vehicle: deliveryData.vehicleId ? { connect: { id: deliveryData.vehicleId } } : undefined,
        isPartialDelivery,
        deliveryPackages: {
          create: packageIds.map((pid) => ({ packageId: pid })),
        },
        dispatchedBy: deliveryData.dispatchedBy,
      },
      include: { deliveryPackages: true },
    });

    this.eventEmitter.emit('delivery.created', {
      deliveryId: delivery.id,
      deliveryCode: code,
      orderId,
      driverId: deliveryData.driverId,
      branch: deliveryData.branch,
      isPartialDelivery,
      packageIds,
    });

    this.logger.log(
      `Split delivery ${code} created for order ${order.code} with ${packageIds.length}/${totalPackageCount} packages` +
        (isPartialDelivery ? ' (partial)' : ' (full)'),
    );

    return delivery;
  }

  /**
   * B9: Initiate Return to Origin (RTO) for a delivery.
   */
  async initiateRTO(deliveryId: string, reason: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      select: { id: true, status: true, orderId: true, code: true },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery with ID ${deliveryId} not found`);
    }

    if (!['DISPATCHED', 'PICKED_UP', 'DELIVERING', 'FAILED'].includes(delivery.status)) {
      throw new BadRequestException(
        `Delivery ${delivery.code} cannot be returned in status ${delivery.status}`,
      );
    }

    const updated = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: 'RETURN_TO_ORIGIN',
        rtoReason: reason,
      },
    });

    this.eventEmitter.emit('delivery.rto.initiated', {
      deliveryId,
      orderId: delivery.orderId,
      reason,
    });

    this.logger.log(`RTO initiated for delivery ${delivery.code}: ${reason}`);

    return updated;
  }

  /**
   * B9: Receive an RTO delivery back at warehouse.
   */
  async receiveRTO(deliveryId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      select: { id: true, status: true, orderId: true, code: true },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery with ID ${deliveryId} not found`);
    }

    if (delivery.status !== 'RETURN_TO_ORIGIN') {
      throw new BadRequestException(
        `Delivery ${delivery.code} is in status ${delivery.status}. Only RETURN_TO_ORIGIN deliveries can be received.`,
      );
    }

    const updated = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: 'RTO_RECEIVED',
        rtoReceivedAt: new Date(),
      },
    });

    this.eventEmitter.emit('delivery.rto.received', {
      deliveryId,
      orderId: delivery.orderId,
    });

    this.logger.log(`RTO received for delivery ${delivery.code}`);

    return updated;
  }

  /**
   * Extracts the area/district from a Vietnamese address string.
   * Rough heuristic: looks for "Quan", "Huyen", or "Thanh pho" indicators.
   */
  private extractArea(address: string): string {
    // Try to find district/ward markers in Vietnamese addresses
    const patterns = [
      /(?:Qu[aậ]n|Q\.?)\s*(\d+|[A-Za-z\sáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđĐ]+)/i,
      /(?:Huy[eệ]n)\s*([A-Za-z\sáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđĐ]+)/i,
      /(?:TP\.?|Thành phố)\s*([A-Za-z\sáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđĐ]+)/i,
    ];

    for (const pattern of patterns) {
      const match = address.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // Fallback: use last comma-separated segment as area
    const segments = address.split(',');
    if (segments.length >= 2) {
      return segments[segments.length - 2].trim();
    }

    return 'Other';
  }
}
