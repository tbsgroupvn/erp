import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';
import { ApprovalStatus } from '@prisma/client';

export class NettingQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;

  @ApiPropertyOptional({ description: 'Search by code or partner name', example: 'NET-' })
  @IsOptional()
  @IsString()
  search?: string;
}
