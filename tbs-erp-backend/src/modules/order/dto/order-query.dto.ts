import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString, ValidateIf } from 'class-validator';
import { OrderStatus, ServiceType, ClearanceType } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

/**
 * Query DTO for listing orders with filters.
 * Extends PaginationDto with order-specific filters.
 */
export class OrderQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by order status',
    enum: OrderStatus,
    example: OrderStatus.CONSULTING,
  })
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'Invalid order status' })
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'Filter by service type',
    enum: ServiceType,
    example: ServiceType.MHH,
  })
  @IsOptional()
  @IsEnum(ServiceType, { message: 'Invalid service type' })
  serviceType?: ServiceType;

  @ApiPropertyOptional({
    description: 'Filter by customer ID',
    example: 'clxyz123abc',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by sale user ID',
    example: 'clxyz789def',
  })
  @IsOptional()
  @IsString()
  saleId?: string;

  @ApiPropertyOptional({
    description: 'Filter by clearance type',
    enum: ClearanceType,
  })
  @IsOptional()
  @IsEnum(ClearanceType, { message: 'Invalid clearance type' })
  clearanceType?: ClearanceType;

  @ApiPropertyOptional({
    description: 'Filter by search keyword (order code, customer name)',
    example: 'TBS-ORD',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Start date for date range filter (ISO 8601)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for date range filter (ISO 8601)',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  @ValidateIf((o) => o.startDate !== undefined)
  endDate?: string;
}
