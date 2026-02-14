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
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { UserRole } from '@prisma/client';
import { WarehouseCNService } from './warehouse-cn.service';
import { ReceivePackageDto } from './dto/receive-package.dto';
import { MeasurePackageDto } from './dto/measure-package.dto';

@ApiTags('Warehouse CN')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouse-cn')
export class WarehouseCNController {
  constructor(private readonly warehouseCNService: WarehouseCNService) {}

  @Post('receive')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Receive a package at Warehouse CN',
    description:
      'Scans a tracking number to receive a package. Automatically matches against pre-alerts. ' +
      'If no pre-alert match is found, a LostAndFound record is created.',
  })
  @ApiResponse({ status: 201, description: 'Package received successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Duplicate tracking number' })
  async receivePackage(
    @Body() dto: ReceivePackageDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.warehouseCNService.receivePackage(
      dto,
      user.id,
    );
    return BaseResponse.ok(result, 'Package received at Warehouse CN');
  }

  @Post('packages/:id/measure')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Measure a package',
    description:
      'Records dimensions and weight for a package. Calculates volumetric weight ' +
      'based on the shipping route and determines chargeable weight.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiResponse({ status: 200, description: 'Package measured successfully' })
  @ApiResponse({ status: 400, description: 'Package not in RECEIVED status' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async measurePackage(
    @Param('id') id: string,
    @Body() dto: MeasurePackageDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.warehouseCNService.measurePackage(
      id,
      dto,
      user.id,
    );
    return BaseResponse.ok(result, 'Package measured successfully');
  }

  @Patch('packages/:id/status')
  @Roles(UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Update package warehouse CN status',
    description:
      'Transitions package status: RECEIVED -> CHECKED -> PACKED -> SHIPPED.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async updatePackageStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    const pkg = await this.warehouseCNService.updatePackageStatus(id, status);
    return BaseResponse.ok(pkg, `Package status updated to ${status}`);
  }

  @Get('packages')
  @ApiOperation({
    summary: 'List packages at Warehouse CN',
    description:
      'Returns paginated packages that have been received at Warehouse CN with optional filters.',
  })
  @ApiPaginated()
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by warehouse CN status (RECEIVED, CHECKED, PACKED, SHIPPED)',
    example: 'RECEIVED',
  })
  @ApiQuery({
    name: 'orderId',
    required: false,
    description: 'Filter by order ID',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by package code or tracking number',
  })
  @ApiResponse({ status: 200, description: 'Packages retrieved successfully' })
  async listPackages(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('orderId') orderId?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const result = await this.warehouseCNService.listPackages({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      orderId,
      search,
      sortBy,
      sortOrder,
    });

    return PaginatedResponse.paginate(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get('packages/:id')
  @ApiOperation({
    summary: 'Get package detail',
    description: 'Returns full package details with order and container relations.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiResponse({ status: 200, description: 'Package retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async getPackage(@Param('id') id: string) {
    const pkg = await this.warehouseCNService.listPackages({
      search: id,
      limit: 1,
    });
    // Try direct lookup through repository for detailed view
    return BaseResponse.ok(pkg.data[0] ?? null);
  }
}
