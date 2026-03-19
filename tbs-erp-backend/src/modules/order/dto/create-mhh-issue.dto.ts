import { IsString, IsOptional, IsEnum, IsArray, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MHHIssueType, ComplaintSeverity } from '@prisma/client';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class CreateMHHIssueDto {
  @ApiProperty({
    description: 'ID of the related order',
    example: 'clxyz123abc',
  })
  @IsString()
  @IsNotEmpty({ message: 'Order ID is required' })
  orderId: string;

  @ApiPropertyOptional({
    description: 'ID of the specific order item (if issue is item-specific)',
    example: 'clxyz456def',
  })
  @IsOptional()
  @IsString()
  orderItemId?: string;

  @ApiPropertyOptional({
    description: 'ID of the related package',
    example: 'clxyz789ghi',
  })
  @IsOptional()
  @IsString()
  packageId?: string;

  @ApiPropertyOptional({
    description: 'ID of the related supplier order',
    example: 'clxyz012jkl',
  })
  @IsOptional()
  @IsString()
  supplierOrderId?: string;

  @ApiProperty({
    description: 'Type of issue encountered',
    enum: MHHIssueType,
    example: MHHIssueType.DAMAGED,
  })
  @IsEnum(MHHIssueType, { message: 'Invalid issue type' })
  issueType: MHHIssueType;

  @ApiPropertyOptional({
    description: 'Severity level of the issue',
    enum: ComplaintSeverity,
    example: ComplaintSeverity.MEDIUM,
  })
  @IsOptional()
  @IsEnum(ComplaintSeverity, { message: 'Invalid severity level' })
  severity?: ComplaintSeverity;

  @ApiProperty({
    description: 'Detailed description of the issue',
    example: 'The product arrived with visible dents on the surface',
  })
  @SanitizeHtmlStrict()
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  @MinLength(10, { message: 'Description must be at least 10 characters' })
  description: string;

  @ApiPropertyOptional({
    description: 'List of attachment URLs (e.g. photos of the issue)',
    type: [String],
    example: ['https://storage.example.com/issues/photo1.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @ApiPropertyOptional({
    description: 'List of evidence/document URLs (e.g. receipts, shipping labels)',
    type: [String],
    example: ['https://storage.example.com/evidence/receipt1.pdf'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceUrls?: string[];
}
