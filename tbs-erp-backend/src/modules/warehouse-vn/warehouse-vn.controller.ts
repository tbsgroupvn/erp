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
import { Branch, UserRole, WarehouseVNStatus } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { WarehouseVNService } from './warehouse-vn.service';
import { WarehouseVNStorageService } from './warehouse-vn-storage.service';
import { WarehouseVNInventoryService } from './warehouse-vn-inventory.service';
import { DeliveryDispatchService } from './domain/delivery-dispatch.service';
import { ReceiveVNDto } from './dto/receive-vn.dto';
import { DispatchDto } from './dto/dispatch.dto';
import { ReweighVNDto } from './dto/reweigh-vn.dto';
import { MarkDeliveryFailedDto } from './dto/mark-delivery-failed.dto';
import { RescheduleDeliveryDto } from './dto/reschedule-delivery.dto';

@ApiTags('Warehouse VN')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouse-vn')
export class WarehouseVNController {
  constructor(
    private readonly warehouseVNService: WarehouseVNService,
    private readonly storageService: WarehouseVNStorageService,
    private readonly inventoryService: WarehouseVNInventoryService,
    private readonly deliveryDispatch: DeliveryDispatchService,
  ) {}

  @Post('receive')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF, UserRole.XNK_MANAGER)
  @ApiOperation({
    summary: 'Receive packages from a container',
    description:
      'Receives packages from an arrived container at Warehouse VN. ' +
      'Validates the container status and marks packages as RECEIVED.',
  })
  @ApiResponse({ status: 201, description: 'Packages received successfully' })
  @ApiResponse({ status: 400, description: 'Invalid container status' })
  @ApiResponse({ status: 404, description: 'Container or packages not found' })
  async receiveFromContainer(@Body() dto: ReceiveVNDto, @CurrentUser() user: ICurrentUser) {
    const result = await this.warehouseVNService.receiveFromContainer(dto, user.id);
    return BaseResponse.ok(result, 'Packages received at Warehouse VN');
  }

  @Get('pick-list')
  @Roles(UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF, UserRole.XNK_MANAGER)
  @ApiOperation({
    summary: 'Generate pick list for deliveries',
    description:
      'Generates a pick list for the given delivery IDs for efficient warehouse picking.',
  })
  @ApiQuery({ name: 'deliveryIds', required: false, description: 'Comma-separated delivery IDs' })
  @ApiResponse({ status: 200, description: 'Pick list generated successfully' })
  async getPickList(@Query('deliveryIds') deliveryIds: string) {
    const ids = deliveryIds?.split(',') || [];
    const data = await this.storageService.getPickList(ids);
    return BaseResponse.ok(data);
  }

  @Post('storage/assign')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF)
  @ApiOperation({
    summary: 'Assign storage location to package',
    description: 'Assigns a specific storage location within the VN warehouse to a package.',
  })
  @ApiResponse({ status: 200, description: 'Storage location assigned successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async assignStorage(@Body() dto: { packageId: string; locationCode: string }) {
    const result = await this.storageService.assignLocation(dto.packageId, dto.locationCode);
    return BaseResponse.ok(result);
  }

  @Post('inventory-count')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF)
  @ApiOperation({
    summary: 'Create inventory count',
    description: 'Creates a new inventory count record for warehouse stock verification.',
  })
  @ApiResponse({ status: 201, description: 'Inventory count created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async createInventoryCount(
    @Body() dto: { type: string; branch: string; zone?: string },
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.inventoryService.createCount(dto.type, dto.branch, user.id, dto.zone);
    return BaseResponse.ok(result);
  }

  @Get('inventory-count')
  @Roles(UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF, UserRole.COO)
  @ApiOperation({
    summary: 'List inventory counts',
    description: 'Returns paginated list of inventory count records.',
  })
  @ApiResponse({ status: 200, description: 'Inventory counts retrieved successfully' })
  async listInventoryCounts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('branch') branch?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    const result = await this.inventoryService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      branch,
      type,
      status,
    });
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('packages')
  @ApiOperation({
    summary: 'List packages at Warehouse VN',
    description: 'Returns paginated packages that have been received at Warehouse VN.',
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

    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Post('packages/:id/reweigh')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF)
  @ApiOperation({
    summary: 'Reweigh package at VN warehouse',
    description:
      'Records the VN weight for a package and calculates weight variance against CN weight. ' +
      'Triggers alert if variance exceeds 5%.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiResponse({ status: 200, description: 'Package reweighed successfully' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async reweighPackage(
    @Param('id') id: string,
    @Body() dto: ReweighVNDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.warehouseVNService.reweighPackage(id, dto.vnWeight, user.id);
    return BaseResponse.ok(result, 'Package reweighed at VN warehouse');
  }

  @Patch('packages/sort')
  @Roles(UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF)
  @ApiOperation({
    summary: 'Sort packages',
    description:
      'Updates the status of multiple packages. Valid transitions: RECEIVED -> SORTED -> READY.',
  })
  @ApiResponse({ status: 200, description: 'Packages sorted' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  async sortPackages(@Body('packageIds') packageIds: string[], @Body('status') status: WarehouseVNStatus) {
    const result = await this.warehouseVNService.sortPackages(packageIds, status);
    return BaseResponse.ok(result, `${result.updatedCount} packages updated to ${status}`);
  }

  @Post('dispatch')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF)
  @ApiOperation({
    summary: 'Dispatch deliveries',
    description:
      'Creates delivery records and optionally assigns a driver and vehicle. ' +
      'Groups deliveries for efficient routing.',
  })
  @ApiResponse({ status: 201, description: 'Deliveries dispatched successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Order or driver not found' })
  async dispatch(@Body() dto: DispatchDto, @CurrentUser() user: ICurrentUser) {
    const branch = user.branch ?? Branch.HN;
    const deliveries = await this.warehouseVNService.dispatchDelivery(dto, user.id, branch);
    return BaseResponse.ok(deliveries, `${deliveries.length} deliveries dispatched`);
  }

  @Post('deliveries/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF, UserRole.DRIVER)
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
  @Roles(UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF, UserRole.COO)
  @ApiOperation({
    summary: 'Get delivery plan',
    description: 'Returns pending deliveries grouped by area for route planning.',
  })
  @ApiQuery({
    name: 'branch',
    required: false,
    enum: Branch,
    description: 'Branch to plan deliveries for',
  })
  @ApiResponse({ status: 200, description: 'Delivery plan retrieved' })
  async getDeliveryPlan(@Query('branch') branch?: Branch, @CurrentUser() user?: ICurrentUser) {
    const planBranch = branch ?? user?.branch ?? Branch.HN;
    const plan = await this.warehouseVNService.getDeliveryPlan(planBranch);
    return BaseResponse.ok(plan);
  }

  @Get('deliveries/rto')
  @Roles(UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF, UserRole.COO)
  @ApiOperation({
    summary: 'List RTO deliveries with aging info',
    description: 'Returns deliveries with RTO_RECEIVED status including computed rtoAgeDays field.',
  })
  @ApiQuery({
    name: 'branch',
    required: false,
    enum: Branch,
    description: 'Filter by branch',
  })
  @ApiResponse({ status: 200, description: 'RTO deliveries retrieved' })
  async listRtoDeliveries(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('branch') branch?: string,
  ) {
    const result = await this.warehouseVNService.listRtoDeliveries({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      branch,
    });
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('deliveries/:id/rto-fee-breakdown')
  @Roles(
    UserRole.WAREHOUSE_VN_MANAGER,
    UserRole.WAREHOUSE_VN_STAFF,
    UserRole.COO,
    UserRole.ACCOUNTANT,
  )
  @ApiOperation({
    summary: 'Get RTO storage fee breakdown for a delivery',
    description:
      'Returns detailed RTO storage fee breakdown including received date, ' +
      'storage days, daily rate, total fee, and proof photos.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  @ApiResponse({ status: 200, description: 'RTO fee breakdown retrieved' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  async getRtoFeeBreakdown(@Param('id') id: string) {
    const result = await this.warehouseVNService.getRtoFeeBreakdown(id);
    return BaseResponse.ok(result);
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
  async optimizeRoute(@Body('deliveryIds') deliveryIds: string[]) {
    const result = await this.warehouseVNService.optimizeRoute(deliveryIds);
    return BaseResponse.ok(result);
  }

  @Patch('deliveries/:id/carrier-tracking')
  @Roles(
    UserRole.WAREHOUSE_VN_MANAGER,
    UserRole.WAREHOUSE_VN_STAFF,
    UserRole.LOGISTICS_MANAGER,
  )
  @ApiOperation({
    summary: 'Cap nhat ma van don hang van chuyen noi dia',
    description:
      'Cap nhat ma van don tu hang van chuyen (GHTK, GHN, Viettel Post, J&T) cho delivery. ' +
      'Su dung khi kho VN tao don tren he thong hang van chuyen.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  @ApiResponse({ status: 200, description: 'Cap nhat thanh cong' })
  @ApiResponse({ status: 404, description: 'Khong tim thay delivery' })
  async setCarrierTracking(
    @Param('id') id: string,
    @Body() body: { carrierTrackingNumber: string; carrierName: string },
  ) {
    const result = await this.warehouseVNService.setCarrierTracking(
      id,
      body.carrierTrackingNumber,
      body.carrierName,
    );
    return BaseResponse.ok(result, 'Cap nhat ma van don thanh cong');
  }

  // ─── TH-020: Giao hang that bai / RTO ─────────────────────────

  @Post('deliveries/:id/failed')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.DRIVER, UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF)
  @ApiOperation({
    summary: 'Bao giao hang that bai',
    description:
      'Tai xe hoac kho VN bao giao that bai. Tu dong chuyen trang thai FAILED va khoi tao RTO tra hang ve kho.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  @ApiResponse({ status: 200, description: 'Delivery marked as failed, RTO initiated' })
  @ApiResponse({ status: 400, description: 'Trang thai delivery khong hop le' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  async markDeliveryFailed(
    @Param('id') id: string,
    @Body() dto: MarkDeliveryFailedDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.warehouseVNService.markDeliveryFailed(id, dto, user.id);
    return BaseResponse.ok(result, 'Giao hang that bai - RTO da khoi tao');
  }

  @Post('deliveries/:id/rto/initiate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF, UserRole.DRIVER)
  @ApiOperation({
    summary: 'Khoi tao RTO - Tra hang ve kho',
    description: 'Bat dau qua trinh tra hang ve kho VN khi giao that bai.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  @ApiResponse({ status: 200, description: 'RTO initiated' })
  @ApiResponse({ status: 400, description: 'Trang thai delivery khong hop le' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  async initiateRTO(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    const result = await this.deliveryDispatch.initiateRTO(id, reason);
    return BaseResponse.ok(result, 'RTO da khoi tao');
  }

  @Post('deliveries/:id/rto/receive')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF)
  @ApiOperation({
    summary: 'Kho scan nhan hang hoan',
    description: 'Kho VN xac nhan da nhan hang hoan tu tai xe. Bat dau tinh phi luu kho.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  @ApiResponse({ status: 200, description: 'RTO received at warehouse' })
  @ApiResponse({ status: 400, description: 'Delivery khong o trang thai RETURN_TO_ORIGIN' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  async receiveRTO(@Param('id') id: string) {
    const result = await this.deliveryDispatch.receiveRTO(id);
    return BaseResponse.ok(result, 'Hang hoan da nhan tai kho VN');
  }

  @Post('deliveries/:id/rto/reschedule')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF, UserRole.SALE)
  @ApiOperation({
    summary: 'Len lich giao lai',
    description:
      'Len lich giao lai cho delivery da RTO. Tinh phi luu kho + tao extra charge + tao delivery moi.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID (delivery cu da RTO)' })
  @ApiResponse({ status: 200, description: 'Delivery moi da tao, phi luu kho da charge' })
  @ApiResponse({ status: 400, description: 'Delivery khong o trang thai RTO_RECEIVED hoac ngay khong hop le' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  async rescheduleDelivery(
    @Param('id') id: string,
    @Body() dto: RescheduleDeliveryDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.warehouseVNService.rescheduleDelivery(id, dto, user.id);
    return BaseResponse.ok(result, 'Da len lich giao lai');
  }
}
