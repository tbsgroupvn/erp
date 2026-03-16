import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString, ValidateIf } from 'class-validator';
import { CostType, CostAdjustmentStatus } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class CostAdjustmentQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: CostAdjustmentStatus })
  @IsOptional()
  @IsEnum(CostAdjustmentStatus)
  status?: CostAdjustmentStatus;

  @ApiPropertyOptional({ description: 'Filter by cost type', enum: CostType })
  @IsOptional()
  @IsEnum(CostType)
  costType?: CostType;

  @ApiPropertyOptional({ description: 'Search by keyword (description, code, invoice ref)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Start date filter (ISO 8601)', example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO 8601)', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  @ValidateIf((o) => o.startDate !== undefined)
  endDate?: string;
}
