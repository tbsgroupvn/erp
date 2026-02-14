import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class CustomerOrderQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Search by order code' })
  @IsOptional()
  @IsString()
  search?: string;
}
