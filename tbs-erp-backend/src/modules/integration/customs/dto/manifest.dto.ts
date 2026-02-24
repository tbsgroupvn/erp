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

export enum ManifestType {
  INWARD = 'INWARD',
  OUTWARD = 'OUTWARD',
}

export class ManifestItemDto {
  @ApiProperty({ description: 'Bill of Lading number' })
  @IsString()
  @IsNotEmpty()
  blNumber: string;

  @ApiProperty({ description: 'Consignee name' })
  @IsString()
  @IsNotEmpty()
  consigneeName: string;

  @ApiProperty({ description: 'Consignee tax code' })
  @IsString()
  @IsNotEmpty()
  consigneeTaxCode: string;

  @ApiProperty({ description: 'Description of goods' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  goodsDescription: string;

  @ApiProperty({ description: 'Number of packages', example: 10 })
  @IsNumber()
  @Min(1)
  numberOfPackages: number;

  @ApiProperty({ description: 'Gross weight in KG', example: 500 })
  @IsNumber()
  @Min(0)
  grossWeightKg: number;

  @ApiProperty({ description: 'Volume in CBM', example: 2.5 })
  @IsNumber()
  @Min(0)
  volumeCbm: number;

  @ApiPropertyOptional({ description: 'Container number' })
  @IsOptional()
  @IsString()
  containerNumber?: string;

  @ApiPropertyOptional({ description: 'Seal number' })
  @IsOptional()
  @IsString()
  sealNumber?: string;
}

export class ManifestDto {
  @ApiProperty({
    description: 'Type of manifest',
    enum: ManifestType,
    example: ManifestType.INWARD,
  })
  @IsEnum(ManifestType)
  manifestType: ManifestType;

  @ApiProperty({ description: 'Vessel/Flight name' })
  @IsString()
  @IsNotEmpty()
  vesselName: string;

  @ApiProperty({ description: 'Voyage/Flight number' })
  @IsString()
  @IsNotEmpty()
  voyageNumber: string;

  @ApiProperty({ description: 'Port of loading code', example: 'CNSHA' })
  @IsString()
  @IsNotEmpty()
  portOfLoading: string;

  @ApiProperty({ description: 'Port of discharge code', example: 'VNHPH' })
  @IsString()
  @IsNotEmpty()
  portOfDischarge: string;

  @ApiProperty({ description: 'Estimated arrival date' })
  @IsDateString()
  estimatedArrivalDate: string;

  @ApiProperty({ description: 'Carrier/Shipping line name' })
  @IsString()
  @IsNotEmpty()
  carrierName: string;

  @ApiProperty({ description: 'Manifest items', type: [ManifestItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManifestItemDto)
  items: ManifestItemDto[];

  @ApiPropertyOptional({ description: 'Additional remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}
