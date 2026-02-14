import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import {
  ComplaintStatus,
  ComplaintType,
  ComplaintSeverity,
} from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

/**
 * Query DTO for listing complaints with filters.
 */
export class ComplaintQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by complaint status',
    enum: ComplaintStatus,
    example: ComplaintStatus.OPEN,
  })
  @IsOptional()
  @IsEnum(ComplaintStatus, { message: 'Invalid complaint status' })
  status?: ComplaintStatus;

  @ApiPropertyOptional({
    description: 'Filter by complaint type',
    enum: ComplaintType,
  })
  @IsOptional()
  @IsEnum(ComplaintType, { message: 'Invalid complaint type' })
  type?: ComplaintType;

  @ApiPropertyOptional({
    description: 'Filter by severity',
    enum: ComplaintSeverity,
  })
  @IsOptional()
  @IsEnum(ComplaintSeverity, { message: 'Invalid severity' })
  severity?: ComplaintSeverity;

  @ApiPropertyOptional({
    description: 'Filter by customer ID',
    example: 'clxyz456def',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by handler (assigned employee) ID',
  })
  @IsOptional()
  @IsString()
  handlerId?: string;

  @ApiPropertyOptional({
    description: 'Search by keyword (complaint code, description)',
    example: 'QMS-',
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
