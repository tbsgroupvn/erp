import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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
import { SalesDashboardService } from './sales-dashboard.service';
import { AnalyticsService } from './analytics.service';
import { ReportsService } from './reports.service';
import { MetricSnapshotService } from './metric-snapshot.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { MetricHistoryQueryDto } from './dto/metric-history.dto';
import { DrillDownQueryDto } from './dto/drill-down.dto';

@ApiTags('System - Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly salesDashboardService: SalesDashboardService,
    private readonly analyticsService: AnalyticsService,
    private readonly reportsService: ReportsService,
    private readonly metricSnapshotService: MetricSnapshotService,
  ) {}

  @Get('overview')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.SALES_DIRECTOR, UserRole.XNK_MANAGER)
  @ApiOperation({
    summary: 'Get overview: total orders, revenue, customers for period',
  })
  @ApiOkResponse({
    description: 'Dashboard overview data including total orders, revenue, and new customers',
    type: BaseResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token' })
  @ApiForbiddenResponse({
    description: 'Forbidden - requires CEO, COO, Sales Director, or XNK Manager role',
  })
  async getOverview(@Query() query: DashboardQueryDto) {
    const data = await this.dashboardService.getOverview(query);
    return BaseResponse.ok(data);
  }

  @Get('orders')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE)
  @ApiOperation({
    summary: 'Get order stats: by status, by service type, active/pending',
  })
  @ApiOkResponse({
    description: 'Order statistics breakdown by status and service type',
    type: BaseResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token' })
  @ApiForbiddenResponse({
    description: 'Forbidden - requires CEO, COO, Sales Director, Sales Leader, or Sale role',
  })
  async getOrderStats(@Query() query: DashboardQueryDto) {
    const data = await this.dashboardService.getOrderStats(query);
    return BaseResponse.ok(data);
  }

  @Get('finance')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT_AR,
    UserRole.ACCOUNTANT_COST,
  )
  @ApiOperation({
    summary: 'Get finance stats: AR/AP totals, overdue, cash flow',
  })
  @ApiOkResponse({
    description: 'Finance statistics including AR/AP outstanding, overdue amounts, and cash flow',
    type: BaseResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token' })
  @ApiForbiddenResponse({
    description:
      'Forbidden - requires CEO, COO, Chief Accountant, AR Accountant, or Cost Accountant role',
  })
  async getFinanceStats(@Query() query: DashboardQueryDto) {
    const data = await this.dashboardService.getFinanceStats(query);
    return BaseResponse.ok(data);
  }

  @Get('warehouse')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.WAREHOUSE_VN_MANAGER,
    UserRole.WAREHOUSE_VN_STAFF,
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.XNK_MANAGER,
  )
  @ApiOperation({
    summary: 'Get warehouse stats: packages in transit, pending delivery, pipeline',
  })
  @ApiOkResponse({
    description: 'Warehouse statistics including pipeline counts across CN and VN warehouses',
    type: BaseResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token' })
  @ApiForbiddenResponse({
    description:
      'Forbidden - requires CEO, COO, Warehouse Manager/Staff, CN Agent, or XNK Manager role',
  })
  async getWarehouseStats(@Query() query: DashboardQueryDto) {
    const data = await this.dashboardService.getWarehouseStats(query);
    return BaseResponse.ok(data);
  }

  @Get('hr')
  @Roles(UserRole.CEO, UserRole.COO)
  @ApiOperation({
    summary: 'Get HR stats: headcount, by department, new hires, resignations',
  })
  @ApiOkResponse({
    description:
      'HR statistics including headcount, department breakdown, new hires, and resignations',
    type: BaseResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden - requires CEO or COO role' })
  async getHRStats(@Query() query: DashboardQueryDto) {
    const data = await this.dashboardService.getHRStats(query);
    return BaseResponse.ok(data);
  }

  @Get('sales-pipeline')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE)
  @ApiOperation({
    summary: 'Get sales pipeline data for tracking deal stages',
  })
  @ApiOkResponse({ description: 'Sales pipeline data', type: BaseResponse })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token' })
  @ApiForbiddenResponse({
    description: 'Forbidden - requires CEO, COO, Sales Director, Sales Leader, or Sale role',
  })
  async getSalesPipeline(
    @Query('saleId') saleId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const data = await this.salesDashboardService.getSalesPipeline(
      saleId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
    return BaseResponse.ok(data);
  }

  @Get('analytics')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.SALES_DIRECTOR)
  @ApiOperation({
    summary: 'Get analytics data by metric and period',
  })
  @ApiOkResponse({ description: 'Analytics data', type: BaseResponse })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden - requires CEO, COO, or Sales Director role' })
  async getAnalytics(@Query('metric') metric?: string, @Query('period') period?: string) {
    const data = await this.analyticsService.getAnalytics(metric ?? 'revenue', period ?? '12m');
    return BaseResponse.ok(data);
  }

  @Get('sla-tracking')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CSKH)
  @ApiOperation({
    summary: 'Get SLA tracking data for customer service',
  })
  @ApiOkResponse({ description: 'SLA tracking data', type: BaseResponse })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden - requires CEO, COO, or CSKH role' })
  async getSlaTracking() {
    const data = await this.salesDashboardService.getSlaTracking();
    return BaseResponse.ok(data);
  }

  @Get('reports/order-pnl')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CHIEF_ACCOUNTANT)
  @ApiOperation({
    summary: 'Get order P&L report',
  })
  @ApiOkResponse({ description: 'Order P&L report data', type: BaseResponse })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden - requires CEO, COO, or Chief Accountant role' })
  async getOrderPnl(
    @Query('orderId') orderId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const data = await this.reportsService.getOrderPnL(
      orderId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
    return BaseResponse.ok(data);
  }

  @Get('reports/margin-by-route')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CHIEF_ACCOUNTANT)
  @ApiOperation({
    summary: 'Get margin by route report',
  })
  @ApiOkResponse({ description: 'Margin by route report data', type: BaseResponse })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden - requires CEO, COO, or Chief Accountant role' })
  async getMarginByRoute(@Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    const data = await this.reportsService.getMarginByRoute(
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
    return BaseResponse.ok(data);
  }

  @Get('reports/cash-flow-forecast')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CHIEF_ACCOUNTANT)
  @ApiOperation({
    summary: 'Get cash flow forecast report',
  })
  @ApiOkResponse({ description: 'Cash flow forecast data', type: BaseResponse })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Forbidden - requires CEO, COO, or Chief Accountant role' })
  async getCashFlowForecast(@Query('days') days?: number) {
    const data = await this.reportsService.getCashFlowForecast(days ? Number(days) : 30);
    return BaseResponse.ok(data);
  }

  // ─── Metric History (Snapshot) ───────────────────────────────────────────

  @Get('metric-history')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.SALES_DIRECTOR,
    UserRole.CHIEF_ACCOUNTANT,
  )
  @ApiOperation({
    summary: 'Lay lich su gia tri KPI theo ngay de ve bieu do xu huong',
    description:
      'Tra ve mang [{date, value}] tu bang daily_metric_snapshots. ' +
      'Snapshot duoc chup tu dong luc 23:00 moi ngay. ' +
      'Metric hop le: total_orders, total_orders_today, revenue_month, ' +
      'ar_outstanding, ar_overdue, containers_in_transit, ' +
      'packages_in_warehouse_cn, packages_in_warehouse_vn, active_customers.',
  })
  @ApiOkResponse({
    description: 'Danh sach diem du lieu lich su theo ngay',
    type: BaseResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Chua xac thuc - token khong hop le' })
  @ApiForbiddenResponse({ description: 'Khong co quyen - can CEO/COO/CFO/Sales Director/Chief Accountant' })
  async getMetricHistory(@Query() query: MetricHistoryQueryDto) {
    const data = await this.metricSnapshotService.getMetricHistory(
      query.metric,
      query.days ?? 30,
      query.branch,
    );
    return BaseResponse.ok({ metric: query.metric, days: query.days ?? 30, history: data });
  }

  // ─── Drill-Down ──────────────────────────────────────────────────────────

  @Get('drill-down')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.SALES_DIRECTOR,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT_AR,
    UserRole.LOGISTICS_MANAGER,
  )
  @ApiOperation({
    summary: 'Xem chi tiet ban ghi thuc te dang sau mot KPI',
    description:
      'Tra ve danh sach phan trang cac ban ghi thuc te cua metric. ' +
      'Metric ho tro: total_orders (don hang), ar_outstanding (cong no phai thu), ' +
      'containers_in_transit (container dang van chuyen), active_customers (khach hang hoat dong).',
  })
  @ApiOkResponse({
    description: 'Danh sach ban ghi chi tiet co phan trang',
    type: BaseResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Chua xac thuc - token khong hop le' })
  @ApiForbiddenResponse({ description: 'Khong co quyen truy cap drill-down' })
  async getDrillDown(@Query() query: DrillDownQueryDto) {
    const data = await this.dashboardService.getDrillDown(query);
    return BaseResponse.ok(data);
  }

  // ─── Manual Snapshot Trigger ─────────────────────────────────────────────

  @Post('capture-snapshot')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO)
  @ApiOperation({
    summary: 'Kich hoat thu cong viec chup anh KPI hang ngay',
    description:
      'Thu cong goi captureDaily() ma khong can doi den 23:00. ' +
      'Chi dung cho kiem tra hoac phuc hoi du lieu snapshot bi mat.',
  })
  @ApiOkResponse({
    description: 'Chup anh KPI thanh cong',
    type: BaseResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Chua xac thuc - token khong hop le' })
  @ApiForbiddenResponse({ description: 'Khong co quyen - can CEO/COO/CFO' })
  async triggerSnapshot() {
    await this.metricSnapshotService.captureDaily();
    return BaseResponse.ok({ triggered: true, message: 'Snapshot KPI da duoc chup thanh cong' });
  }
}
