import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Branch, VehicleStatus, VehicleType } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class FleetQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by vehicle type', enum: VehicleType })
  @IsOptional()
  @IsEnum(VehicleType)
  type?: VehicleType;

  @ApiPropertyOptional({ description: 'Filter by status', enum: VehicleStatus })
  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @ApiPropertyOptional({ description: 'Filter by branch', enum: Branch })
  @IsOptional()
  @IsEnum(Branch)
  branch?: Branch;

  @ApiPropertyOptional({ description: 'Search by plate number' })
  @IsOptional()
  @IsString()
  search?: string;
}
