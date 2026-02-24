import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString, ValidateIf } from 'class-validator';
import { ContractStatus, ContractType } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class ContractQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by contract status',
    enum: ContractStatus,
  })
  @IsOptional()
  @IsEnum(ContractStatus, { message: 'Invalid contract status' })
  status?: ContractStatus;

  @ApiPropertyOptional({
    description: 'Filter by contract type',
    enum: ContractType,
  })
  @IsOptional()
  @IsEnum(ContractType, { message: 'Invalid contract type' })
  type?: ContractType;

  @ApiPropertyOptional({ description: 'Filter by customer ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by search keyword (contract code, customer name, title)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Start date for date range filter (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for date range filter (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  @ValidateIf((o) => o.startDate !== undefined)
  endDate?: string;
}
