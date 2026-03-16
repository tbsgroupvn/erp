import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString, ValidateIf } from 'class-validator';
import { CostType } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

/**
 * Query DTO for listing operation costs with filters.
 */
export class CostQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by cost type',
    enum: CostType,
  })
  @IsOptional()
  @IsEnum(CostType, { message: 'Invalid cost type' })
  costType?: CostType;

  @ApiPropertyOptional({
    description: 'Filter by container ID',
    example: 'clxyz123abc',
  })
  @IsOptional()
  @IsString()
  containerId?: string;

  @ApiPropertyOptional({
    description: 'Search by keyword (description, invoice ref)',
    example: 'INV-',
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
