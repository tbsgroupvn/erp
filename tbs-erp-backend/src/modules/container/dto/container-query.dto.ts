import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { ShippingRoute } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

/**
 * Container statuses for filtering.
 */
export enum ContainerStatus {
  PLANNING = 'PLANNING',
  LOADING = 'LOADING',
  IN_TRANSIT = 'IN_TRANSIT',
  ARRIVED = 'ARRIVED',
  CUSTOMS = 'CUSTOMS',
  COMPLETED = 'COMPLETED',
}

export class ContainerQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by container status',
    enum: ContainerStatus,
    example: ContainerStatus.PLANNING,
  })
  @IsOptional()
  @IsEnum(ContainerStatus, { message: 'Invalid container status' })
  status?: ContainerStatus;

  @ApiPropertyOptional({
    description: 'Filter by shipping route',
    enum: ShippingRoute,
    example: ShippingRoute.SEA,
  })
  @IsOptional()
  @IsEnum(ShippingRoute, { message: 'Invalid shipping route' })
  shippingRoute?: ShippingRoute;

  @ApiPropertyOptional({
    description: 'Search by container code or booking reference',
    example: 'TBS-CNT',
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
