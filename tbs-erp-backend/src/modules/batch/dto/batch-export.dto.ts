import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BatchExportDto {
  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by service type' })
  @IsOptional()
  @IsString()
  serviceType?: string;

  @ApiPropertyOptional({ description: 'Filter by customer ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Export format', enum: ['XLSX', 'CSV'] })
  @IsOptional()
  @IsEnum(['XLSX', 'CSV'])
  format?: 'XLSX' | 'CSV';
}
