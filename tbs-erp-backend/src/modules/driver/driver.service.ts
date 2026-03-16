import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, DriverStatus, Branch } from '@prisma/client';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriverQueryDto } from './dto/driver-query.dto';

@Injectable()
export class DriverService {
  private readonly logger = new Logger(DriverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new driver record.
   */
  async createDriver(dto: CreateDriverDto) {
    const driver = await this.prisma.driver.create({
      data: {
        employeeId: dto.employeeId,
        fullName: dto.fullName,
        phone: dto.phone,
        licenseNumber: dto.licenseNumber,
        licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : undefined,
        licenseType: dto.licenseType,
        vehicleId: dto.vehicleId,
        branch: dto.branch,
        status: DriverStatus.AVAILABLE,
      },
    });

    this.logger.log(`Driver created: ${dto.fullName}`);
    return driver;
  }

  /**
   * Updates a driver record.
   */
  async updateDriver(id: string, dto: UpdateDriverDto) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) {
      throw new NotFoundException(`Driver with ID ${id} not found`);
    }

    const updateData: Prisma.DriverUpdateInput = {};
    if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.licenseNumber !== undefined) updateData.licenseNumber = dto.licenseNumber;
    if (dto.licenseExpiry !== undefined) {
      updateData.licenseExpiry = new Date(dto.licenseExpiry);
    }
    if (dto.licenseType !== undefined) updateData.licenseType = dto.licenseType;
    if (dto.vehicleId !== undefined) updateData.vehicleId = dto.vehicleId;
    if (dto.branch !== undefined) updateData.branch = dto.branch;
    if (dto.employeeId !== undefined) updateData.employeeId = dto.employeeId;

    return this.prisma.driver.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Lists drivers with pagination and filters.
   */
  async findAll(query: DriverQueryDto) {
    const where: Prisma.DriverWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.branch) where.branch = query.branch;
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.driver.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy as Prisma.DriverOrderByWithRelationInput,
      }),
      this.prisma.driver.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets driver detail with current assignment.
   */
  async findById(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        deliveries: {
          where: { status: { in: ['DISPATCHED', 'PICKED_UP', 'DELIVERING'] } },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException(`Driver with ID ${id} not found`);
    }

    return driver;
  }

  /**
   * Assigns a vehicle to a driver.
   */
  async assignVehicle(driverId: string, vehicleId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) {
      throw new NotFoundException(`Driver with ID ${driverId} not found`);
    }

    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${vehicleId} not found`);
    }

    if (vehicle.status !== 'ACTIVE') {
      throw new BadRequestException(`Vehicle ${vehicle.plateNumber} is ${vehicle.status}`);
    }

    const updated = await this.prisma.driver.update({
      where: { id: driverId },
      data: { vehicleId },
    });

    this.logger.log(`Vehicle ${vehicle.plateNumber} assigned to driver ${driver.fullName}`);

    return updated;
  }

  /**
   * Updates driver status.
   */
  async updateStatus(id: string, status: DriverStatus) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) {
      throw new NotFoundException(`Driver with ID ${id} not found`);
    }

    return this.prisma.driver.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Gets delivery history for a driver.
   */
  async getDeliveryHistory(driverId: string, startDate: string, endDate: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) {
      throw new NotFoundException(`Driver with ID ${driverId} not found`);
    }

    return this.prisma.delivery.findMany({
      where: {
        driverId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Gets available drivers for a branch.
   */
  async getAvailableDrivers(branch: Branch) {
    return this.prisma.driver.findMany({
      where: {
        branch,
        status: DriverStatus.AVAILABLE,
      },
      orderBy: { fullName: 'asc' },
    });
  }

  /**
   * Gets performance stats for a driver.
   */
  async getPerformance(driverId: string, startDate: string, endDate: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) {
      throw new NotFoundException(`Driver with ID ${driverId} not found`);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const deliveries = await this.prisma.delivery.findMany({
      where: {
        driverId,
        createdAt: { gte: start, lte: end },
      },
    });

    const totalDeliveries = deliveries.length;
    const completedDeliveries = deliveries.filter((d) => d.status === 'DELIVERED').length;
    const failedDeliveries = deliveries.filter((d) => d.status === 'FAILED').length;

    // On-time rate: deliveries completed on/before scheduled date
    const onTimeDeliveries = deliveries.filter((d) => {
      if (d.status !== 'DELIVERED' || !d.deliveredAt || !d.scheduledAt) return false;
      return new Date(d.deliveredAt) <= new Date(d.scheduledAt);
    }).length;

    const onTimeRate =
      completedDeliveries > 0 ? Math.round((onTimeDeliveries / completedDeliveries) * 100) : 0;

    // COD collected
    const codCollected = deliveries
      .filter((d) => d.codCollected)
      .reduce((sum, d) => sum + Number(d.codAmount), 0);

    return {
      driverId,
      driverName: driver.fullName,
      period: { startDate, endDate },
      totalDeliveries,
      completedDeliveries,
      failedDeliveries,
      onTimeRate,
      codCollected: Math.round(codCollected),
    };
  }
}
