import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { AccountsReceivableService } from './accounts-receivable.service';
import { CreateArDto } from './dto/create-ar.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { ArQueryDto } from './dto/ar-query.dto';

@ApiTags('Finance - Accounts Receivable')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ar')
export class AccountsReceivableController {
  constructor(private readonly arService: AccountsReceivableService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new accounts receivable record' })
  async create(
    @Body() dto: CreateArDto,
    @CurrentUser('id') userId: string,
  ) {
    const ar = await this.arService.createReceivable(dto, userId);
    return BaseResponse.ok(ar, 'Accounts receivable created successfully');
  }

  @Get()
  @ApiOperation({ summary: 'List accounts receivable with pagination' })
  @ApiPaginated()
  async findAll(@Query() query: ArQueryDto) {
    return this.arService.findAll(query);
  }

  @Get('overdue')
  @ApiOperation({ summary: 'Get all overdue receivables' })
  async getOverdue() {
    const list = await this.arService.getOverdueList();
    return BaseResponse.ok(list);
  }

  @Get('aging')
  @ApiOperation({ summary: 'Get AR aging report' })
  async getAgingReport() {
    const report = await this.arService.getAgingReport();
    return BaseResponse.ok(report);
  }

  @Get('aging/summary')
  @ApiOperation({ summary: 'Get company-wide aging summary' })
  async getAgingSummary(@Query('date') date?: string) {
    const summary = await this.arService.getAgingSummary(date);
    return BaseResponse.ok(summary);
  }

  @Get('aging/trends')
  @ApiOperation({ summary: 'Get historical aging trends (last N days)' })
  async getAgingTrends(@Query('days') days?: number) {
    const trends = await this.arService.getAgingTrends(days ? +days : 30);
    return BaseResponse.ok(trends);
  }

  @Get('aging/high-risk')
  @ApiOperation({ summary: 'Get list of high-risk customers' })
  async getHighRiskCustomers() {
    const customers = await this.arService.getHighRiskCustomers();
    return BaseResponse.ok(customers);
  }

  @Get('aging/customer/:customerId')
  @ApiOperation({ summary: 'Get current aging for a specific customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  async getCustomerAging(@Param('customerId') customerId: string) {
    const aging = await this.arService.getCustomerAging(customerId);
    return BaseResponse.ok(aging);
  }

  @Get('aging/customer/:customerId/trend')
  @ApiOperation({ summary: 'Get aging trend for a customer (last 30 days)' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  async getCustomerAgingTrend(
    @Param('customerId') customerId: string,
    @Query('days') days?: number,
  ) {
    const trend = await this.arService.getCustomerAgingTrend(
      customerId,
      days ? +days : undefined,
    );
    return BaseResponse.ok(trend);
  }

  @Get('by-customer/:customerId')
  @ApiOperation({ summary: 'Get all receivables and debt for a customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  async getByCustomer(@Param('customerId') customerId: string) {
    const data = await this.arService.getCustomerDebt(customerId);
    return BaseResponse.ok(data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single AR record by ID' })
  @ApiParam({ name: 'id', description: 'AR record ID' })
  async findOne(@Param('id') id: string) {
    const ar = await this.arService.findById(id);
    return BaseResponse.ok(ar);
  }

  @Patch(':id/payment')
  @ApiOperation({ summary: 'Record a payment against an AR record' })
  @ApiParam({ name: 'id', description: 'AR record ID' })
  async recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    const ar = await this.arService.recordPayment(id, dto);
    return BaseResponse.ok(ar, 'Payment recorded successfully');
  }
}
