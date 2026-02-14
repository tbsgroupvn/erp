import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { QCStatus } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class QCQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by QC status', enum: QCStatus })
  @IsOptional()
  @IsEnum(QCStatus)
  status?: QCStatus;

  @ApiPropertyOptional({ description: 'Filter by order ID' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Filter by package ID' })
  @IsOptional()
  @IsString()
  packageId?: string;

  @ApiPropertyOptional({ description: 'Search by QC code, order code, or tracking number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter from date (ISO 8601)', example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO 8601)', example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
