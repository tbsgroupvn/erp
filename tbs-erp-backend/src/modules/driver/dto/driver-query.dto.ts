import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Branch, DriverStatus } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class DriverQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: DriverStatus })
  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;

  @ApiPropertyOptional({ description: 'Filter by branch', enum: Branch })
  @IsOptional()
  @IsEnum(Branch)
  branch?: Branch;

  @ApiPropertyOptional({ description: 'Search by name or phone' })
  @IsOptional()
  @IsString()
  search?: string;
}
