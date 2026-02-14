import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export enum ApStatus {
  OPEN = 'OPEN',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  NETTED = 'NETTED',
}

export class ApQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: ApStatus })
  @IsOptional()
  @IsEnum(ApStatus)
  status?: ApStatus;

  @ApiPropertyOptional({ description: 'Filter by vendor ID' })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiPropertyOptional({ description: 'Search by code or vendor name' })
  @IsOptional()
  @IsString()
  search?: string;
}
