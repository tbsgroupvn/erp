import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class PayrollQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by month (1-12)', example: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ description: 'Filter by year', example: 2025 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ description: 'Filter by status (DRAFT, APPROVED, PAID)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by employee ID' })
  @IsOptional()
  @IsString()
  employeeId?: string;
}

export class CalculatePayrollDto {
  @ApiProperty({ description: 'Month (1-12)', example: 6 })
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ description: 'Year', example: 2025 })
  @IsInt()
  year: number;
}

export class ApprovePayrollDto {
  @ApiProperty({ description: 'Month (1-12)', example: 6 })
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ description: 'Year', example: 2025 })
  @IsInt()
  year: number;
}
