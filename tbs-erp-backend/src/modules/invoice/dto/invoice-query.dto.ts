import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  SENT_TAX = 'SENT_TAX',
  CANCELLED = 'CANCELLED',
  ADJUSTED = 'ADJUSTED',
}

export class InvoiceQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by customer ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Filter by order ID' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Search by code' })
  @IsOptional()
  @IsString()
  search?: string;
}
