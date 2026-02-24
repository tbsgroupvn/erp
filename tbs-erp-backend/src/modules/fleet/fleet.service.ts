import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, VehicleStatus, Branch } from '@prisma/client';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { FleetQueryDto } from './dto/fleet-query.dto';
import {
  ScheduleMaintenanceDto,
  CompleteMaintenanceDto,
  RecordFuelDto,
} from './dto/maintenance.dto';

@Injectable()
export class FleetService {
  private readonly logger = new Logger(FleetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  /**
   * Creates a new vehicle record.
   */
  async createVehicle(dto: CreateVehicleDto) {
    // Check for duplicate plate number
    const existing = await this.prisma.vehicle.findUnique({
      where: { plateNumber: dto.plateNumber },
    });
    if (existing) {
      throw new ConflictException(`Vehicle with plate ${dto.plateNumber} already exists`);
    }

    const vehicle = await this.prisma.vehicle.create({
      data: {
        plateNumber: dto.plateNumber,
        type: dto.type,
        brand: dto.brand,
        model: dto.model,
        year: dto.year,
        capacityKg: dto.capacityKg,
        volumeM3: dto.volumeM3,
        branch: dto.branch,
        insuranceExpiry: dto.insuranceExpiry ? new Date(dto.insuranceExpiry) : undefined,
        registrationExpiry: dto.registrationExpiry ? new Date(dto.registrationExpiry) : undefined,
        status: VehicleStatus.ACTIVE,
      },
    });

    this.logger.log(`Vehicle created: ${dto.plateNumber}`);
    return vehicle;
  }

  /**
   * Updates a vehicle record.
   */
  async updateVehicle(id: string, dto: UpdateVehicleDto) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${id} not found`);
    }

    const updateData: Prisma.VehicleUpdateInput = {};
    if (dto.plateNumber !== undefined) updateData.plateNumber = dto.plateNumber;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.brand !== undefined) updateData.brand = dto.brand;
    if (dto.model !== undefined) updateData.model = dto.model;
    if (dto.year !== undefined) updateData.year = dto.year;
    if (dto.capacityKg !== undefined) updateData.capacityKg = dto.capacityKg;
    if (dto.volumeM3 !== undefined) updateData.volumeM3 = dto.volumeM3;
    if (dto.branch !== undefined) updateData.branch = dto.branch;
    if (dto.insuranceExpiry !== undefined) {
      updateData.insuranceExpiry = new Date(dto.insuranceExpiry);
    }
    if (dto.registrationExpiry !== undefined) {
      updateData.registrationExpiry = new Date(dto.registrationExpiry);
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Lists vehicles with pagination and filters.
   */
  async findAll(query: FleetQueryDto) {
    const where: Prisma.VehicleWhereInput = {};

    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.branch) where.branch = query.branch;
    if (query.search) {
      where.plateNumber = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy as Prisma.VehicleOrderByWithRelationInput,
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets vehicle detail with maintenance history.
   */
  async findById(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        maintenanceRecords: {
          orderBy: { scheduledDate: 'desc' },
          take: 20,
        },
        fuelRecords: {
          orderBy: { date: 'desc' },
          take: 20,
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${id} not found`);
    }

    return vehicle;
  }

  /**
   * Schedules maintenance for a vehicle.
   */
  async scheduleMaintenance(vehicleId: string, dto: ScheduleMaintenanceDto) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${vehicleId} not found`);
    }

    const maintenance = await this.prisma.vehicleMaintenance.create({
      data: {
        vehicleId,
        type: dto.type,
        scheduledDate: new Date(dto.scheduledDate),
        notes: dto.notes,
      },
    });

    const scheduledDate = new Date(dto.scheduledDate);
    scheduledDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (scheduledDate <= today) {
      await this.prisma.vehicle.update({
        where: { id: vehicleId },
        data: { status: VehicleStatus.MAINTENANCE },
      });
    }

    this.logger.log(`Maintenance scheduled for vehicle ${vehicle.plateNumber}`);
    return maintenance;
  }

  /**
   * Completes a maintenance record.
   */
  async completeMaintenance(maintenanceId: string, dto: CompleteMaintenanceDto) {
    const maintenance = await this.prisma.vehicleMaintenance.findUnique({
      where: { id: maintenanceId },
    });

    if (!maintenance) {
      throw new NotFoundException(`Maintenance record ${maintenanceId} not found`);
    }

    if (maintenance.completedDate) {
      throw new BadRequestException('Maintenance already completed');
    }

    const updated = await this.prisma.vehicleMaintenance.update({
      where: { id: maintenanceId },
      data: {
        completedDate: new Date(),
        cost: dto.cost,
        notes: dto.notes,
        nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : undefined,
      },
    });

    // Set vehicle back to ACTIVE
    await this.prisma.vehicle.update({
      where: { id: maintenance.vehicleId },
      data: { status: VehicleStatus.ACTIVE },
    });

    this.logger.log(`Maintenance completed for vehicle ${maintenance.vehicleId}`);
    return updated;
  }

  /**
   * Records a fuel entry for a vehicle.
   */
  async recordFuel(vehicleId: string, dto: RecordFuelDto) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${vehicleId} not found`);
    }

    return this.prisma.fuelRecord.create({
      data: {
        vehicleId,
        date: new Date(dto.date),
        liters: dto.liters,
        cost: dto.cost,
        odometer: dto.odometer,
      },
    });
  }

  /**
   * Gets utilization stats for a vehicle.
   */
  async getUtilization(vehicleId: string, startDate: string, endDate: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${vehicleId} not found`);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format for startDate or endDate');
    }

    if (start > end) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const [deliveries, fuelRecords] = await Promise.all([
      this.prisma.delivery.findMany({
        where: {
          vehicleId,
          createdAt: { gte: start, lte: end },
        },
      }),
      this.prisma.fuelRecord.findMany({
        where: {
          vehicleId,
          date: { gte: start, lte: end },
        },
      }),
    ]);

    const totalFuelLiters = fuelRecords.reduce((sum, f) => sum + Number(f.liters), 0);
    const totalFuelCost = fuelRecords.reduce((sum, f) => sum + Number(f.cost), 0);

    // Calculate distance from odometer readings if available
    const sortedFuel = fuelRecords
      .filter((f) => f.odometer)
      .sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });

    let totalDistance = 0;
    if (sortedFuel.length >= 2) {
      totalDistance =
        (Number(sortedFuel[sortedFuel.length - 1].odometer) ?? 0) -
        (Number(sortedFuel[0].odometer) ?? 0);
    }

    return {
      vehicleId,
      plateNumber: vehicle.plateNumber,
      period: { startDate, endDate },
      trips: deliveries.length,
      totalDistance: Math.round(totalDistance),
      fuelConsumption: {
        totalLiters: Math.round(totalFuelLiters * 100) / 100,
        totalCost: Math.round(totalFuelCost),
        avgLitersPerTrip:
          deliveries.length > 0
            ? Math.round((totalFuelLiters / deliveries.length) * 100) / 100
            : 0,
      },
    };
  }

  /**
   * Gets vehicles that are available (not in maintenance and not assigned to active deliveries).
   */
  async getAvailableVehicles(branch: Branch, date: string) {
    const targetDate = new Date(date);

    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.prisma.vehicle.findMany({
      where: {
        branch,
        status: VehicleStatus.ACTIVE,
      },
      orderBy: { plateNumber: 'asc' },
    });
  }
}
