import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  Max,
  ValidateNested,
} from 'class-validator';
import { Currency, ShippingRoute, Branch, ServiceType } from '@prisma/client';

export class CreateQuotationItemDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Wireless Bluetooth Headphones',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Product name must be at least 2 characters' })
  productName: string;

  @ApiPropertyOptional({
    description: 'Product URL from Chinese marketplace',
    example: 'https://item.taobao.com/item.htm?id=123456',
  })
  @IsOptional()
  @IsUrl({}, { message: 'productUrl must be a valid URL' })
  productUrl?: string;

  @ApiProperty({
    description: 'Quantity of items',
    example: 10,
    minimum: 1,
  })
  @IsNumber()
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity: number;

  @ApiProperty({
    description: 'Unit price of the item',
    example: 150.5,
    minimum: 0,
  })
  @IsNumber()
  @Min(0, { message: 'Unit price must not be negative' })
  unitPrice: number;

  @ApiPropertyOptional({
    description: 'Currency of the unit price',
    enum: Currency,
    default: Currency.CNY,
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({
    description: 'Additional notes for this item',
    example: 'Color: Black, Size: L',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateQuotationDto {
  @ApiProperty({
    description: 'Customer ID',
    example: 'clxyz123abc',
  })
  @IsString()
  @IsNotEmpty({ message: 'Customer ID is required' })
  customerId: string;

  @ApiProperty({
    description: 'Type of service',
    enum: ServiceType,
    example: ServiceType.MHH,
  })
  @IsEnum(ServiceType, { message: 'Invalid service type' })
  serviceType: ServiceType;

  @ApiProperty({
    description: 'Branch office',
    enum: Branch,
    example: Branch.HN,
  })
  @IsEnum(Branch, { message: 'Invalid branch' })
  branch: Branch;

  @ApiPropertyOptional({
    description: 'Shipping route',
    enum: ShippingRoute,
    example: ShippingRoute.SEA,
  })
  @IsOptional()
  @IsEnum(ShippingRoute, { message: 'Invalid shipping route' })
  shippingRoute?: ShippingRoute;

  @ApiPropertyOptional({
    description: 'Discount percentage (0-100)',
    example: 5,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Discount percent must not be negative' })
  @Max(100, { message: 'Discount percent must not exceed 100' })
  discountPercent?: number;

  @ApiProperty({
    description: 'Quotation items',
    type: [CreateQuotationItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  items: CreateQuotationItemDto[];

  @ApiPropertyOptional({
    description: 'Validity period in days',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Validity days must be at least 1' })
  validityDays?: number;

  @ApiPropertyOptional({
    description: 'Quotation notes',
    example: 'Special pricing for bulk order',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
