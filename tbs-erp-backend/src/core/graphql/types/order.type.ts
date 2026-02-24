import { ObjectType, Field, ID, Float, ArgsType, InputType, Int } from '@nestjs/graphql';
import { IsOptional, IsString, IsDate, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerType } from './customer.type';
import { PackageType } from './package.type';
import { PaginatedResponse } from './pagination.type';

@ObjectType({ description: 'Order entity — represents a logistics/freight order' })
export class OrderType {
  @Field(() => ID)
  id: string;

  @Field({ description: 'Order code (e.g., DH-240001)' })
  code: string;

  @Field({ description: 'Current order status' })
  status: string;

  @Field({ description: 'Service type (e.g., SEA, AIR, RAIL, EXPRESS)' })
  serviceType: string;

  @Field({ nullable: true, description: 'Clearance type' })
  clearanceType?: string;

  @Field(() => Float, { description: 'Total order amount (VND)' })
  totalAmount: number;

  @Field(() => Float, { nullable: true, description: 'Deposit amount required' })
  depositAmount?: number;

  @Field(() => Float, { nullable: true, description: 'Deposit amount paid so far' })
  depositPaid?: number;

  @Field({ nullable: true, description: 'Branch handling this order' })
  branch?: string;

  @Field({ nullable: true, description: 'Notes / remarks on the order' })
  note?: string;

  @Field({ description: 'Customer ID' })
  customerId: string;

  @Field(() => CustomerType, { nullable: true, description: 'Customer who placed the order' })
  customer?: CustomerType;

  @Field(() => [PackageType], { nullable: true, description: 'Packages in this order' })
  packages?: PackageType[];

  @Field({ nullable: true, description: 'Sales person ID' })
  salesPersonId?: string;

  @Field(() => Date, { nullable: true, description: 'Completion timestamp' })
  completedAt?: Date;

  @Field(() => Date, { description: 'Creation timestamp' })
  createdAt: Date;

  @Field(() => Date, { description: 'Last update timestamp' })
  updatedAt: Date;
}

@ObjectType()
export class PaginatedOrders extends PaginatedResponse(OrderType) {}

@ArgsType()
export class OrderQueryArgs {
  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @Field({ nullable: true, description: 'Filter by order status' })
  @IsOptional()
  @IsString()
  status?: string;

  @Field({ nullable: true, description: 'Filter by service type' })
  @IsOptional()
  @IsString()
  serviceType?: string;

  @Field({ nullable: true, description: 'Filter by branch' })
  @IsOptional()
  @IsString()
  branch?: string;

  @Field({ nullable: true, description: 'Filter by customer ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @Field({ nullable: true, description: 'Search by order code or customer name' })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => Date, { nullable: true, description: 'Filter orders created after this date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @Field(() => Date, { nullable: true, description: 'Filter orders created before this date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;
}

@InputType({ description: 'Input for creating a new order' })
export class CreateOrderInput {
  @Field({ description: 'Customer ID' })
  customerId: string;

  @Field({ description: 'Service type: SEA, AIR, RAIL, EXPRESS' })
  serviceType: string;

  @Field({ nullable: true, description: 'Clearance type' })
  clearanceType?: string;

  @Field({ nullable: true, description: 'Branch' })
  branch?: string;

  @Field({ nullable: true, description: 'Notes / remarks' })
  note?: string;

  @Field(() => [CreateOrderItemInput], { nullable: true, description: 'Order items / packages' })
  items?: CreateOrderItemInput[];
}

@InputType({ description: 'Input for an order item' })
export class CreateOrderItemInput {
  @Field({ description: 'Product / item description' })
  description: string;

  @Field(() => Float, { nullable: true, description: 'Weight in kg' })
  weight?: number;

  @Field(() => Float, { nullable: true, description: 'Length in cm' })
  length?: number;

  @Field(() => Float, { nullable: true, description: 'Width in cm' })
  width?: number;

  @Field(() => Float, { nullable: true, description: 'Height in cm' })
  height?: number;

  @Field(() => Int, { nullable: true, defaultValue: 1, description: 'Quantity' })
  quantity?: number;
}
