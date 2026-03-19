import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsIn, Min, Max, MaxLength } from 'class-validator';
import { FILE_UPLOAD_LIMITS } from '@common/constants/file-upload.constants';

/** Combined MIME types for document versions: DOCUMENT + IMAGE types */
const ALLOWED_MIME_TYPES = [
  ...FILE_UPLOAD_LIMITS.DOCUMENT.allowedMimeTypes,
  ...FILE_UPLOAD_LIMITS.IMAGE.allowedMimeTypes,
];

export class AddVersionDto {
  @ApiProperty({ description: 'Original file name', example: 'contract-v2.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fileName: string;

  @ApiProperty({ description: 'File size in bytes (max 10 MB)', example: 102400 })
  @IsNumber()
  @Min(1)
  @Max(FILE_UPLOAD_LIMITS.DOCUMENT.maxSizeBytes)
  fileSize: number;

  @ApiProperty({ description: 'MIME type', example: 'application/pdf', enum: ALLOWED_MIME_TYPES })
  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_MIME_TYPES)
  @MaxLength(255)
  mimeType: string;

  @ApiProperty({ description: 'Storage key (S3 path)', example: 'documents/2025/03/abc123.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  storageKey: string;
}
