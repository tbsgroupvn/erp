import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApprovalType } from '@prisma/client';

export class CreateApprovalDto {
  @ApiProperty({ description: 'Approval type', enum: ApprovalType })
  @IsNotEmpty()
  @IsEnum(ApprovalType)
  type: ApprovalType;

  @ApiProperty({ description: 'Reference ID (order, voucher, etc.)' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  referenceId: string;

  @ApiPropertyOptional({ description: 'Reference code for display' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceCode?: string;

  @ApiPropertyOptional({
    description: 'Additional data for the approval request (JSON)',
  })
  @IsOptional()
  @IsObject()
  requestData?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Mark as urgent' })
  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;
}
