import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { DocumentCategory } from '@prisma/client';

export class UploadDocumentDto {
  @ApiProperty({ description: 'Document name', example: 'Contract Q1 2025' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Category', enum: DocumentCategory })
  @IsEnum(DocumentCategory)
  category: DocumentCategory;

  @ApiProperty({
    description: 'Entity type (ORDER, CUSTOMER, CONTAINER, PACKAGE)',
    example: 'ORDER',
  })
  @IsString()
  @IsNotEmpty()
  entityType: string;

  @ApiProperty({ description: 'Entity ID' })
  @IsString()
  @IsNotEmpty()
  entityId: string;

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // File metadata (populated from file upload)
  @ApiProperty({ description: 'Original file name' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ description: 'File size in bytes' })
  @IsNumber()
  @Min(1)
  fileSize: number;

  @ApiProperty({ description: 'MIME type', example: 'application/pdf' })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({ description: 'Storage key (S3 path)' })
  @IsString()
  @IsNotEmpty()
  storageKey: string;
}
