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
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { WarehouseVNService } from './warehouse-vn.service';
import { ReceiveVNDto } from './dto/receive-vn.dto';
import { DispatchDto } from './dto/dispatch.dto';

@ApiTags('Warehouse VN')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouse-vn')
export class WarehouseVNController {
  constructor(private readonly warehouseVNService: WarehouseVNService) {}

  @Post('receive')
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    UserRole.WAREHOUSE_VN_MANAGER,
    UserRole.WAREHOUSE_VN_STAFF,
    UserRole.XNK_MANAGER,
  )
  @ApiOperation({
    summary: 'Receive packages from a container',
    description:
      'Receives packages from an arrived container at Warehouse VN. ' +
      'Validates the container status and marks packages as RECEIVED.',
  })
  @ApiResponse({ status: 201, description: 'Packages received successfully' })
  @ApiResponse({ status: 400, description: 'Invalid container status' })
  @ApiResponse({ status: 404, description: 'Container or packages not found' })
  async receiveFromContainer(
    @Body() dto: ReceiveVNDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.warehouseVNService.receiveFromContainer(
      dto,
      user.id,
    );
    return BaseResponse.ok(result, 'Packages received at Warehouse VN');
  }

  @Get('packages')
  @ApiOperation({
    summary: 'List packages at Warehouse VN',
    description:
      'Returns paginated packages that have been received at Warehouse VN.',
  })
  @ApiPaginated()
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by VN warehouse status (RECEIVED, SORTED, READY, DELIVERED)',
  })
  @ApiQuery({
    name: 'orderId',
    required: false,
    description: 'Filter by order ID',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by package code, tracking number, or order code',
  })
  @ApiQuery({
    name: 'branch',
    required: false,
    enum: Branch,
    description: 'Filter by branch',
  })
  @ApiResponse({ status: 200, description: 'Packages retrieved successfully' })
  async listPackages(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('orderId') orderId?: string,
    @Query('search') search?: string,
    @Query('branch') branch?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const result = await this.warehouseVNService.listPackages({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      orderId,
      search,
      branch,
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

  @Patch('packages/sort')
  @Roles(
    UserRole.WAREHOUSE_VN_MANAGER,
    UserRole.WAREHOUSE_VN_STAFF,
  )
  @ApiOperation({
    summary: 'Sort packages',
    description:
      'Updates the status of multiple packages. Valid transitions: RECEIVED -> SORTED -> READY.',
  })
  @ApiResponse({ status: 200, description: 'Packages sorted' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  async sortPackages(
    @Body('packageIds') packageIds: string[],
    @Body('status') status: string,
  ) {
    const result = await this.warehouseVNService.sortPackages(
      packageIds,
      status,
    );
    return BaseResponse.ok(result, `${result.updatedCount} packages updated to ${status}`);
  }

  @Post('dispatch')
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    UserRole.WAREHOUSE_VN_MANAGER,
    UserRole.WAREHOUSE_VN_STAFF,
  )
  @ApiOperation({
    summary: 'Dispatch deliveries',
    description:
      'Creates delivery records and optionally assigns a driver and vehicle. ' +
      'Groups deliveries for efficient routing.',
  })
  @ApiResponse({ status: 201, description: 'Deliveries dispatched successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Order or driver not found' })
  async dispatch(
    @Body() dto: DispatchDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const branch = user.branch ?? Branch.HN;
    const deliveries = await this.warehouseVNService.dispatchDelivery(
      dto,
      user.id,
      branch,
    );
    return BaseResponse.ok(
      deliveries,
      `${deliveries.length} deliveries dispatched`,
    );
  }

  @Post('deliveries/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.WAREHOUSE_VN_MANAGER,
    UserRole.WAREHOUSE_VN_STAFF,
    UserRole.DRIVER,
  )
  @ApiOperation({
    summary: 'Confirm delivery',
    description:
      'Confirms a delivery with proof of delivery. If COD is required, collection must be confirmed.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  @ApiResponse({ status: 200, description: 'Delivery confirmed' })
  @ApiResponse({ status: 400, description: 'COD not collected or invalid status' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  async confirmDelivery(
    @Param('id') id: string,
    @Body()
    body: {
      podImageUrl?: string;
      signatureUrl?: string;
      codCollected?: boolean;
    },
  ) {
    const result = await this.warehouseVNService.confirmDelivery(id, body);
    return BaseResponse.ok(result, 'Delivery confirmed successfully');
  }

  @Get('delivery-plan')
  @Roles(
    UserRole.WAREHOUSE_VN_MANAGER,
    UserRole.WAREHOUSE_VN_STAFF,
    UserRole.COO,
  )
  @ApiOperation({
    summary: 'Get delivery plan',
    description:
      'Returns pending deliveries grouped by area for route planning.',
  })
  @ApiQuery({
    name: 'branch',
    required: false,
    enum: Branch,
    description: 'Branch to plan deliveries for',
  })
  @ApiResponse({ status: 200, description: 'Delivery plan retrieved' })
  async getDeliveryPlan(
    @Query('branch') branch?: Branch,
    @CurrentUser() user?: ICurrentUser,
  ) {
    const planBranch = branch ?? user?.branch ?? Branch.HN;
    const plan = await this.warehouseVNService.getDeliveryPlan(planBranch);
    return BaseResponse.ok(plan);
  }

  @Post('deliveries/optimize-route')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Optimize delivery route',
    description:
      'Returns an optimized delivery route for the given deliveries. ' +
      'Currently uses a stub implementation (sequential ordering).',
  })
  @ApiResponse({ status: 200, description: 'Route optimized' })
  async optimizeRoute(
    @Body('deliveryIds') deliveryIds: string[],
  ) {
    const result = await this.warehouseVNService.optimizeRoute(deliveryIds);
    return BaseResponse.ok(result);
  }
}
