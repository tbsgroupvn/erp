import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AccountsReceivableService } from './accounts-receivable.service';
import { AutoClearArService } from './auto-clear-ar.service';
import { CreateArDto } from './dto/create-ar.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { ArQueryDto } from './dto/ar-query.dto';

@ApiTags('Finance - Accounts Receivable')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ar')
export class AccountsReceivableController {
  constructor(
    private readonly arService: AccountsReceivableService,
    private readonly autoClearService: AutoClearArService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post()
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.CFO)
  @ApiOperation({ summary: 'Create a new accounts receivable record' })
  async create(@Body() dto: CreateArDto, @CurrentUser('id') userId: string) {
    const ar = await this.arService.createReceivable(dto, userId);
    return BaseResponse.ok(ar, 'Accounts receivable created successfully');
  }

  @Post('auto-clear/:customerId')
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.CFO)
  @ApiOperation({
    summary: 'Manual trigger: auto-clear ARs from customer wallet',
    description:
      'Deducts from the customer wallet to pay off outstanding ARs (oldest due first). ' +
      'Use when AR was not auto-cleared or for manual reconciliation.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  async autoClear(@Param('customerId') customerId: string) {
    const result = await this.autoClearService.autoClear(customerId, 'Manual trigger');

    // Emit ar.payment.recorded for each cleared AR
    for (const record of result.clearedRecords) {
      this.eventEmitter.emit('ar.payment.recorded', {
        arId: record.arId,
        customerId,
        paymentAmount: record.paymentAmount,
        isFullyPaid: record.isFullyPaid,
        reference: 'auto-clear:Manual trigger',
      });
    }

    if (result.clearedRecords.length > 0) {
      this.eventEmitter.emit('ar.auto-clear.completed', {
        customerId,
        totalCleared: result.totalCleared,
        clearedCount: result.clearedRecords.length,
        walletBalanceAfter: result.walletBalanceAfter,
        triggerSource: 'Manual trigger',
        clearedRecords: result.clearedRecords,
      });
    }

    return BaseResponse.ok(result, `Auto-clear completed: ${result.totalCleared} VND across ${result.clearedRecords.length} ARs`);
  }

  @Get()
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.SALES_DIRECTOR)
  @ApiOperation({ summary: 'List accounts receivable with pagination' })
  @ApiPaginated()
  async findAll(@Query() query: ArQueryDto) {
    return this.arService.findAll(query);
  }

  @Get('overdue')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.SALES_DIRECTOR)
  @ApiOperation({ summary: 'Get all overdue receivables' })
  async getOverdue() {
    const list = await this.arService.getOverdueList();
    return BaseResponse.ok(list);
  }

  @Get('aging')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.SALES_DIRECTOR)
  @ApiOperation({ summary: 'Get AR aging report' })
  async getAgingReport() {
    const report = await this.arService.getAgingReport();
    return BaseResponse.ok(report);
  }

  @Get('aging/summary')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.SALES_DIRECTOR)
  @ApiOperation({ summary: 'Get company-wide aging summary' })
  async getAgingSummary(@Query('date') date?: string) {
    const summary = await this.arService.getAgingSummary(date);
    return BaseResponse.ok(summary);
  }

  @Get('aging/trends')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.SALES_DIRECTOR)
  @ApiOperation({ summary: 'Get historical aging trends (last N days)' })
  async getAgingTrends(@Query('days') days?: number) {
    const trends = await this.arService.getAgingTrends(days ? +days : 30);
    return BaseResponse.ok(trends);
  }

  @Get('aging/high-risk')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.SALES_DIRECTOR)
  @ApiOperation({ summary: 'Get list of high-risk customers' })
  async getHighRiskCustomers() {
    const customers = await this.arService.getHighRiskCustomers();
    return BaseResponse.ok(customers);
  }

  @Get('aging/customer/:customerId')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.SALES_DIRECTOR)
  @ApiOperation({ summary: 'Get current aging for a specific customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  async getCustomerAging(@Param('customerId') customerId: string) {
    const aging = await this.arService.getCustomerAging(customerId);
    return BaseResponse.ok(aging);
  }

  @Get('aging/customer/:customerId/trend')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.SALES_DIRECTOR)
  @ApiOperation({ summary: 'Get aging trend for a customer (last 30 days)' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  async getCustomerAgingTrend(
    @Param('customerId') customerId: string,
    @Query('days') days?: number,
  ) {
    const trend = await this.arService.getCustomerAgingTrend(customerId, days ? +days : undefined);
    return BaseResponse.ok(trend);
  }

  @Get('customer-summary')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.SALES_DIRECTOR)
  @ApiOperation({
    summary: 'Get outstanding debt grouped by customer',
    description:
      'Returns all customers with OPEN or PARTIAL AR records. ' +
      'Each entry includes total debt, overdue debt, AR count, and oldest due date. ' +
      'Sorted by totalDebt descending.',
  })
  async getCustomerSummary() {
    const data = await this.arService.getCustomerSummary();
    return BaseResponse.ok(data);
  }

  @Get('by-customer/:customerId')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.SALES_DIRECTOR)
  @ApiOperation({ summary: 'Get all receivables and debt for a customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  async getByCustomer(@Param('customerId') customerId: string) {
    const data = await this.arService.getCustomerDebt(customerId);
    return BaseResponse.ok(data);
  }

  @Get(':id')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.SALES_DIRECTOR)
  @ApiOperation({ summary: 'Get a single AR record by ID' })
  @ApiParam({ name: 'id', description: 'AR record ID' })
  async findOne(@Param('id') id: string) {
    const ar = await this.arService.findById(id);
    return BaseResponse.ok(ar);
  }

  @Patch(':id/payment')
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.CFO)
  @ApiOperation({ summary: 'Record a payment against an AR record' })
  @ApiParam({ name: 'id', description: 'AR record ID' })
  async recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto) {
    const ar = await this.arService.recordPayment(id, dto);
    return BaseResponse.ok(ar, 'Payment recorded successfully');
  }
}
