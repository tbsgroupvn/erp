import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

export enum VendorRatingCategory {
  QUALITY = 'QUALITY',
  DELIVERY = 'DELIVERY',
  PRICE = 'PRICE',
  COMMUNICATION = 'COMMUNICATION',
  GENERAL = 'GENERAL',
}

/** Categories that must be linked to a specific order */
const ORDER_SPECIFIC_CATEGORIES = [VendorRatingCategory.DELIVERY, VendorRatingCategory.QUALITY];

export class RateVendorDto {
  @ApiProperty({ description: 'Rating score (1-5)', example: 4, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @ApiPropertyOptional({
    description: 'Rating category',
    enum: VendorRatingCategory,
    example: 'QUALITY',
  })
  @IsOptional()
  @IsEnum(VendorRatingCategory)
  category?: VendorRatingCategory;

  @ApiPropertyOptional({
    description: 'Comment',
    example: 'Good packaging quality, timely delivery',
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({
    description: 'Related order ID (required for DELIVERY and QUALITY categories)',
  })
  @ValidateIf((o) => ORDER_SPECIFIC_CATEGORIES.includes(o.category))
  @IsNotEmpty({ message: 'orderId bat buoc khi danh gia DELIVERY hoac QUALITY' })
  @IsString()
  orderId?: string;
}
