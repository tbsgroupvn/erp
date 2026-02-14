import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { TrackingEventType } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

/**
 * Query DTO for listing tracking events with filters.
 */
export class TrackingQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by tracking number',
    example: 'SF1234567890',
  })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({
    description: 'Filter by package ID',
    example: 'clxyz123abc',
  })
  @IsOptional()
  @IsString()
  packageId?: string;

  @ApiPropertyOptional({
    description: 'Filter by container ID',
    example: 'clxyz456def',
  })
  @IsOptional()
  @IsString()
  containerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by event type',
    enum: TrackingEventType,
  })
  @IsOptional()
  @IsEnum(TrackingEventType, { message: 'Invalid tracking event type' })
  eventType?: TrackingEventType;

  @ApiPropertyOptional({
    description: 'Search by keyword (location, description, tracking number)',
    example: 'Guangzhou',
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
