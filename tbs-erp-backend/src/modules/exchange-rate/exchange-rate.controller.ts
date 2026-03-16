import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Currency, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { ExchangeRateService } from './exchange-rate.service';
import { SetRateDto } from './dto/set-rate.dto';
import { ConvertDto } from './dto/convert.dto';

@ApiTags('Exchange Rate')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('exchange-rates')
export class ExchangeRateController {
  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  @Post()
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Set exchange rate',
    description: 'Manually set an exchange rate for a currency pair and date.',
  })
  @ApiResponse({ status: 201, description: 'Rate set successfully' })
  async setRate(@Body() dto: SetRateDto, @CurrentUser('id') userId: string) {
    const rate = await this.exchangeRateService.setRate(dto, userId);
    return BaseResponse.ok(rate, 'Exchange rate set successfully');
  }

  @Get('current')
  @ApiOperation({
    summary: 'Get current rate',
    description: 'Returns the latest effective rate for a currency pair.',
  })
  @ApiQuery({ name: 'from', enum: Currency, required: true })
  @ApiQuery({ name: 'to', enum: Currency, required: true })
  @ApiResponse({ status: 200, description: 'Current rate retrieved' })
  @ApiResponse({ status: 404, description: 'Rate not found' })
  async getCurrentRate(@Query('from') from: Currency, @Query('to') to: Currency) {
    const rate = await this.exchangeRateService.getCurrentRate(from, to);
    return BaseResponse.ok(rate);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get historical rates',
    description: 'Returns rate history for a currency pair within a date range.',
  })
  @ApiQuery({ name: 'from', enum: Currency, required: true })
  @ApiQuery({ name: 'to', enum: Currency, required: true })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'Historical rates retrieved' })
  async getHistoricalRates(
    @Query('from') from: Currency,
    @Query('to') to: Currency,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const rates = await this.exchangeRateService.getHistoricalRates(from, to, startDate, endDate);
    return BaseResponse.ok(rates);
  }

  @Post('convert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Convert amount',
    description:
      'Converts an amount between currencies using the rate on a given date (or latest).',
  })
  @ApiResponse({ status: 200, description: 'Conversion result' })
  @ApiResponse({ status: 404, description: 'Rate not found for conversion' })
  async convert(@Body() dto: ConvertDto) {
    const result = await this.exchangeRateService.convert(dto);
    return BaseResponse.ok(result);
  }

  @Post('sync/vietcombank')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync from Vietcombank',
    description: 'Fetches USD/VND rates from Vietcombank API. CNY rates must be set manually.',
  })
  @ApiResponse({ status: 200, description: 'Sync result' })
  @ApiResponse({ status: 403, description: 'CNY rate cannot be synced automatically' })
  async syncFromVietcombank() {
    const result = await this.exchangeRateService.syncFromVietcombank();
    return BaseResponse.ok(result);
  }

  @Get('active')
  @ApiOperation({
    summary: 'Get all active rates',
    description: 'Returns the latest rate for each currency pair.',
  })
  @ApiResponse({ status: 200, description: 'Active rates retrieved' })
  async getActiveRates() {
    const rates = await this.exchangeRateService.getActiveRates();
    return BaseResponse.ok(rates);
  }

  @Get('audit-trail')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT)
  @ApiOperation({
    summary: 'Get exchange rate audit trail',
    description: 'Returns audit log entries for exchange rate changes within a date range.',
  })
  @ApiQuery({ name: 'from', required: true, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: true, description: 'End date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Audit trail retrieved' })
  async getAuditTrail(@Query('from') from: string, @Query('to') to: string) {
    const trail = await this.exchangeRateService.getAuditTrail(from, to);
    return BaseResponse.ok(trail);
  }
}
