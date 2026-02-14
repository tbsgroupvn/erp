import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString, ValidateIf } from 'class-validator';
import { QuotationStatus } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

/**
 * Query DTO for listing quotations with filters.
 * Extends PaginationDto with quotation-specific filters.
 */
export class QuotationQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by quotation status',
    enum: QuotationStatus,
    example: QuotationStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(QuotationStatus, { message: 'Invalid quotation status' })
  status?: QuotationStatus;

  @ApiPropertyOptional({
    description: 'Filter by customer ID',
    example: 'clxyz123abc',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by search keyword (quotation code, customer name)',
    example: 'QUO-',
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
