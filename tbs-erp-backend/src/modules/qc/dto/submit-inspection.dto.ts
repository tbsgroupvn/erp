import { IsInt, IsOptional, IsString, IsArray, IsObject, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitInspectionDto {
  @ApiProperty({ description: 'Total quantity inspected' })
  @IsInt()
  inspectedQuantity: number;

  @ApiProperty({ description: 'Quantity that passed inspection' })
  @IsInt()
  passedQuantity: number;

  @ApiProperty({ description: 'Quantity that failed inspection' })
  @IsInt()
  failedQuantity: number;

  @ApiPropertyOptional({ description: 'Overall quality rating (1-5)', minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating?: number;

  @ApiPropertyOptional({
    description: 'Checklist results as key-value pairs',
    example: { correct_item: true, correct_qty: true, no_damage: false },
  })
  @IsOptional()
  @IsObject()
  checklistResults?: Record<string, boolean>;

  @ApiPropertyOptional({ description: 'Inspector notes about the inspection' })
  @IsOptional()
  @IsString()
  inspectorNote?: string;

  @ApiPropertyOptional({ description: 'Description of defects found' })
  @IsOptional()
  @IsString()
  defectDescription?: string;

  @ApiPropertyOptional({ description: 'General photo URLs', type: [String] })
  @IsOptional()
  @IsArray()
  photoUrls?: string[];

  @ApiPropertyOptional({ description: 'Detail photo URLs', type: [String] })
  @IsOptional()
  @IsArray()
  detailPhotoUrls?: string[];

  @ApiPropertyOptional({ description: 'Defect photo URLs', type: [String] })
  @IsOptional()
  @IsArray()
  defectPhotoUrls?: string[];
}
