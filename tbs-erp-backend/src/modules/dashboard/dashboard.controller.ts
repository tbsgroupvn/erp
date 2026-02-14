import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { BaseResponse } from '@common/dto/base-response.dto';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@ApiTags('System - Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({
    summary:
      'Get overview: total orders, revenue, customers for period',
  })
  async getOverview(@Query() query: DashboardQueryDto) {
    const data = await this.dashboardService.getOverview(query);
    return BaseResponse.ok(data);
  }

  @Get('orders')
  @ApiOperation({
    summary:
      'Get order stats: by status, by service type, active/pending',
  })
  async getOrderStats(@Query() query: DashboardQueryDto) {
    const data = await this.dashboardService.getOrderStats(query);
    return BaseResponse.ok(data);
  }

  @Get('finance')
  @ApiOperation({
    summary:
      'Get finance stats: AR/AP totals, overdue, cash flow',
  })
  async getFinanceStats(@Query() query: DashboardQueryDto) {
    const data = await this.dashboardService.getFinanceStats(query);
    return BaseResponse.ok(data);
  }

  @Get('warehouse')
  @ApiOperation({
    summary:
      'Get warehouse stats: packages in transit, pending delivery, pipeline',
  })
  async getWarehouseStats(@Query() query: DashboardQueryDto) {
    const data = await this.dashboardService.getWarehouseStats(query);
    return BaseResponse.ok(data);
  }
}
