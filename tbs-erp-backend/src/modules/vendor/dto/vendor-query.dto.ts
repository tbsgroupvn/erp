import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '@common/dto/pagination.dto';

export class VendorQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name, code, or contact person', example: 'Guangzhou' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by country', example: 'CN' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Filter by approval status (true/false)' })
  @IsOptional()
  @Type(() => Boolean)
  isApproved?: boolean;
}
