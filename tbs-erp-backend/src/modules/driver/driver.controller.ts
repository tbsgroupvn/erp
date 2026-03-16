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
import { Branch, DriverStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { DriverService } from './driver.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriverQueryDto } from './dto/driver-query.dto';

@ApiTags('Drivers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('drivers')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Post()
  @Roles(UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_VN_MANAGER, UserRole.CEO, UserRole.COO)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new driver' })
  @ApiResponse({ status: 201, description: 'Driver created successfully' })
  async create(@Body() dto: CreateDriverDto) {
    const driver = await this.driverService.createDriver(dto);
    return BaseResponse.ok(driver, 'Driver created successfully');
  }

  @Get()
  @Roles(UserRole.CEO, UserRole.COO, UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_VN_MANAGER, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'List drivers with filters' })
  @ApiResponse({ status: 200, description: 'Drivers retrieved successfully' })
  async findAll(@Query() query: DriverQueryDto) {
    const result = await this.driverService.findAll(query);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('available')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_VN_MANAGER, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'Get available drivers for a branch' })
  @ApiQuery({ name: 'branch', required: true, enum: Branch })
  async getAvailableDrivers(@Query('branch') branch: Branch) {
    const drivers = await this.driverService.getAvailableDrivers(branch);
    return BaseResponse.ok(drivers);
  }

  @Get(':id')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_VN_MANAGER, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'Get driver detail' })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  async findById(@Param('id') id: string) {
    const driver = await this.driverService.findById(id);
    return BaseResponse.ok(driver);
  }

  @Patch(':id')
  @Roles(UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_VN_MANAGER, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Update driver info' })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateDriverDto) {
    const driver = await this.driverService.updateDriver(id, dto);
    return BaseResponse.ok(driver, 'Driver updated successfully');
  }

  @Post(':id/assign-vehicle')
  @Roles(UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_VN_MANAGER, UserRole.CEO, UserRole.COO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a vehicle to a driver' })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  async assignVehicle(@Param('id') id: string, @Body('vehicleId') vehicleId: string) {
    const result = await this.driverService.assignVehicle(id, vehicleId);
    return BaseResponse.ok(result, 'Vehicle assigned successfully');
  }

  @Patch(':id/status')
  @Roles(UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_VN_MANAGER, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Update driver status' })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  async updateStatus(@Param('id') id: string, @Body('status') status: DriverStatus) {
    const result = await this.driverService.updateStatus(id, status);
    return BaseResponse.ok(result, 'Status updated');
  }

  @Get(':id/deliveries')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_VN_MANAGER, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'Get driver delivery history' })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getDeliveryHistory(
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const result = await this.driverService.getDeliveryHistory(id, startDate, endDate);
    return BaseResponse.ok(result);
  }

  @Get(':id/performance')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_VN_MANAGER, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'Get driver performance stats' })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getPerformance(
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const result = await this.driverService.getPerformance(id, startDate, endDate);
    return BaseResponse.ok(result);
  }
}
