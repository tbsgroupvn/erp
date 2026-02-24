import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ShippingAddressDto {
  @ApiProperty({ description: 'Full address' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ description: 'City/Province', example: 'Ho Chi Minh City' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'District', example: 'District 1' })
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiPropertyOptional({ description: 'Ward' })
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiProperty({ description: 'Country code', example: 'VN' })
  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @ApiPropertyOptional({ description: 'Postal code' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiProperty({ description: 'Contact name' })
  @IsString()
  @IsNotEmpty()
  contactName: string;

  @ApiProperty({ description: 'Contact phone number' })
  @IsString()
  @IsNotEmpty()
  contactPhone: string;
}

export class ShippingPackageDto {
  @ApiProperty({ description: 'Weight in KG', example: 5.5 })
  @IsNumber()
  @Min(0.01)
  weightKg: number;

  @ApiProperty({ description: 'Length in CM', example: 40 })
  @IsNumber()
  @Min(1)
  lengthCm: number;

  @ApiProperty({ description: 'Width in CM', example: 30 })
  @IsNumber()
  @Min(1)
  widthCm: number;

  @ApiProperty({ description: 'Height in CM', example: 20 })
  @IsNumber()
  @Min(1)
  heightCm: number;

  @ApiPropertyOptional({ description: 'Declared value for insurance', example: 1000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  declaredValue?: number;

  @ApiPropertyOptional({ description: 'Package description' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class ShippingRateDto {
  @ApiProperty({ description: 'Origin address', type: ShippingAddressDto })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  origin: ShippingAddressDto;

  @ApiProperty({ description: 'Destination address', type: ShippingAddressDto })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  destination: ShippingAddressDto;

  @ApiProperty({ description: 'Packages to ship', type: [ShippingPackageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingPackageDto)
  packages: ShippingPackageDto[];

  @ApiPropertyOptional({
    description: 'Specific carriers to query (if empty, all configured carriers will be queried)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  carriers?: string[];

  @ApiPropertyOptional({ description: 'Whether COD (Cash on Delivery) is required' })
  @IsOptional()
  codAmount?: number;
}
