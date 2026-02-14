import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export enum ArStatus {
  OPEN = 'OPEN',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  NETTED = 'NETTED',
}

export class ArQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: ArStatus })
  @IsOptional()
  @IsEnum(ArStatus)
  status?: ArStatus;

  @ApiPropertyOptional({ description: 'Filter by customer ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Search by code or customer name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter overdue only' })
  @IsOptional()
  isOverdue?: boolean;
}
