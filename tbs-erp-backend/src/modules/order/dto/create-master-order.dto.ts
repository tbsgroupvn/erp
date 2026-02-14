import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import {
  ServiceType,
  ShippingRoute,
  Branch,
  ClearanceType,
} from '@prisma/client';
import { CreateOrderItemDto } from './create-order.dto';

export class CreateSubOrderDto {
  @ApiProperty({
    description: 'Type of service',
    enum: ServiceType,
    example: ServiceType.MHH,
  })
  @IsEnum(ServiceType, { message: 'Invalid service type' })
  serviceType: ServiceType;

  @ApiProperty({
    description: 'Clearance type',
    enum: ClearanceType,
    default: ClearanceType.TIEU_NGACH,
  })
  @IsEnum(ClearanceType, { message: 'Invalid clearance type' })
  clearanceType: ClearanceType;

  @ApiPropertyOptional({
    description: 'Shipping route',
    enum: ShippingRoute,
  })
  @IsOptional()
  @IsEnum(ShippingRoute, { message: 'Invalid shipping route' })
  shippingRoute?: ShippingRoute;

  @ApiProperty({
    description: 'Order items',
    type: [CreateOrderItemDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 item is required' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiPropertyOptional({
    description: 'Sub order notes',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateMasterOrderDto {
  @ApiProperty({
    description: 'Customer ID',
    example: 'clxyz123abc',
  })
  @IsString()
  @IsNotEmpty({ message: 'Customer ID is required' })
  customerId: string;

  @ApiProperty({
    description: 'Branch office',
    enum: Branch,
    example: Branch.HN,
  })
  @IsEnum(Branch, { message: 'Invalid branch' })
  branch: Branch;

  @ApiPropertyOptional({
    description: 'Master order notes',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    description: 'Sub orders',
    type: [CreateSubOrderDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 sub order is required' })
  @ValidateNested({ each: true })
  @Type(() => CreateSubOrderDto)
  subOrders: CreateSubOrderDto[];
}
