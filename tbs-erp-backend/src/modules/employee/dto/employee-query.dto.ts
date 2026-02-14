import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Branch, EmployeeStatus } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class EmployeeQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by department code', example: 'SALES' })
  @IsOptional()
  @IsString()
  departmentCode?: string;

  @ApiPropertyOptional({ description: 'Filter by branch', enum: Branch })
  @IsOptional()
  @IsEnum(Branch)
  branch?: Branch;

  @ApiPropertyOptional({ description: 'Filter by status', enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional({ description: 'Search by name, code, or email' })
  @IsOptional()
  @IsString()
  search?: string;
}
