import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/**
 * DTO for receiving a package at Warehouse CN (China).
 * When a package arrives, the warehouse agent scans the tracking number
 * and optionally adds description and images.
 */
export class ReceivePackageDto {
  @ApiProperty({
    description: 'Chinese tracking number (barcode scan)',
    example: 'SF1234567890',
  })
  @IsString()
  @IsNotEmpty({ message: 'Tracking number is required' })
  @MinLength(3, { message: 'Tracking number must be at least 3 characters' })
  trackingNumberCN: string;

  @ApiProperty({
    description: 'Order ID this package belongs to',
    example: 'clxyz123abc',
  })
  @IsString()
  @IsNotEmpty({ message: 'Order ID is required' })
  orderId: string;

  @ApiPropertyOptional({
    description: 'Package description',
    example: 'Electronics - 2 boxes',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Photo URLs of the package',
    example: ['https://storage.tbs.vn/packages/img1.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Package has minor dent on corner',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
