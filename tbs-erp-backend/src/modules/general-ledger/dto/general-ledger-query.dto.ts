import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class GeneralLedgerQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by entry code or description', example: 'JE-' })
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
