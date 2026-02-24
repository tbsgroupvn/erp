import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@ApiTags('System - Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.SALES_DIRECTOR, UserRole.XNK_MANAGER)
  @ApiOperation({
    summary:
      'Get overview: total orders, revenue, customers for period',
  })
  @ApiOkResponse({ description: 'Dashboard overview data including total orders, revenue, and new customers', type: BaseResponse })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden - requires CEO, COO, Sales Director, or XNK Manager role' })
  async getOverview(@Query() query: DashboardQueryDto) {
    const data = await this.dashboardService.getOverview(query);
    return BaseResponse.ok(data);
  }

  @Get('orders')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE)
  @ApiOperation({
    summary:
      'Get order stats: by status, by service type, active/pending',
  })
  @ApiOkResponse({ description: 'Order statistics breakdown by status and service type', type: BaseResponse })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden - requires CEO, COO, Sales Director, Sales Leader, or Sale role' })
  async getOrderStats(@Query() query: DashboardQueryDto) {
    const data = await this.dashboardService.getOrderStats(query);
    return BaseResponse.ok(data);
  }

  @Get('finance')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.ACCOUNTANT_COST)
  @ApiOperation({
    summary:
      'Get finance stats: AR/AP totals, overdue, cash flow',
  })
  @ApiOkResponse({ description: 'Finance statistics including AR/AP outstanding, overdue amounts, and cash flow', type: BaseResponse })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden - requires CEO, COO, Chief Accountant, AR Accountant, or Cost Accountant role' })
  async getFinanceStats(@Query() query: DashboardQueryDto) {
    const data = await this.dashboardService.getFinanceStats(query);
    return BaseResponse.ok(data);
  }

  @Get('warehouse')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF, UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER)
  @ApiOperation({
    summary:
      'Get warehouse stats: packages in transit, pending delivery, pipeline',
  })
  @ApiOkResponse({ description: 'Warehouse statistics including pipeline counts across CN and VN warehouses', type: BaseResponse })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden - requires CEO, COO, Warehouse Manager/Staff, CN Agent, or XNK Manager role' })
  async getWarehouseStats(@Query() query: DashboardQueryDto) {
    const data = await this.dashboardService.getWarehouseStats(query);
    return BaseResponse.ok(data);
  }

  @Get('hr')
  @Roles(UserRole.CEO, UserRole.COO)
  @ApiOperation({
    summary:
      'Get HR stats: headcount, by department, new hires, resignations',
  })
  @ApiOkResponse({ description: 'HR statistics including headcount, department breakdown, new hires, and resignations', type: BaseResponse })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden - requires CEO or COO role' })
  async getHRStats(@Query() query: DashboardQueryDto) {
    const data = await this.dashboardService.getHRStats(query);
    return BaseResponse.ok(data);
  }
}
