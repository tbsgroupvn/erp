import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ComplaintType, ComplaintSeverity } from '@prisma/client';

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
  @IsOptional()
  @IsString()
  investigationNote?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
