import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { DocumentCategory } from '@prisma/client';
import { FILE_UPLOAD_LIMITS } from '@common/constants/file-upload.constants';

/** Combined MIME types for document uploads: DOCUMENT + IMAGE types */
const ALLOWED_MIME_TYPES = [
  ...FILE_UPLOAD_LIMITS.DOCUMENT.allowedMimeTypes,
  ...FILE_UPLOAD_LIMITS.IMAGE.allowedMimeTypes,
];

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

  @ApiProperty({ description: 'File size in bytes (max 10 MB)' })
  @IsNumber()
  @Min(1)
  @Max(FILE_UPLOAD_LIMITS.DOCUMENT.maxSizeBytes)
  fileSize: number;

  @ApiProperty({
    description: 'MIME type',
    example: 'application/pdf',
    enum: ALLOWED_MIME_TYPES,
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_MIME_TYPES)
  mimeType: string;

  @ApiProperty({ description: 'Storage key (S3 path)' })
  @IsString()
  @IsNotEmpty()
  storageKey: string;
}
