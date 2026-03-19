import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

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
  @SanitizeHtmlStrict()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Photo URLs of the package (required - Layer 4A)',
    example: ['https://storage.tbs.vn/packages/img1.jpg'],
  })
  @IsArray({ message: 'Bắt buộc chụp ảnh kiện hàng khi nhận tại kho TQ' })
  @ArrayMinSize(1, { message: 'Bắt buộc ít nhất 1 ảnh kiện hàng khi nhận tại kho TQ' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  imageUrls: string[];

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Package has minor dent on corner',
  })
  @SanitizeHtmlStrict()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'KhoTQ-2: Force receive even if tracking number is duplicate',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  forceReceive?: boolean;
}
