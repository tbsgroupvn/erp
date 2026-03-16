import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
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
  @Type(() => Boolean)
  @IsBoolean()
  isOverdue?: boolean;
}
