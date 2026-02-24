import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { TrackingEventType, OrderStatus } from '@prisma/client';
import { CreateTrackingEventDto } from './dto/create-tracking.dto';
import { TrackingQueryDto } from './dto/tracking-query.dto';
import { TrackingProviderService, ITrackingEvent } from './domain/tracking-provider.service';

/**
 * Ordered sequence of tracking events for ETA estimation.
 */
const EVENT_SEQUENCE: TrackingEventType[] = [
  TrackingEventType.PICKED_UP,
  TrackingEventType.IN_WAREHOUSE_CN,
  TrackingEventType.PACKED,
  TrackingEventType.LOADED_CONTAINER,
  TrackingEventType.DEPARTED_CN,
  TrackingEventType.IN_TRANSIT,
  TrackingEventType.ARRIVED_PORT,
  TrackingEventType.CUSTOMS_CLEARANCE,
  TrackingEventType.CUSTOMS_RELEASED,
  TrackingEventType.IN_WAREHOUSE_VN,
  TrackingEventType.OUT_FOR_DELIVERY,
  TrackingEventType.DELIVERED,
];

/**
 * Average days for each stage (used for ETA estimation).
 */
const STAGE_DURATION_DAYS: Record<string, number> = {
  PICKED_UP: 1,
  IN_WAREHOUSE_CN: 2,
  PACKED: 1,
  LOADED_CONTAINER: 1,
  DEPARTED_CN: 1,
  IN_TRANSIT: 7, // Sea transit average
  ARRIVED_PORT: 1,
  CUSTOMS_CLEARANCE: 3,
  CUSTOMS_RELEASED: 1,
  IN_WAREHOUSE_VN: 1,
  OUT_FOR_DELIVERY: 1,
  DELIVERED: 0,
};

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly trackingProvider: TrackingProviderService,
  ) {}

  /**
   * Adds a manual tracking event for a package or container.
   */
  async addTrackingEvent(dto: CreateTrackingEventDto) {
    if (!dto.packageId && !dto.containerId) {
      throw new BadRequestException(
        'Either packageId or containerId must be provided',
      );
    }

    // Validate package exists if provided
    if (dto.packageId) {
      const pkg = await this.prisma.package.findUnique({
        where: { id: dto.packageId },
        select: { id: true, code: true },
      });
      if (!pkg) {
        throw new NotFoundException(
          `Package with ID ${dto.packageId} not found`,
        );
      }
    }

    // Validate container exists if provided
    if (dto.containerId) {
      const container = await this.prisma.container.findUnique({
        where: { id: dto.containerId },
        select: { id: true, code: true },
      });
      if (!container) {
        throw new NotFoundException(
          `Container with ID ${dto.containerId} not found`,
        );
      }
    }

    const eventTimestamp = dto.eventTimestamp
      ? new Date(dto.eventTimestamp)
      : new Date();

    if (eventTimestamp > new Date()) {
      throw new BadRequestException('Tracking event timestamp cannot be in the future');
    }

    const trackingEvent = await this.prisma.trackingEvent.create({
      data: {
        packageId: dto.packageId,
        containerId: dto.containerId,
        trackingNumber: dto.trackingNumber,
        eventType: dto.eventType,
        location: dto.location,
        description: dto.description,
        carrier: dto.carrier,
        eventTimestamp,
        source: 'MANUAL',
      },
    });

    // Emit tracking event
    this.eventEmitter.emit('tracking.event.added', {
      trackingEventId: trackingEvent.id,
      packageId: dto.packageId,
      containerId: dto.containerId,
      trackingNumber: dto.trackingNumber,
      eventType: dto.eventType,
      location: dto.location,
    });

    this.logger.log(
      `Tracking event ${dto.eventType} added for ${dto.trackingNumber} at ${dto.location}`,
    );

    return trackingEvent;
  }

  /**
   * Gets all tracking events for a specific package, ordered chronologically.
   */
  async getTrackingHistory(packageId: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        code: true,
        trackingNumberCN: true,
        orderId: true,
      },
    });

    if (!pkg) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    const events = await this.prisma.trackingEvent.findMany({
      where: {
        OR: [
          { packageId },
          ...(pkg.trackingNumberCN
            ? [{ trackingNumber: pkg.trackingNumberCN }]
            : []),
        ],
      },
      orderBy: { eventTimestamp: 'asc' },
    });

    return {
      package: pkg,
      events,
      latestEvent: events.length > 0 ? events[events.length - 1] : null,
      totalEvents: events.length,
    };
  }

  /**
   * Gets tracking events for an entire container and all its packages.
   */
  async getContainerTracking(containerId: string) {
    const container = await this.prisma.container.findUnique({
      where: { id: containerId },
      select: {
        id: true,
        code: true,
        status: true,
        carrier: true,
        origin: true,
        destination: true,
        estimatedDepartureAt: true,
        actualDepartureAt: true,
        estimatedArrivalAt: true,
        actualArrivalAt: true,
      },
    });

    if (!container) {
      throw new NotFoundException(
        `Container with ID ${containerId} not found`,
      );
    }

    // Get container-level events
    const containerEvents = await this.prisma.trackingEvent.findMany({
      where: { containerId },
      orderBy: { eventTimestamp: 'asc' },
    });

    // Get packages in this container with their latest events
    const packages = await this.prisma.package.findMany({
      where: { containerId },
      select: {
        id: true,
        code: true,
        trackingNumberCN: true,
        orderId: true,
      },
    });

    const packageIds = packages.map((p) => p.id);

    // Get all package-level events
    const packageEvents = await this.prisma.trackingEvent.findMany({
      where: { packageId: { in: packageIds } },
      orderBy: { eventTimestamp: 'desc' },
    });

    // Group events by package
    const eventsByPackage = new Map<string, typeof packageEvents>();
    for (const event of packageEvents) {
      if (event.packageId) {
        const existing = eventsByPackage.get(event.packageId) || [];
        existing.push(event);
        eventsByPackage.set(event.packageId, existing);
      }
    }

    const packagesWithTracking = packages.map((pkg) => ({
      ...pkg,
      latestEvent: (eventsByPackage.get(pkg.id) || [])[0] || null,
      eventCount: (eventsByPackage.get(pkg.id) || []).length,
    }));

    return {
      container,
      containerEvents,
      packages: packagesWithTracking,
      totalPackages: packages.length,
      latestContainerEvent:
        containerEvents.length > 0
          ? containerEvents[containerEvents.length - 1]
          : null,
    };
  }

  /**
   * Syncs tracking data from external APIs (kuaidi100 / 17Track).
   * Fetches external tracking events and stores them locally.
   */
  async syncExternalTracking(trackingNumber: string, carrier?: string) {
    this.logger.log(
      `Syncing external tracking for ${trackingNumber}`,
    );

    const result = await this.trackingProvider.fetchFromAnyProvider(
      trackingNumber,
      carrier,
    );

    if (result.events.length === 0) {
      return {
        trackingNumber,
        provider: result.provider,
        newEvents: 0,
        message: 'No tracking events found from external providers',
      };
    }

    // Find existing events for this tracking number to avoid duplicates
    const existingEvents = await this.prisma.trackingEvent.findMany({
      where: { trackingNumber, source: { not: 'MANUAL' } },
      select: { eventTimestamp: true, location: true, description: true },
    });

    const existingSet = new Set(
      existingEvents.map(
        (e) =>
          `${e.eventTimestamp.toISOString()}_${e.location}_${e.description}`,
      ),
    );

    // Filter out duplicates
    const newEvents = result.events.filter(
      (e) =>
        !existingSet.has(
          `${e.timestamp.toISOString()}_${e.location}_${e.description}`,
        ),
    );

    if (newEvents.length > 0) {
      // Find associated package
      const pkg = await this.prisma.package.findFirst({
        where: { trackingNumberCN: trackingNumber },
        select: { id: true },
      });

      await this.prisma.trackingEvent.createMany({
        data: newEvents.map((event) => ({
          packageId: pkg?.id,
          trackingNumber,
          eventType: this.mapExternalStatus(event.status),
          location: event.location,
          description: event.description,
          eventTimestamp: event.timestamp,
          carrier,
          source: result.provider.toUpperCase(),
        })),
      });
    }

    this.logger.log(
      `Synced ${newEvents.length} new events for ${trackingNumber} from ${result.provider}`,
    );

    return {
      trackingNumber,
      provider: result.provider,
      newEvents: newEvents.length,
      totalEvents: result.events.length,
    };
  }

  /**
   * Gets all active shipments for a customer with their latest tracking status.
   */
  async getCustomerTracking(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, code: true, fullName: true },
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer with ID ${customerId} not found`,
      );
    }

    // Get all active orders for this customer (not completed/cancelled)
    const activeOrders = await this.prisma.order.findMany({
      where: {
        customerId,
        status: {
          notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.RETURNED],
        },
      },
      select: {
        id: true,
        code: true,
        status: true,
        packages: {
          select: {
            id: true,
            code: true,
            trackingNumberCN: true,
            warehouseCNStatus: true,
            warehouseVNStatus: true,
          },
        },
      },
    });

    // Get latest tracking events for all active packages
    const allPackageIds = activeOrders.flatMap((o) =>
      o.packages.map((p) => p.id),
    );

    const latestEvents = await this.prisma.trackingEvent.findMany({
      where: { packageId: { in: allPackageIds } },
      orderBy: { eventTimestamp: 'desc' },
      distinct: ['packageId'],
    });

    const latestEventMap = new Map(
      latestEvents.map((e) => [e.packageId, e]),
    );

    const ordersWithTracking = activeOrders.map((order) => ({
      ...order,
      packages: order.packages.map((pkg) => ({
        ...pkg,
        latestTracking: latestEventMap.get(pkg.id) || null,
      })),
    }));

    return {
      customer,
      activeShipments: ordersWithTracking,
      totalActiveOrders: activeOrders.length,
      totalActivePackages: allPackageIds.length,
    };
  }

  /**
   * Estimates delivery date based on current tracking position and route.
   * Uses average stage durations to calculate remaining time.
   */
  async estimateDelivery(packageId: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        code: true,
        containerId: true,
        order: {
          select: {
            shippingRoute: true,
          },
        },
      },
    });

    if (!pkg) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    // Get the latest tracking event
    const latestEvent = await this.prisma.trackingEvent.findFirst({
      where: { packageId },
      orderBy: { eventTimestamp: 'desc' },
    });

    if (!latestEvent) {
      return {
        packageId,
        packageCode: pkg.code,
        currentStage: null,
        estimatedDeliveryDate: null,
        estimatedDaysRemaining: null,
        confidence: 'LOW',
        message: 'No tracking events found for this package',
      };
    }

    const currentStage = latestEvent.eventType as TrackingEventType;
    const currentIndex = EVENT_SEQUENCE.indexOf(currentStage);

    if (currentIndex === -1) {
      return {
        packageId,
        packageCode: pkg.code,
        currentStage,
        estimatedDeliveryDate: null,
        estimatedDaysRemaining: null,
        confidence: 'LOW',
        message: `Unknown tracking stage: ${currentStage}`,
      };
    }

    if (currentStage === TrackingEventType.DELIVERED) {
      return {
        packageId,
        packageCode: pkg.code,
        currentStage,
        estimatedDeliveryDate: latestEvent.eventTimestamp,
        estimatedDaysRemaining: 0,
        confidence: 'HIGH',
        message: 'Package has been delivered',
      };
    }

    // Calculate remaining days, subtracting time already spent in current stage
    let remainingDays = 0;
    const currentStageDuration = STAGE_DURATION_DAYS[currentStage] || 1;
    const elapsedMs = Date.now() - new Date(latestEvent.eventTimestamp).getTime();
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
    const remainingInCurrentStage = Math.max(0, currentStageDuration - elapsedDays);
    remainingDays += remainingInCurrentStage;
    for (let i = currentIndex + 1; i < EVENT_SEQUENCE.length; i++) {
      remainingDays += STAGE_DURATION_DAYS[EVENT_SEQUENCE[i]] || 1;
    }

    // Adjust for shipping route (sea is longer than road/air)
    const route = pkg.order?.shippingRoute;
    if (route === 'SEA') {
      // Sea transit stage is already accounted for at 7 days, which is reasonable
    } else if (route === 'AIR') {
      // Air is much faster during transit stage
      if (currentIndex < EVENT_SEQUENCE.indexOf(TrackingEventType.ARRIVED_PORT)) {
        remainingDays = Math.max(1, Math.ceil(remainingDays * 0.4));
      }
    } else if (route === 'ROAD') {
      // Road is moderately fast
      if (currentIndex < EVENT_SEQUENCE.indexOf(TrackingEventType.ARRIVED_PORT)) {
        remainingDays = Math.max(1, Math.ceil(remainingDays * 0.6));
      }
    }

    const estimatedDeliveryDate = new Date(
      Date.now() + remainingDays * 24 * 60 * 60 * 1000,
    );

    // Determine confidence based on how far along the tracking is
    const progress = (currentIndex + 1) / EVENT_SEQUENCE.length;
    let confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    if (progress >= 0.7) {
      confidence = 'HIGH';
    } else if (progress >= 0.4) {
      confidence = 'MEDIUM';
    } else {
      confidence = 'LOW';
    }

    return {
      packageId,
      packageCode: pkg.code,
      currentStage,
      currentStageIndex: currentIndex,
      totalStages: EVENT_SEQUENCE.length,
      progressPercent: Math.round(progress * 100),
      estimatedDeliveryDate,
      estimatedDaysRemaining: remainingDays,
      shippingRoute: route,
      confidence,
      lastUpdateAt: latestEvent.eventTimestamp,
      lastLocation: latestEvent.location,
    };
  }

  /**
   * Maps external provider status strings to internal TrackingEventType.
   */
  private mapExternalStatus(externalStatus: string): TrackingEventType {
    const statusMap: Record<string, TrackingEventType> = {
      pickup: TrackingEventType.PICKED_UP,
      collected: TrackingEventType.PICKED_UP,
      in_transit: TrackingEventType.IN_TRANSIT,
      transit: TrackingEventType.IN_TRANSIT,
      arrived: TrackingEventType.ARRIVED_PORT,
      customs: TrackingEventType.CUSTOMS_CLEARANCE,
      clearance: TrackingEventType.CUSTOMS_RELEASED,
      delivered: TrackingEventType.DELIVERED,
      out_for_delivery: TrackingEventType.OUT_FOR_DELIVERY,
    };

    const normalized = externalStatus.toLowerCase().replace(/[^a-z_]/g, '_');
    return statusMap[normalized] || TrackingEventType.IN_TRANSIT;
  }
}
