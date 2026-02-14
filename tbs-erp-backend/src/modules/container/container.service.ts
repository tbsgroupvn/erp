import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, ShippingRoute } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ContainerRepository } from './container.repository';
import { ConsolidationService } from './domain/consolidation.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { ContainerQueryDto } from './dto/container-query.dto';

/**
 * Valid container status transitions.
 */
const CONTAINER_STATUS_TRANSITIONS: Record<string, string[]> = {
  PLANNING: ['LOADING'],
  LOADING: ['IN_TRANSIT'],
  IN_TRANSIT: ['ARRIVED'],
  ARRIVED: ['CUSTOMS'],
  CUSTOMS: ['COMPLETED'],
  COMPLETED: [],
};

@Injectable()
export class ContainerService {
  private readonly logger = new Logger(ContainerService.name);

  constructor(
    private readonly containerRepo: ContainerRepository,
    private readonly consolidation: ConsolidationService,
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
      maxCapacity: dto.maxCapacity
        ? new Decimal(dto.maxCapacity)
        : undefined,
      estimatedDepartureAt: dto.estimatedDepartureAt
        ? new Date(dto.estimatedDepartureAt)
        : undefined,
      estimatedArrivalAt: dto.estimatedArrivalAt
        ? new Date(dto.estimatedArrivalAt)
        : undefined,
      createdBy: userId,
    });

    this.eventEmitter.emit('container.created', {
      containerId: container.id,
      code: container.code,
      shippingRoute: dto.shippingRoute,
      createdBy: userId,
    });

    this.logger.log(
      `Container ${code} created for route ${dto.shippingRoute} by ${userId}`,
    );

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

    if (query.startDate || query.endDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (query.startDate) {
        dateFilter.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const endOfDay = new Date(query.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter.lte = endOfDay;
      }
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
      throw new BadRequestException(
        'Completed containers cannot be modified',
      );
    }

    const updateData: Prisma.ContainerUpdateInput = {};

    if (dto.shippingRoute !== undefined)
      updateData.shippingRoute = dto.shippingRoute;
    if (dto.origin !== undefined) updateData.origin = dto.origin;
    if (dto.destination !== undefined)
      updateData.destination = dto.destination;
    if (dto.carrier !== undefined) updateData.carrier = dto.carrier;
    if (dto.bookingRef !== undefined) updateData.bookingRef = dto.bookingRef;
    if (dto.sealNumber !== undefined)
      updateData.sealNumber = dto.sealNumber;
    if (dto.vesselName !== undefined)
      updateData.vesselName = dto.vesselName;
    if (dto.maxCapacity !== undefined)
      updateData.maxCapacity = new Decimal(dto.maxCapacity);
    if (dto.estimatedDepartureAt !== undefined)
      updateData.estimatedDepartureAt = new Date(dto.estimatedDepartureAt);
    if (dto.estimatedArrivalAt !== undefined)
      updateData.estimatedArrivalAt = new Date(dto.estimatedArrivalAt);

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
    const container = await this.containerRepo.findById(containerId);

    if (!container) {
      throw new NotFoundException(
        `Container with ID ${containerId} not found`,
      );
    }

    // Only allow adding in PLANNING or LOADING
    if (!['PLANNING', 'LOADING'].includes(container.status)) {
      throw new BadRequestException(
        `Cannot add packages to a container in ${container.status} status`,
      );
    }

    // Validate all packages
    const packages = await this.prisma.package.findMany({
      where: { id: { in: packageIds } },
      select: {
        id: true,
        code: true,
        containerId: true,
        warehouseCNStatus: true,
        order: { select: { shippingRoute: true } },
      },
    });

    if (packages.length !== packageIds.length) {
      const foundIds = packages.map((p) => p.id);
      const missing = packageIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Packages not found: ${missing.join(', ')}`,
      );
    }

    // Check for packages already assigned to a different container
    const alreadyAssigned = packages.filter(
      (p) => p.containerId && p.containerId !== containerId,
    );
    if (alreadyAssigned.length > 0) {
      throw new BadRequestException(
        `Packages already assigned to another container: ${alreadyAssigned.map((p) => p.code).join(', ')}`,
      );
    }

    // Check warehouse status
    const notReady = packages.filter(
      (p) => p.warehouseCNStatus !== 'PACKED',
    );
    if (notReady.length > 0) {
      throw new BadRequestException(
        `Packages not in PACKED status: ${notReady.map((p) => p.code).join(', ')}. ` +
          `Only PACKED packages can be added to a container.`,
      );
    }

    const updated = await this.containerRepo.addPackages(
      containerId,
      packageIds,
    );

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
  }

  /**
   * Updates the container status with validation.
   * Emits events on specific transitions (e.g., ARRIVED triggers warehouse notification).
   */
  async updateStatus(id: string, newStatus: string, userId: string) {
    const container = await this.containerRepo.findById(id);

    if (!container) {
      throw new NotFoundException(`Container with ID ${id} not found`);
    }

    // Validate status transition
    const validTransitions =
      CONTAINER_STATUS_TRANSITIONS[container.status] || [];
    if (!validTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid container status transition from ${container.status} to ${newStatus}. ` +
          `Valid transitions: ${validTransitions.join(', ') || 'none'}`,
      );
    }

    // Build update data with timestamps
    const updateData: Prisma.ContainerUpdateInput = { status: newStatus };

    switch (newStatus) {
      case 'IN_TRANSIT':
        updateData.actualDepartureAt = new Date();
        break;
      case 'ARRIVED':
        updateData.actualArrivalAt = new Date();
        break;
      case 'CUSTOMS':
        // No special timestamp, but could trigger customs workflow
        break;
      case 'COMPLETED':
        updateData.customsClearedAt = new Date();
        break;
    }

    const updated = await this.containerRepo.update(id, updateData);

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

    this.logger.log(
      `Container ${container.code} status changed: ${container.status} -> ${newStatus} by ${userId}`,
    );

    return updated;
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
}
