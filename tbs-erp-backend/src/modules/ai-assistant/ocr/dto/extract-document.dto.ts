import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DocumentExtractionType {
  PACKING_LIST = 'PACKING_LIST',
  INVOICE = 'INVOICE',
  CUSTOMS_DECLARATION = 'CUSTOMS_DECLARATION',
}

export class ExtractDocumentDto {
  @ApiProperty({ description: 'Du lieu anh dang base64 (PNG, JPG, WEBP)' })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @ApiPropertyOptional({ description: 'Dinh dang MIME cua anh', default: 'image/jpeg' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiProperty({
    description: 'Loai chung tu can boc tach',
    enum: DocumentExtractionType,
    default: DocumentExtractionType.PACKING_LIST,
  })
  @IsEnum(DocumentExtractionType)
  type: DocumentExtractionType;

  @ApiPropertyOptional({ description: 'Ma don hang lien ket (tuy chon)' })
  @IsOptional()
  @IsString()
  orderId?: string;
}

// DTO cho tung anh trong batch request
export class BatchImageItem {
  @ApiProperty({ description: 'Du lieu anh dang base64' })
  @IsString()
  @IsNotEmpty()
  base64: string;

  @ApiPropertyOptional({ description: 'MIME type, mac dinh image/jpeg' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiProperty({ enum: DocumentExtractionType, description: 'Loai chung tu' })
  @IsEnum(DocumentExtractionType)
  type: DocumentExtractionType;
}

// DTO batch: nhan nhieu anh cung luc (toi da 10)
export class BatchExtractDocumentDto {
  @ApiProperty({
    type: [BatchImageItem],
    description: 'Danh sach anh can boc tach (toi da 10)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => BatchImageItem)
  images: BatchImageItem[];
}

export class PackingListItem {
  nameCn: string;
  nameVi: string;
  quantity: number;
  weightKg: number;
  tracking?: string;
}

export class PackingListResult {
  items: PackingListItem[];
  totalWeightKg: number;
  totalItems: number;
  shipper?: string;
  trackingNumbers: string[];
  rawResponse?: string;
}

// DTO chinh sua ket qua OCR truoc khi apply
export class CorrectOcrResultDto {
  @ApiProperty({ description: 'Ket qua OCR goc can chinh sua' })
  originalResult: PackingListResult;

  @ApiProperty({
    description: 'Cac truong chinh sua. Co the chinh items, totalWeightKg, shipper, v.v.',
    example: {
      totalWeightKg: 12.5,
      shipper: 'SF Express',
      items: [{ nameCn: 'test', nameVi: 'thu nghiem', quantity: 2, weightKg: 1.5, tracking: 'SF123' }],
    },
  })
  corrections: Partial<PackingListResult>;
}

// Ket qua 1 anh trong batch (bao gom index va co the co loi)
export interface BatchResultItem {
  index: number;
  status: 'fulfilled' | 'rejected';
  result?: PackingListResult;
  error?: string;
}

// Ket qua toan bo batch
export interface BatchExtractResult {
  total: number;
  succeeded: number;
  failed: number;
  results: BatchResultItem[];
}
