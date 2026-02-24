import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateDeclarationHeaderDto {
  @ApiPropertyOptional({
    description: 'Customs office code',
    example: '01A1',
  })
  @IsOptional()
  @IsString()
  customsOfficeCode?: string;

  @ApiPropertyOptional({
    description: 'Importer tax code (Ma so thue)',
    example: '0123456789',
  })
  @IsOptional()
  @IsString()
  importerTaxCode?: string;

  @ApiPropertyOptional({
    description: 'Importer name',
    example: 'CONG TY TNHH TBS LOGISTICS',
  })
  @IsOptional()
  @IsString()
  importerName?: string;

  @ApiPropertyOptional({
    description: 'Importer address',
    example: '123 Le Loi, Quan 1, TP HCM',
  })
  @IsOptional()
  @IsString()
  importerAddress?: string;

  @ApiPropertyOptional({
    description: 'Shipping method (SEA/ROAD/AIR)',
    example: 'SEA',
  })
  @IsOptional()
  @IsString()
  shippingMethod?: string;

  @ApiPropertyOptional({
    description: 'Bill of Lading / Airway Bill number',
    example: 'BL-2025-001234',
  })
  @IsOptional()
  @IsString()
  blAwbNumber?: string;

  @ApiPropertyOptional({
    description: 'Port of loading',
    example: 'Guangzhou',
  })
  @IsOptional()
  @IsString()
  portOfLoading?: string;

  @ApiPropertyOptional({
    description: 'Port of discharge',
    example: 'Hai Phong',
  })
  @IsOptional()
  @IsString()
  portOfDischarge?: string;

  @ApiPropertyOptional({
    description: 'Vessel name',
    example: 'COSCO SHIPPING ARIES',
  })
  @IsOptional()
  @IsString()
  vesselName?: string;

  @ApiPropertyOptional({
    description: 'Declared currency (USD, CNY, etc.)',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  declaredCurrency?: string;

  @ApiPropertyOptional({
    description: 'Declared freight cost',
    example: 1500.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  declaredFreight?: number;

  @ApiPropertyOptional({
    description: 'Declared insurance cost',
    example: 200.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  declaredInsurance?: number;

  @ApiPropertyOptional({
    description: 'Note / remarks',
    example: 'Container from Guangzhou batch #3',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
