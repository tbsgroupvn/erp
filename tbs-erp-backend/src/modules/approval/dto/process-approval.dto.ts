import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export enum ApprovalDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ProcessApprovalDto {
  @ApiProperty({
    description: 'Approval decision',
    enum: ApprovalDecision,
  })
  @IsNotEmpty()
  @IsEnum(ApprovalDecision)
  decision: ApprovalDecision;

  @ApiPropertyOptional({ description: 'Comment or reason for the decision' })
  @SanitizeHtmlStrict()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
