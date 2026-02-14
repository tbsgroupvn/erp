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
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { CommissionService } from './commission.service';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import { CommissionDateRangeDto } from './dto/commission-query.dto';

@ApiTags('Commission')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('commissions')
export class CommissionController {
  constructor(private readonly commissionService: CommissionService) {}

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create commission rule', description: 'Creates a commission rule defining rate by service type and profit range.' })
  @ApiResponse({ status: 201, description: 'Rule created' })
  async createRule(@Body() dto: CreateCommissionRuleDto) {
    const rule = await this.commissionService.createRule(dto);
    return BaseResponse.ok(rule, 'Commission rule created');
  }

  @Get('rules')
  @ApiOperation({ summary: 'List commission rules', description: 'Lists all active commission rules.' })
  @ApiResponse({ status: 200, description: 'Rules retrieved' })
  async getRules() {
    const rules = await this.commissionService.getRules();
    return BaseResponse.ok(rules);
  }

  @Post('calculate/:orderId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate commission for order', description: 'Calculates commission for a completed order based on net profit and applicable rules.' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Commission calculated' })
  @ApiResponse({ status: 404, description: 'Order not found or no applicable rule' })
  async calculateCommission(@Param('orderId') orderId: string) {
    const result = await this.commissionService.calculateCommission(orderId);
    return BaseResponse.ok(result, result ? 'Commission calculated' : 'No applicable rule found');
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my commissions', description: 'Returns commission history for the current user.' })
  @ApiResponse({ status: 200, description: 'Commissions retrieved' })
  async getMyCommissions(
    @CurrentUser() user: ICurrentUser,
    @Query() dateRange: CommissionDateRangeDto,
  ) {
    const result = await this.commissionService.getMyCommissions(user.id, dateRange);
    return BaseResponse.ok(result);
  }

  @Get('team')
  @ApiOperation({ summary: 'Get team commissions', description: 'Returns commission summary for the leader and their team.' })
  @ApiResponse({ status: 200, description: 'Team commissions retrieved' })
  async getTeamCommissions(
    @CurrentUser() user: ICurrentUser,
    @Query() dateRange: CommissionDateRangeDto,
  ) {
    const result = await this.commissionService.getTeamCommissions(user.id, dateRange);
    return BaseResponse.ok(result);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve commission', description: 'KT TH approves a pending commission record.' })
  @ApiParam({ name: 'id', description: 'Commission record ID' })
  @ApiResponse({ status: 200, description: 'Commission approved' })
  @ApiResponse({ status: 400, description: 'Invalid status' })
  async approveCommission(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.commissionService.approveCommission(id, user.id);
    return BaseResponse.ok(result, 'Commission approved');
  }

  @Get('report/monthly')
  @ApiOperation({ summary: 'Monthly commission report', description: 'Returns monthly commission report with summary.' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @ApiResponse({ status: 200, description: 'Monthly report retrieved' })
  async getMonthlyReport(
    @Query('year') year: number,
    @Query('month') month: number,
  ) {
    const report = await this.commissionService.getMonthlyReport(+year, +month);
    return BaseResponse.ok(report);
  }
}
