import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min, Max, MaxLength } from 'class-validator';

export class AddVersionDto {
  @ApiProperty({ description: 'Original file name', example: 'contract-v2.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fileName: string;

  @ApiProperty({ description: 'File size in bytes', example: 102400 })
  @IsNumber()
  @Min(1)
  @Max(536870912) // 512 MB
  fileSize: number;

  @ApiProperty({ description: 'MIME type', example: 'application/pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  mimeType: string;

  @ApiProperty({ description: 'Storage key (S3 path)', example: 'documents/2025/03/abc123.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  storageKey: string;
}
