import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierOrderStatus } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class SupplierOrderQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: SupplierOrderStatus,
    description: 'Filter by supplier order status',
  })
  @IsOptional()
  @IsEnum(SupplierOrderStatus)
  status?: SupplierOrderStatus;

  @ApiPropertyOptional({ description: 'Filter by parent order ID' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({
    description: 'Search by supplier order code, supplier name, or supplier order number',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by end date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
