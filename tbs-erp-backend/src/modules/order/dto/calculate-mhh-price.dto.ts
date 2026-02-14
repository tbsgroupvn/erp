import {
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  IsIn,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CustomerTier } from '@prisma/client';

export class CalculateMHHPriceDto {
  @ApiProperty({
    description: 'Product price per unit in CNY',
    example: 100,
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Product price must not be negative' })
  productPriceCNY: number;

  @ApiProperty({
    description: 'Number of items to purchase',
    example: 10,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity: number;

  @ApiPropertyOptional({
    description: 'Domestic shipping cost within China per unit (CNY)',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Domestic shipping cost must not be negative' })
  domesticShippingCNY?: number;

  @ApiPropertyOptional({
    description: 'Estimated weight per unit in kilograms',
    example: 0.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Estimated weight must not be negative' })
  estimatedWeightKg?: number;

  @ApiPropertyOptional({
    description: 'Shipping route from China to Vietnam',
    enum: ['SEA', 'ROAD', 'AIR'],
    example: 'SEA',
  })
  @IsOptional()
  @IsString()
  @IsIn(['SEA', 'ROAD', 'AIR'], {
    message: 'Shipping route must be one of: SEA, ROAD, AIR',
  })
  shippingRoute?: 'SEA' | 'ROAD' | 'AIR';

  @ApiPropertyOptional({
    description: 'Customer tier for service fee calculation',
    enum: CustomerTier,
    example: 'REGULAR',
  })
  @IsOptional()
  @IsEnum(CustomerTier, { message: 'Invalid customer tier' })
  customerTier?: CustomerTier;
}
