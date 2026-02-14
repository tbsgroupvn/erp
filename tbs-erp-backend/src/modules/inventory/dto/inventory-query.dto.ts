import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class InventoryQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by code or name', example: 'BOX' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by category', example: 'Packaging' })
  @IsOptional()
  @IsString()
  category?: string;
}

export class MovementHistoryQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
