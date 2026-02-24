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
import { OrderStatus } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { DataScopeGuard, DataScopeFilter } from '@common/guards/data-scope.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { DataScope } from '@common/decorators/data-scope.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { OrderService } from './order.service';
import { OrderReadService } from './order-read.service';
import { DepositGateService } from './domain/deposit-gate.service';
import { ThreeWayMatchingService } from './domain/three-way-matching.service';
import { MHHPriceCalculatorService } from './domain/mhh-price-calculator.service';
import { MHHIssueService } from './domain/mhh-issue.service';
import { ExtraChargeService, AddExtraChargeDto } from './domain/extra-charge.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { ChangeStatusDto, CancelOrderDto } from './dto/change-status.dto';
import { CalculateMHHPriceDto } from './dto/calculate-mhh-price.dto';
import { CreateMHHIssueDto } from './dto/create-mhh-issue.dto';
import { ResolveMHHIssueDto } from './dto/resolve-mhh-issue.dto';
import { UpdateMHHIssueStatusDto } from './dto/update-mhh-issue-status.dto';
import { AssignMHHIssueDto } from './dto/assign-mhh-issue.dto';
import { RecordCustomerDecisionDto } from './dto/record-customer-decision.dto';
import { CreditCheckGuard } from './guards/credit-check.guard';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard)
@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderReadService: OrderReadService,
    private readonly depositGateService: DepositGateService,
    private readonly threeWayMatchingService: ThreeWayMatchingService,
    private readonly mhhPriceCalculator: MHHPriceCalculatorService,
    private readonly mhhIssueService: MHHIssueService,
    private readonly extraChargeService: ExtraChargeService,
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

  @Get(':id/procurement-gate')
  @ApiOperation({
    summary: 'Get procurement gate status',
    description:
      'Returns the deposit gate status for procurement. Orders require at least 70% deposit to create supplier orders. ' +
      'Orders with 100% deposit get priority treatment.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Procurement gate status retrieved' })
  async getProcurementGate(@Param('id') id: string) {
    const status = await this.depositGateService.getProcurementGateStatus(id);
    return BaseResponse.ok(status);
  }

  @Get(':id/three-way-match')
  @ApiOperation({
    summary: 'Get 3-way matching report',
    description:
      'Returns the PO ↔ GR ↔ Invoice matching report. ' +
      'Compares quantity ordered vs received and total quoted vs paid with 5% tolerance.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: '3-way matching report retrieved' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getThreeWayMatch(@Param('id') id: string) {
    const report = await this.threeWayMatchingService.getMatchingReport(id);
    return BaseResponse.ok(report);
  }

  @Get(':id/360')
  @ApiOperation({
    summary: 'Get order 360 view',
    description:
      'Returns comprehensive order overview with all related data structured into blocks: ' +
      'sale, goods, finance, operations, and audit log.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order 360 view retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrder360View(@Param('id') id: string) {
    const view = await this.orderReadService.getOrder360View(id);
    return BaseResponse.ok(view);
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

  @Get('mhh-issues/:issueId')
  @ApiOperation({
    summary: 'Get MHH issue detail',
    description: 'Returns full details of a single MHH issue by ID.',
  })
  @ApiParam({ name: 'issueId', description: 'MHH Issue ID' })
  @ApiResponse({ status: 200, description: 'Issue retrieved' })
  @ApiResponse({ status: 404, description: 'MHH issue not found' })
  async getMHHIssue(@Param('issueId') issueId: string) {
    const issue = await this.mhhIssueService.findById(issueId);
    return BaseResponse.ok(issue);
  }

  @Patch('mhh-issues/:issueId/status')
  @ApiOperation({
    summary: 'Update MHH issue status',
    description:
      'Changes the status of an MHH issue. Validates allowed transitions based on the FSM.',
  })
  @ApiParam({ name: 'issueId', description: 'MHH Issue ID' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'MHH issue not found' })
  async updateMHHIssueStatus(
    @Param('issueId') issueId: string,
    @Body() dto: UpdateMHHIssueStatusDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const issue = await this.mhhIssueService.updateStatus(issueId, dto.status, user.id, dto.note);
    return BaseResponse.ok(issue, `Issue status updated to ${dto.status}`);
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

  @Patch('mhh-issues/:issueId/assign')
  @ApiOperation({
    summary: 'Assign handler to MHH issue',
    description:
      'Assigns a user as the handler for an MHH issue. Cannot assign to closed issues.',
  })
  @ApiParam({ name: 'issueId', description: 'MHH Issue ID' })
  @ApiResponse({ status: 200, description: 'Handler assigned successfully' })
  @ApiResponse({ status: 400, description: 'Cannot assign handler to closed issue' })
  @ApiResponse({ status: 404, description: 'MHH issue not found' })
  async assignMHHIssueHandler(
    @Param('issueId') issueId: string,
    @Body() dto: AssignMHHIssueDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const issue = await this.mhhIssueService.assignHandler(
      issueId,
      dto.handlerId,
      user.id,
    );
    return BaseResponse.ok(issue, 'Handler assigned successfully');
  }

  @Post('mhh-issues/:issueId/customer-decision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record customer decision on MHH issue',
    description:
      'Records the customer decision (KEEP, RETURN, EXCHANGE) on an MHH issue. ' +
      'Cannot record on closed or resolved issues.',
  })
  @ApiParam({ name: 'issueId', description: 'MHH Issue ID' })
  @ApiResponse({ status: 200, description: 'Customer decision recorded' })
  @ApiResponse({ status: 400, description: 'Cannot record decision on closed/resolved issue' })
  @ApiResponse({ status: 404, description: 'MHH issue not found' })
  async recordMHHIssueCustomerDecision(
    @Param('issueId') issueId: string,
    @Body() dto: RecordCustomerDecisionDto,
  ) {
    const issue = await this.mhhIssueService.recordCustomerDecision(
      issueId,
      dto.decision,
      dto.customerNote,
    );
    return BaseResponse.ok(issue, 'Customer decision recorded');
  }

  // ─── Extra Charges (B8) ───

  @Post(':id/extra-charges')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add extra charge to order',
    description:
      'Adds an extra charge (phu phi phat sinh) to an order. Sets order status to ON_HOLD until approved.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 201, description: 'Extra charge added' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async addExtraCharge(
    @Param('id') id: string,
    @Body() dto: AddExtraChargeDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const charge = await this.extraChargeService.addExtraCharge(
      id,
      dto,
      user.id,
    );
    return BaseResponse.ok(charge, 'Extra charge added to order');
  }

  @Patch('extra-charges/:chargeId/approve')
  @ApiOperation({
    summary: 'Approve extra charge',
    description:
      'Approves an extra charge, adding it to the order total and removing ON_HOLD status.',
  })
  @ApiParam({ name: 'chargeId', description: 'Extra Charge ID' })
  @ApiResponse({ status: 200, description: 'Extra charge approved' })
  @ApiResponse({ status: 400, description: 'Charge is not PENDING' })
  @ApiResponse({ status: 404, description: 'Extra charge not found' })
  async approveExtraCharge(
    @Param('chargeId') chargeId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const charge = await this.extraChargeService.approveExtraCharge(
      chargeId,
      user.id,
    );
    return BaseResponse.ok(charge, 'Extra charge approved');
  }

  @Patch('extra-charges/:chargeId/reject')
  @ApiOperation({
    summary: 'Reject extra charge',
    description:
      'Rejects an extra charge and removes ON_HOLD status from the order.',
  })
  @ApiParam({ name: 'chargeId', description: 'Extra Charge ID' })
  @ApiResponse({ status: 200, description: 'Extra charge rejected' })
  @ApiResponse({ status: 400, description: 'Charge is not PENDING' })
  @ApiResponse({ status: 404, description: 'Extra charge not found' })
  async rejectExtraCharge(
    @Param('chargeId') chargeId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const charge = await this.extraChargeService.rejectExtraCharge(
      chargeId,
      user.id,
    );
    return BaseResponse.ok(charge, 'Extra charge rejected');
  }

  @Get(':id/extra-charges')
  @ApiOperation({
    summary: 'List extra charges for order',
    description: 'Returns all extra charges (phu phi phat sinh) for an order.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Extra charges retrieved' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getExtraCharges(@Param('id') id: string) {
    const charges = await this.extraChargeService.getExtraCharges(id);
    return BaseResponse.ok(charges);
  }
}
