import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';

export class PickupBookingDto {
  @ApiProperty({ description: 'Carrier code (e.g., GHTK, GHN, VIETTEL_POST)', example: 'GHN' })
  @IsString()
  @IsNotEmpty()
  carrierCode: string;

  @ApiProperty({ description: 'Pickup address' })
  @IsString()
  @IsNotEmpty()
  pickupAddress: string;

  @ApiProperty({ description: 'Pickup city/province', example: 'Ho Chi Minh City' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'Pickup district' })
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiPropertyOptional({ description: 'Pickup ward' })
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiProperty({ description: 'Contact name at pickup location' })
  @IsString()
  @IsNotEmpty()
  contactName: string;

  @ApiProperty({ description: 'Contact phone number' })
  @IsString()
  @IsNotEmpty()
  contactPhone: string;

  @ApiProperty({ description: 'Requested pickup date (ISO 8601)', example: '2025-06-15' })
  @IsDateString()
  pickupDate: string;

  @ApiPropertyOptional({ description: 'Preferred pickup time (HH:mm)', example: '09:00' })
  @IsOptional()
  @IsString()
  preferredTime?: string;

  @ApiProperty({ description: 'Estimated number of packages', example: 5 })
  @IsNumber()
  @Min(1)
  estimatedPackages: number;

  @ApiPropertyOptional({ description: 'Estimated total weight in KG', example: 25 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedWeightKg?: number;

  @ApiPropertyOptional({ description: 'Special instructions for the driver' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialInstructions?: string;

  @ApiPropertyOptional({ description: 'ERP order or shipment reference' })
  @IsOptional()
  @IsString()
  erpReference?: string;
}
