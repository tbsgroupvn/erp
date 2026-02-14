import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LeaveType } from '@prisma/client';

export class RequestLeaveDto {
  @ApiProperty({ description: 'Leave type', enum: LeaveType, example: LeaveType.ANNUAL })
  @IsEnum(LeaveType)
  type: LeaveType;

  @ApiProperty({ description: 'Start date', example: '2025-06-15' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date', example: '2025-06-17' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: 'Reason for leave' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RejectLeaveDto {
  @ApiProperty({ description: 'Rejection reason' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
