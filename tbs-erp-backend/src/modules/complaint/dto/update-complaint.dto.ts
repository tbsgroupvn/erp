import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { ComplaintType, ComplaintSeverity } from '@prisma/client';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

/**
 * DTO for updating an existing complaint.
 * Allows updating type, severity, description, attachments, and investigation notes.
 */
export class UpdateComplaintDto {
  @ApiPropertyOptional({
    description: 'Updated complaint type',
    enum: ComplaintType,
  })
  @IsOptional()
  @IsEnum(ComplaintType, { message: 'Invalid complaint type' })
  type?: ComplaintType;

  @ApiPropertyOptional({
    description: 'Updated severity level',
    enum: ComplaintSeverity,
  })
  @IsOptional()
  @IsEnum(ComplaintSeverity, { message: 'Invalid severity level' })
  severity?: ComplaintSeverity;

  @ApiPropertyOptional({
    description: 'Updated description',
  })
  @SanitizeHtmlStrict()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated attachment URLs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @ApiPropertyOptional({
    description: 'Investigation notes to add',
    example: 'Contacted warehouse team for investigation',
  })
  @SanitizeHtmlStrict()
  @IsOptional()
  @IsString()
  investigationNote?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
  })
  @SanitizeHtmlStrict()
  @IsOptional()
  @IsString()
  note?: string;
}
