import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class CommissionDateRangeDto {
  @ApiPropertyOptional({ description: 'Start date (ISO 8601)', example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)', example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
