import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  Min,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DeclarationType {
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
  TRANSIT = 'TRANSIT',
  RE_EXPORT = 'RE_EXPORT',
  TEMPORARY_IMPORT = 'TEMPORARY_IMPORT',
}

export enum ShippingMethod {
  SEA = 'SEA',
  AIR = 'AIR',
  ROAD = 'ROAD',
  RAIL = 'RAIL',
  MULTIMODAL = 'MULTIMODAL',
}

export class DeclarationItemDto {
  @ApiProperty({ description: 'HS code of the item', example: '8471.30.00' })
  @IsString()
  @IsNotEmpty()
  hsCode: string;

  @ApiProperty({ description: 'Description of the goods' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @ApiProperty({ description: 'Quantity of the item', example: 100 })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ description: 'Unit of measurement', example: 'KG' })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiProperty({ description: 'Unit price in declared currency', example: 25.5 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({ description: 'Total value of the item', example: 2550 })
  @IsNumber()
  @Min(0)
  totalValue: number;

  @ApiPropertyOptional({ description: 'Country of origin', example: 'CN' })
  @IsOptional()
  @IsString()
  countryOfOrigin?: string;
}

export class CustomsDeclarationDto {
  @ApiProperty({
    description: 'Type of customs declaration',
    enum: DeclarationType,
    example: DeclarationType.IMPORT,
  })
  @IsEnum(DeclarationType)
  declarationType: DeclarationType;

  @ApiProperty({
    description: 'Customs office code',
    example: '01HCM',
  })
  @IsString()
  @IsNotEmpty()
  customsOfficeCode: string;

  @ApiProperty({ description: 'Importer/Exporter tax code', example: '0123456789' })
  @IsString()
  @IsNotEmpty()
  taxCode: string;

  @ApiProperty({ description: 'Importer/Exporter company name' })
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty({
    description: 'Shipping method',
    enum: ShippingMethod,
    example: ShippingMethod.SEA,
  })
  @IsEnum(ShippingMethod)
  shippingMethod: ShippingMethod;

  @ApiProperty({ description: 'Bill of Lading / Airway Bill number' })
  @IsString()
  @IsNotEmpty()
  blAwbNumber: string;

  @ApiProperty({ description: 'Container number(s)', type: [String] })
  @IsArray()
  @IsString({ each: true })
  containerNumbers: string[];

  @ApiProperty({ description: 'Port of loading', example: 'CNSHA' })
  @IsString()
  @IsNotEmpty()
  portOfLoading: string;

  @ApiProperty({ description: 'Port of discharge', example: 'VNHPH' })
  @IsString()
  @IsNotEmpty()
  portOfDischarge: string;

  @ApiProperty({ description: 'Currency code', example: 'USD' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({ description: 'Total invoice value', example: 50000 })
  @IsNumber()
  @Min(0)
  totalInvoiceValue: number;

  @ApiProperty({ description: 'Freight cost', example: 2000 })
  @IsNumber()
  @Min(0)
  freightCost: number;

  @ApiProperty({ description: 'Insurance cost', example: 500 })
  @IsNumber()
  @Min(0)
  insuranceCost: number;

  @ApiProperty({ description: 'Declaration items', type: [DeclarationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeclarationItemDto)
  items: DeclarationItemDto[];

  @ApiPropertyOptional({ description: 'Expected arrival date' })
  @IsOptional()
  @IsDateString()
  expectedArrivalDate?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
