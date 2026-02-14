import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Branch, Prisma } from '@prisma/client';
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
      const remainingAmount = Math.max(
        0,
        Number(order.totalAmount) - Number(order.depositPaid),
      );

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

    const plans = Array.from(areaMap.values()).sort(
      (a, b) => b.stops - a.stops,
    );

    this.logger.log(
      `Delivery plan created for branch ${branch}: ${plans.length} areas, ` +
        `${pendingDeliveries.length} total deliveries`,
    );

    return plans;
  }

  /**
   * Assigns a driver and vehicle to delivery records.
   */
  async assignDriver(
    deliveryIds: string[],
    driverId: string,
    vehicleId?: string,
  ): Promise<void> {
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

    this.logger.log(
      `Driver ${driverId} assigned to ${deliveryIds.length} deliveries`,
    );
  }

  /**
   * Optimizes the delivery route for a set of deliveries.
   *
   * This is a STUB implementation that returns deliveries in their
   * current order with estimated values. In production, this would
   * integrate with Google Maps Directions API for actual route optimization.
   */
  async optimizeRoute(
    deliveryIds: string[],
  ): Promise<RouteOptimizationResult> {
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
    const updateData: Prisma.DeliveryUpdateInput = { status };

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

    this.logger.log(
      `Delivery ${deliveryId} status updated to ${status}`,
    );
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
