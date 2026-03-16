import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Branch, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { FleetService } from './fleet.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { FleetQueryDto } from './dto/fleet-query.dto';
import {
  ScheduleMaintenanceDto,
  CompleteMaintenanceDto,
  RecordFuelDto,
} from './dto/maintenance.dto';

@ApiTags('Fleet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fleet')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Post('vehicles')
  @Roles(UserRole.LOGISTICS_MANAGER, UserRole.CEO, UserRole.COO)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new vehicle' })
  @ApiResponse({ status: 201, description: 'Vehicle created successfully' })
  async createVehicle(@Body() dto: CreateVehicleDto) {
    const vehicle = await this.fleetService.createVehicle(dto);
    return BaseResponse.ok(vehicle, 'Vehicle created successfully');
  }

  @Get('vehicles')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_VN_MANAGER, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'List vehicles with filters' })
  @ApiResponse({ status: 200, description: 'Vehicles retrieved successfully' })
  async findAll(@Query() query: FleetQueryDto) {
    const result = await this.fleetService.findAll(query);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('vehicles/available')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_VN_MANAGER, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'Get available vehicles' })
  @ApiQuery({ name: 'branch', required: true, enum: Branch })
  @ApiQuery({ name: 'date', required: true, example: '2025-06-15' })
  async getAvailableVehicles(@Query('branch') branch: Branch, @Query('date') date: string) {
    const vehicles = await this.fleetService.getAvailableVehicles(branch, date);
    return BaseResponse.ok(vehicles);
  }

  @Get('vehicles/:id')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_VN_MANAGER, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'Get vehicle detail with maintenance history' })
  @ApiParam({ name: 'id', description: 'Vehicle ID' })
  async findById(@Param('id') id: string) {
    const vehicle = await this.fleetService.findById(id);
    return BaseResponse.ok(vehicle);
  }

  @Patch('vehicles/:id')
  @Roles(UserRole.LOGISTICS_MANAGER, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Update vehicle info' })
  @ApiParam({ name: 'id', description: 'Vehicle ID' })
  async updateVehicle(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    const vehicle = await this.fleetService.updateVehicle(id, dto);
    return BaseResponse.ok(vehicle, 'Vehicle updated successfully');
  }

  @Post('vehicles/:id/maintenance')
  @Roles(UserRole.LOGISTICS_MANAGER, UserRole.CEO, UserRole.COO)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule maintenance for a vehicle' })
  @ApiParam({ name: 'id', description: 'Vehicle ID' })
  async scheduleMaintenance(@Param('id') id: string, @Body() dto: ScheduleMaintenanceDto) {
    const maintenance = await this.fleetService.scheduleMaintenance(id, dto);
    return BaseResponse.ok(maintenance, 'Maintenance scheduled');
  }

  @Post('maintenance/:maintenanceId/complete')
  @Roles(UserRole.LOGISTICS_MANAGER, UserRole.CEO, UserRole.COO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a maintenance record' })
  @ApiParam({ name: 'maintenanceId', description: 'Maintenance record ID' })
  async completeMaintenance(
    @Param('maintenanceId') maintenanceId: string,
    @Body() dto: CompleteMaintenanceDto,
  ) {
    const result = await this.fleetService.completeMaintenance(maintenanceId, dto);
    return BaseResponse.ok(result, 'Maintenance completed');
  }

  @Post('vehicles/:id/fuel')
  @Roles(UserRole.LOGISTICS_MANAGER, UserRole.CEO, UserRole.COO)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record fuel consumption' })
  @ApiParam({ name: 'id', description: 'Vehicle ID' })
  async recordFuel(@Param('id') id: string, @Body() dto: RecordFuelDto) {
    const result = await this.fleetService.recordFuel(id, dto);
    return BaseResponse.ok(result, 'Fuel record created');
  }

  @Get('vehicles/:id/utilization')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_VN_MANAGER, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'Get vehicle utilization stats' })
  @ApiParam({ name: 'id', description: 'Vehicle ID' })
  @ApiQuery({ name: 'startDate', required: true, example: '2025-01-01' })
  @ApiQuery({ name: 'endDate', required: true, example: '2025-06-30' })
  async getUtilization(
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const result = await this.fleetService.getUtilization(id, startDate, endDate);
    return BaseResponse.ok(result);
  }
}
