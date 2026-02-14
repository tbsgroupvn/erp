import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApprovalStatus } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';
import { VoucherType } from './create-voucher.dto';

export class VoucherQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by voucher type', enum: VoucherType })
  @IsOptional()
  @IsEnum(VoucherType)
  type?: VoucherType;

  @ApiPropertyOptional({ description: 'Filter by approval status', enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;

  @ApiPropertyOptional({ description: 'Filter by order ID' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Filter by creator' })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Filter flagged vouchers only' })
  @IsOptional()
  isFlagged?: boolean;

  @ApiPropertyOptional({ description: 'Search by code' })
  @IsOptional()
  @IsString()
  search?: string;
}
