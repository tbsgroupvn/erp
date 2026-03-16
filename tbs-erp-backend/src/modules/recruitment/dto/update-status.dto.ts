import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CandidateStatus } from './candidate-query.dto';

export class UpdateCandidateStatusDto {
  @ApiProperty({
    description: 'Trạng thái mới',
    enum: CandidateStatus,
    example: CandidateStatus.SCREENING,
  })
  @IsEnum(CandidateStatus)
  status: CandidateStatus;

  @ApiPropertyOptional({ description: 'Lý do chuyển trạng thái' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
