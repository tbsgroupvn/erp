import { IsString, IsOptional, IsDateString, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadCarrierReconDto {
  @ApiProperty({ description: 'Ten hang van chuyen: GHTK, GHN, VIETTEL_POST, JT, OTHER' })
  @IsString()
  carrierName: string;

  @ApiPropertyOptional({ description: 'Ngay bat dau ky doi soat' })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({ description: 'Ngay ket thuc ky doi soat' })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional({ description: 'Custom column mapping override preset' })
  @IsOptional()
  @IsObject()
  customMapping?: Record<string, string>;
}
