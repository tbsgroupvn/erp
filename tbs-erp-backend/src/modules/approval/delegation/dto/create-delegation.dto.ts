import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateDelegationDto {
  @ApiProperty({ description: 'User ID to delegate to' })
  @IsNotEmpty()
  @IsString()
  toUserId: string;

  @ApiProperty({ description: 'Start date (ISO)' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date (ISO)' })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: 'Approval types to delegate (empty = all)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  approvalTypes?: string[];

  @ApiPropertyOptional({ description: 'Reason for delegation' })
  @IsOptional()
  @IsString()
  reason?: string;
}
