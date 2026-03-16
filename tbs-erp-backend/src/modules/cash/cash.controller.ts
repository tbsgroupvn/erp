import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { DataScopeGuard } from '@common/guards/data-scope.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { CashService } from './cash.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { VoucherQueryDto } from './dto/voucher-query.dto';

@ApiTags('Finance - Cash & Vouchers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard)
@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Post('vouchers')
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.CFO)
  @ApiOperation({
    summary: 'Create a payment or receipt voucher (with anti-fraud validation)',
  })
  async createVoucher(@Body() dto: CreateVoucherDto, @CurrentUser('id') userId: string) {
    const result = await this.cashService.createVoucher(dto, userId);
    return BaseResponse.ok(result, 'Voucher created successfully');
  }

  @Get('vouchers')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'List vouchers with pagination and filters' })
  @ApiPaginated()
  async findAll(@Query() query: VoucherQueryDto) {
    return this.cashService.findAll(query);
  }

  @Patch('vouchers/:id/approve')
  @Roles(UserRole.CFO, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Approve a voucher' })
  @ApiParam({ name: 'id', description: 'Voucher ID' })
  async approve(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const voucher = await this.cashService.approveVoucher(id, userId);
    return BaseResponse.ok(voucher, 'Voucher approved successfully');
  }

  @Patch('vouchers/:id/reject')
  @Roles(UserRole.CFO, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Reject a voucher' })
  @ApiParam({ name: 'id', description: 'Voucher ID' })
  async reject(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { reason?: string },
  ) {
    const voucher = await this.cashService.rejectVoucher(id, userId, body.reason);
    return BaseResponse.ok(voucher, 'Voucher rejected');
  }

  @Get('flow-status')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT)
  @ApiOperation({
    summary: 'Get system-wide cash flow status (deposits vs supplier payments)',
  })
  async getFlowStatus() {
    const status = await this.cashService.getFlowStatus();
    return BaseResponse.ok(status);
  }

  @Get('flow-status/by-order/:orderId')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT_AR,
    UserRole.SALE,
  )
  @ApiOperation({ summary: 'Get per-order cash flow status' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  async getOrderFlowStatus(@Param('orderId') orderId: string) {
    const status = await this.cashService.getOrderFlowStatus(orderId);
    return BaseResponse.ok(status);
  }

  @Get('exchange-rate-variance')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT)
  @ApiOperation({
    summary: 'Get exchange rate variance report for foreign currency PAYMENT vouchers',
  })
  async getExchangeRateVariance(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.cashService.getExchangeRateVariance(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return BaseResponse.ok(result);
  }

  @Get('flow')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Get cash flow summary' })
  async getCashFlow(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    const flow = await this.cashService.getCashFlow(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return BaseResponse.ok(flow);
  }
}
