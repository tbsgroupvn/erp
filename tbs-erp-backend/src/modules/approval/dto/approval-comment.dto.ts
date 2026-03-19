import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class CreateApprovalCommentDto {
  @ApiProperty({ description: 'Comment content' })
  @SanitizeHtmlStrict()
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({ description: 'Related step ID' })
  @IsOptional()
  @IsString()
  stepId?: string;
}
