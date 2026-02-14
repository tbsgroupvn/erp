import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PurchaseStatus } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class PurchaseQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: PurchaseStatus })
  @IsOptional()
  @IsEnum(PurchaseStatus)
  status?: PurchaseStatus;

  @ApiPropertyOptional({ description: 'Filter by vendor ID' })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiPropertyOptional({ description: 'Search by code', example: 'PR-' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)', example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)', example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
