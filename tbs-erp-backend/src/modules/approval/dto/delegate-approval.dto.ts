import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class DelegateApprovalDto {
  @ApiProperty({ description: 'Step ID to delegate' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  stepId: string;

  @ApiProperty({ description: 'User ID to delegate to' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  toUserId: string;

  @ApiPropertyOptional({ description: 'Comment for delegation' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
