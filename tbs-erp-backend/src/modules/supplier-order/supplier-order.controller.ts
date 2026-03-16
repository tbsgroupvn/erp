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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { SupplierOrderService } from './supplier-order.service';
import { CreateSupplierOrderDto } from './dto/create-supplier-order.dto';
import { UpdateSupplierOrderDto } from './dto/update-supplier-order.dto';
import { SupplierOrderQueryDto } from './dto/supplier-order-query.dto';
import { ChangeSupplierOrderStatusDto } from './dto/change-supplier-order-status.dto';
import { RecordReceivedDto } from './dto/record-received.dto';
import { CloseShortfallDto } from './dto/close-shortfall.dto';
import { RecordSupplierRefundDto } from './dto/record-supplier-refund.dto';

@ApiTags('Supplier Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('supplier-orders')
export class SupplierOrderController {
  constructor(private readonly supplierOrderService: SupplierOrderService) {}

  @Post()
  @Roles(UserRole.XNK_MANAGER, UserRole.XNK_STAFF, UserRole.SALE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new supplier order',
    description:
      'Creates a new supplier order linked to a parent order. ' +
      'Auto-generates code in format SO-YYYYMM-XXXX. ' +
      'Allowed roles: XNK_MANAGER, XNK_STAFF, SALE.',
  })
  @ApiResponse({ status: 201, description: 'Supplier order created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Referenced order or order item not found' })
  async create(@Body() dto: CreateSupplierOrderDto, @CurrentUser() user: ICurrentUser) {
    const supplierOrder = await this.supplierOrderService.createSupplierOrder(dto, user.id);
    return BaseResponse.ok(supplierOrder, 'Supplier order created successfully');
  }

  @Get()
  @ApiOperation({
    summary: 'List supplier orders',
    description:
      'Returns paginated supplier orders with filtering by status, order ID, ' +
      'search term, and date range.',
  })
  @ApiPaginated()
  @ApiResponse({ status: 200, description: 'Supplier orders retrieved successfully' })
  async findAll(@Query() query: SupplierOrderQueryDto) {
    const result = await this.supplierOrderService.findAll(query);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Post('refund')
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.CFO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record a supplier refund',
    description:
      'Records a supplier refund in CNY, converts to VND, credits customer wallet, ' +
      'and triggers auto-clear of outstanding ARs.',
  })
  @ApiResponse({ status: 200, description: 'Supplier refund recorded successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Supplier order or order not found' })
  async recordSupplierRefund(
    @Body() dto: RecordSupplierRefundDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.supplierOrderService.recordSupplierRefund(dto, user.id);
    return BaseResponse.ok(result, 'Supplier refund recorded successfully');
  }

  /**
   * Static routes must be defined before parameterized routes
   * to prevent NestJS from matching "order" as an :id parameter.
   */
  @Get('order/:orderId')
  @ApiOperation({
    summary: 'Get supplier orders by order ID',
    description: 'Returns all supplier orders linked to a specific parent order.',
  })
  @ApiParam({ name: 'orderId', description: 'Parent order ID' })
  @ApiResponse({ status: 200, description: 'Supplier orders retrieved successfully' })
  async findByOrderId(@Param('orderId') orderId: string) {
    const result = await this.supplierOrderService.findByOrderId(orderId);
    return BaseResponse.ok(result);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get supplier order detail',
    description: 'Returns full supplier order details including related order and order item.',
  })
  @ApiParam({ name: 'id', description: 'Supplier order ID' })
  @ApiResponse({ status: 200, description: 'Supplier order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Supplier order not found' })
  async findById(@Param('id') id: string) {
    const supplierOrder = await this.supplierOrderService.findById(id);
    return BaseResponse.ok(supplierOrder);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a supplier order',
    description:
      'Updates supplier order fields. Only allowed when the order is in DRAFT or QUOTED status.',
  })
  @ApiParam({ name: 'id', description: 'Supplier order ID' })
  @ApiResponse({ status: 200, description: 'Supplier order updated successfully' })
  @ApiResponse({ status: 400, description: 'Supplier order cannot be edited in current status' })
  @ApiResponse({ status: 404, description: 'Supplier order not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierOrderDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const supplierOrder = await this.supplierOrderService.updateSupplierOrder(id, dto, user.id);
    return BaseResponse.ok(supplierOrder, 'Supplier order updated successfully');
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Change supplier order status',
    description:
      'Transitions a supplier order to a new status. ' +
      'Validates FSM transition rules and updates relevant timestamps.',
  })
  @ApiParam({ name: 'id', description: 'Supplier order ID' })
  @ApiResponse({ status: 200, description: 'Status changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Supplier order not found' })
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeSupplierOrderStatusDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const supplierOrder = await this.supplierOrderService.changeStatus(
      id,
      dto.status,
      user.id,
      dto.note,
    );
    return BaseResponse.ok(supplierOrder, `Status changed to ${dto.status}`);
  }

  @Post(':id/close-shortfall')
  @Roles(UserRole.XNK_MANAGER, UserRole.XNK_STAFF, UserRole.CHIEF_ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Close shortfall on a partially-shipped supplier order',
    description:
      'Closes the shortfall when the supplier cannot deliver the remaining quantity. ' +
      'Transitions status to RECEIVED_CN, records refund amount, and auto-credits customer wallet.',
  })
  @ApiParam({ name: 'id', description: 'Supplier order ID' })
  @ApiResponse({ status: 200, description: 'Shortfall closed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status or no shortfall' })
  @ApiResponse({ status: 404, description: 'Supplier order not found' })
  async closeShortfall(
    @Param('id') id: string,
    @Body() dto: CloseShortfallDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.supplierOrderService.closeShortfall(id, dto, user.id);
    return BaseResponse.ok(result, 'Shortfall closed successfully');
  }

  @Post(':id/received')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record goods received at CN warehouse',
    description:
      'Records that goods from this supplier order have been received at the CN warehouse. ' +
      'Updates quantity received, actual price, and transitions status to RECEIVED_CN.',
  })
  @ApiParam({ name: 'id', description: 'Supplier order ID' })
  @ApiResponse({ status: 200, description: 'Receipt recorded successfully' })
  @ApiResponse({ status: 400, description: 'Cannot record receipt in current status' })
  @ApiResponse({ status: 404, description: 'Supplier order not found' })
  async recordReceived(
    @Param('id') id: string,
    @Body() dto: RecordReceivedDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.supplierOrderService.recordReceived(id, dto, user.id);
    return BaseResponse.ok(result, 'Goods receipt recorded successfully');
  }
}
