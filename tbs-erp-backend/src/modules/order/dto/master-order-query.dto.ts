import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { MasterOrderStatus, Branch } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class MasterOrderQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by overall status',
    enum: MasterOrderStatus,
  })
  @IsOptional()
  @IsEnum(MasterOrderStatus, { message: 'Invalid master order status' })
  status?: MasterOrderStatus;

  @ApiPropertyOptional({
    description: 'Filter by customer ID',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by sale user ID',
  })
  @IsOptional()
  @IsString()
  saleId?: string;

  @ApiPropertyOptional({
    description: 'Filter by branch',
    enum: Branch,
  })
  @IsOptional()
  @IsEnum(Branch, { message: 'Invalid branch' })
  branch?: Branch;

  @ApiPropertyOptional({
    description: 'Search by master order code or customer name',
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
  endDate?: string;
}
