import { ObjectType, Field, Float, Int, ArgsType } from '@nestjs/graphql';
import { IsOptional, IsString, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

// ─── Dashboard Summary ───

@ObjectType({ description: 'High-level dashboard overview metrics' })
export class DashboardOverviewType {
  @Field(() => Date, { description: 'Period start' })
  start: Date;

  @Field(() => Date, { description: 'Period end' })
  end: Date;

  @Field(() => Int, { description: 'Total orders in period' })
  totalOrders: number;

  @Field(() => Int, { description: 'Completed orders in period' })
  completedOrders: number;

  @Field(() => Float, { description: 'Total revenue (VND)' })
  totalRevenue: number;

  @Field(() => Int, { description: 'New customers in period' })
  newCustomers: number;
}

@ObjectType({ description: 'Status breakdown item' })
export class StatusBreakdownType {
  @Field({ description: 'Status name' })
  status: string;

  @Field(() => Int, { description: 'Count of orders' })
  count: number;

  @Field(() => Float, { description: 'Total amount' })
  totalAmount: number;
}

@ObjectType({ description: 'Service type breakdown item' })
export class ServiceTypeBreakdownType {
  @Field({ description: 'Service type name' })
  serviceType: string;

  @Field(() => Int, { description: 'Count of orders' })
  count: number;

  @Field(() => Float, { description: 'Total amount' })
  totalAmount: number;
}

@ObjectType({ description: 'Order statistics for the dashboard' })
export class OrderStatsType {
  @Field(() => [StatusBreakdownType], { description: 'Orders grouped by status' })
  byStatus: StatusBreakdownType[];

  @Field(() => [ServiceTypeBreakdownType], { description: 'Orders grouped by service type' })
  byServiceType: ServiceTypeBreakdownType[];

  @Field(() => Int, { description: 'Active (in-progress) orders' })
  activeOrders: number;

  @Field(() => Int, { description: 'Orders pending deposit' })
  pendingDeposit: number;
}

@ObjectType({ description: 'Warehouse pipeline metrics' })
export class WarehouseStatsType {
  @Field(() => Int) warehouseCN: number;
  @Field(() => Int) packing: number;
  @Field(() => Int) consolidation: number;
  @Field(() => Int) inTransit: number;
  @Field(() => Int) atCustoms: number;
  @Field(() => Int) warehouseVN: number;
  @Field(() => Int) pendingDelivery: number;
  @Field(() => Int) delivering: number;
  @Field(() => Int, { description: 'Total packages in the pipeline' }) pipelineTotal: number;
}

@ObjectType({ description: 'Full dashboard summary combining all sections' })
export class DashboardSummaryType {
  @Field(() => DashboardOverviewType, { description: 'Overview metrics' })
  overview: DashboardOverviewType;

  @Field(() => OrderStatsType, { description: 'Order statistics' })
  orderStats: OrderStatsType;

  @Field(() => WarehouseStatsType, { description: 'Warehouse pipeline' })
  warehouseStats: WarehouseStatsType;
}

// ─── Dashboard Update (for subscriptions) ───

@ObjectType({ description: 'Real-time dashboard update payload' })
export class DashboardUpdateType {
  @Field({ description: 'Type of update event' })
  eventType: string;

  @Field({ description: 'JSON-serialized payload of the change' })
  payload: string;

  @Field(() => Date, { description: 'Timestamp of the update' })
  timestamp: Date;
}

// ─── Dashboard Query Args ───

@ArgsType()
export class DashboardArgs {
  @Field(() => Date, { nullable: true, description: 'Start of the date range' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @Field(() => Date, { nullable: true, description: 'End of the date range' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @Field({ nullable: true, description: 'Filter by branch' })
  @IsOptional()
  @IsString()
  branch?: string;
}
