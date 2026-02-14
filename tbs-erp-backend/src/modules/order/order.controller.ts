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
} from '@nestjs/swagger';
import { OrderStatus, MHHIssueStatus } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { DataScopeGuard, DataScopeFilter } from '@common/guards/data-scope.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { DataScope } from '@common/decorators/data-scope.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { OrderService } from './order.service';
import { MHHPriceCalculatorService } from './domain/mhh-price-calculator.service';
import { MHHIssueService } from './domain/mhh-issue.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { ChangeStatusDto, CancelOrderDto } from './dto/change-status.dto';
import { CalculateMHHPriceDto } from './dto/calculate-mhh-price.dto';
import { CreateMHHIssueDto } from './dto/create-mhh-issue.dto';
import { ResolveMHHIssueDto } from './dto/resolve-mhh-issue.dto';
import { CreditCheckGuard } from './guards/credit-check.guard';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard)
@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly mhhPriceCalculator: MHHPriceCalculatorService,
    private readonly mhhIssueService: MHHIssueService,
  ) {}

  @Post()
  @UseGuards(CreditCheckGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new order',
    description:
      'Creates a new order with items. Calculates deposit based on customer tier and service type. Validates customer credit limit and overdue debt.',
  })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Credit check failed - customer has overdue debt or insufficient credit limit' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const order = await this.orderService.createOrder(dto, user);
    return BaseResponse.ok(order, 'Order created successfully');
  }

  @Get()
  @ApiOperation({
    summary: 'List orders',
    description:
      'Returns paginated orders with filtering by status, service type, customer, sale, and date range. Data scope is applied based on user role.',
  })
  @ApiPaginated()
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  async findAll(
    @Query() query: OrderQueryDto,
    @DataScope() dataScope: DataScopeFilter | undefined,
  ) {
    const result = await this.orderService.findAll(query, dataScope);
    return PaginatedResponse.paginate(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get order detail',
    description:
      'Returns full order details including customer, items, status history, and packages.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findById(
    @Param('id') id: string,
    @DataScope() dataScope: DataScopeFilter | undefined,
  ) {
    const order = await this.orderService.findById(id, dataScope);
    return BaseResponse.ok(order);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an order',
    description:
      'Updates order fields. Only allowed when the order is in CONSULTING or QUOTATION status.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order updated successfully' })
  @ApiResponse({ status: 400, description: 'Order cannot be edited in current status' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const order = await this.orderService.updateOrder(id, dto, user);
    return BaseResponse.ok(order, 'Order updated successfully');
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Change order status',
    description:
      'Transitions order to a new status. Validates FSM transition rules and deposit gate for MHH orders.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Status changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const order = await this.orderService.changeStatus(
      id,
      dto.status,
      user.id,
      dto.note,
    );
    return BaseResponse.ok(order, `Status changed to ${dto.status}`);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an order',
    description:
      'Cancels an order with a reason. High-value or in-progress orders require approval.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order cancelled or approval requested' })
  @ApiResponse({ status: 400, description: 'Order cannot be cancelled' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.orderService.cancelOrder(id, dto.reason, user.id);
    return BaseResponse.ok(result);
  }

  // ─── MHH Price Calculator ───

  @Post('calculate-mhh-price')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate MHH price',
    description:
      'Calculates the total MHH (Mua hàng hộ) price including service fee, domestic shipping, exchange rate, and estimated VN shipping.',
  })
  @ApiResponse({ status: 200, description: 'Price calculated successfully' })
  async calculateMHHPrice(@Body() dto: CalculateMHHPriceDto) {
    const result = await this.mhhPriceCalculator.calculatePrice({
      productPriceCNY: dto.productPriceCNY,
      quantity: dto.quantity,
      domesticShippingCNY: dto.domesticShippingCNY,
      estimatedWeightKg: dto.estimatedWeightKg,
      shippingRoute: dto.shippingRoute,
      customerTier: dto.customerTier,
    });
    return BaseResponse.ok(result, 'MHH price calculated');
  }

  // ─── MHH Issues ───

  @Post(':id/mhh-issues')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create MHH issue',
    description: 'Reports an issue with an MHH order item (out of stock, wrong item, damaged, etc.)',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 201, description: 'Issue created' })
  async createMHHIssue(
    @Param('id') id: string,
    @Body() dto: CreateMHHIssueDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const issue = await this.mhhIssueService.createIssue(
      { ...dto, orderId: id },
      user.id,
    );
    return BaseResponse.ok(issue, 'MHH issue created');
  }

  @Get(':id/mhh-issues')
  @ApiOperation({
    summary: 'List MHH issues for an order',
    description: 'Returns all MHH issues associated with this order.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Issues retrieved' })
  async listMHHIssues(@Param('id') orderId: string) {
    const issues = await this.mhhIssueService.findByOrderId(orderId);
    return BaseResponse.ok(issues);
  }

  @Patch('mhh-issues/:issueId/status')
  @ApiOperation({
    summary: 'Update MHH issue status',
    description: 'Changes the status of an MHH issue.',
  })
  @ApiParam({ name: 'issueId', description: 'MHH Issue ID' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  async updateMHHIssueStatus(
    @Param('issueId') issueId: string,
    @Body('status') status: MHHIssueStatus,
    @Body('note') note: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const issue = await this.mhhIssueService.updateStatus(issueId, status, user.id, note);
    return BaseResponse.ok(issue, `Issue status updated to ${status}`);
  }

  @Post('mhh-issues/:issueId/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve MHH issue',
    description: 'Resolves an MHH issue with a resolution type and optional compensation.',
  })
  @ApiParam({ name: 'issueId', description: 'MHH Issue ID' })
  @ApiResponse({ status: 200, description: 'Issue resolved' })
  async resolveMHHIssue(
    @Param('issueId') issueId: string,
    @Body() dto: ResolveMHHIssueDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const issue = await this.mhhIssueService.resolveIssue(
      issueId,
      {
        resolution: dto.resolution,
        resolutionNote: dto.resolutionNote,
        compensationAmount: dto.compensationAmount,
        compensationCurrency: dto.compensationCurrency,
      },
      user.id,
    );
    return BaseResponse.ok(issue, 'MHH issue resolved');
  }
}
