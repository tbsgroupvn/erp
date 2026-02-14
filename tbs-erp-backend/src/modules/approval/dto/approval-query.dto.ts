import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApprovalStatus, ApprovalType } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class ApprovalQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by approval type', enum: ApprovalType })
  @IsOptional()
  @IsEnum(ApprovalType)
  type?: ApprovalType;

  @ApiPropertyOptional({ description: 'Filter by status', enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;

  @ApiPropertyOptional({ description: 'Filter by requester ID' })
  @IsOptional()
  @IsString()
  requestedBy?: string;

  @ApiPropertyOptional({ description: 'Search by reference code' })
  @IsOptional()
  @IsString()
  search?: string;
}
