import { Resolver, Query, Subscription, Args } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { GqlAuthGuard } from '@core/graphql/guards/gql-auth.guard';
import { PubSub } from 'graphql-subscriptions';
import {
  DashboardSummaryType,
  DashboardUpdateType,
  DashboardArgs,
  DashboardOverviewType,
  OrderStatsType,
  WarehouseStatsType,
} from '@core/graphql/types/dashboard.type';
import { DashboardService } from './dashboard.service';

// Shared PubSub instance for dashboard subscriptions
const pubSub = new PubSub();
export { pubSub as dashboardPubSub };

@Resolver()
@UseGuards(GqlAuthGuard)
export class DashboardResolver {
  private readonly logger = new Logger(DashboardResolver.name);

  constructor(private readonly dashboardService: DashboardService) { }

  @Query(() => DashboardSummaryType, {
    name: 'dashboardSummary',
    description: 'Fetch the full dashboard summary (overview + orders + warehouse)',
  })
  async getDashboardSummary(
    @Args() args: DashboardArgs,
  ): Promise<DashboardSummaryType> {
    const queryDto = this.buildQueryDto(args);

    const [overviewRaw, orderStatsRaw, warehouseRaw] = await Promise.all([
      this.dashboardService.getOverview(queryDto),
      this.dashboardService.getOrderStats(queryDto),
      this.dashboardService.getWarehouseStats(queryDto),
    ]);

    const overview: DashboardOverviewType = {
      start: overviewRaw.period.start,
      end: overviewRaw.period.end,
      totalOrders: overviewRaw.totalOrders,
      completedOrders: overviewRaw.completedOrders,
      totalRevenue: overviewRaw.totalRevenue,
      newCustomers: overviewRaw.newCustomers,
    };

    const orderStats: OrderStatsType = {
      byStatus: orderStatsRaw.byStatus,
      byServiceType: orderStatsRaw.byServiceType,
      activeOrders: orderStatsRaw.activeOrders,
      pendingDeposit: orderStatsRaw.pendingDeposit,
    };

    const warehouseStats: WarehouseStatsType = {
      warehouseCN: warehouseRaw.warehouseCN,
      packing: warehouseRaw.packing,
      consolidation: warehouseRaw.consolidation,
      inTransit: warehouseRaw.inTransit,
      atCustoms: warehouseRaw.atCustoms,
      warehouseVN: warehouseRaw.warehouseVN,
      pendingDelivery: warehouseRaw.pendingDelivery,
      delivering: warehouseRaw.delivering,
      pipelineTotal: warehouseRaw.pipeline.total,
    };

    return {
      overview,
      orderStats,
      warehouseStats,
    };
  }

  @Query(() => DashboardOverviewType, {
    name: 'dashboardOverview',
    description: 'Fetch only the dashboard overview metrics',
  })
  async getDashboardOverview(
    @Args() args: DashboardArgs,
  ): Promise<DashboardOverviewType> {
    const queryDto = this.buildQueryDto(args);
    const raw = await this.dashboardService.getOverview(queryDto);
    return {
      start: raw.period.start,
      end: raw.period.end,
      totalOrders: raw.totalOrders,
      completedOrders: raw.completedOrders,
      totalRevenue: raw.totalRevenue,
      newCustomers: raw.newCustomers,
    };
  }

  @Query(() => WarehouseStatsType, {
    name: 'warehouseStats',
    description: 'Fetch warehouse pipeline statistics',
  })
  async getWarehouseStats(
    @Args() args: DashboardArgs,
  ): Promise<WarehouseStatsType> {
    const queryDto = this.buildQueryDto(args);
    const raw = await this.dashboardService.getWarehouseStats(queryDto);
    return {
      warehouseCN: raw.warehouseCN,
      packing: raw.packing,
      consolidation: raw.consolidation,
      inTransit: raw.inTransit,
      atCustoms: raw.atCustoms,
      warehouseVN: raw.warehouseVN,
      pendingDelivery: raw.pendingDelivery,
      delivering: raw.delivering,
      pipelineTotal: raw.pipeline.total,
    };
  }

  // ─── Subscriptions ───

  @Subscription(() => DashboardUpdateType, {
    name: 'dashboardUpdates',
    description: 'Subscribe to real-time dashboard metric updates',
  })
  dashboardUpdates() {
    return pubSub.asyncIterator('dashboardUpdated');
  }

  // ─── Helpers ───

  private buildQueryDto(args: DashboardArgs): any {
    const dto: any = {};
    if (args.branch) dto.branch = args.branch;

    // DashboardQueryDto.getDateRange() defaults to current month if no dates provided
    dto.getDateRange = () => {
      const now = new Date();
      return {
        start: args.startDate ?? new Date(now.getFullYear(), now.getMonth(), 1),
        end: args.endDate ?? now,
      };
    };

    return dto;
  }
}
