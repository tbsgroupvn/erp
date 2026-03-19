import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ServiceType, ShippingRoute, Branch, Currency } from '@prisma/client';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class CreateOrderItemDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Wireless Bluetooth Headphones',
  })
  @SanitizeHtmlStrict()
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
  @MaxLength(2000)
  productUrl?: string;

  @ApiProperty({
    description: 'Quantity of items',
    example: 10,
    minimum: 1,
  })
  @IsNumber()
  @Min(1, { message: 'Quantity must be at least 1' })
  @Max(1000000)
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
  @SanitizeHtmlStrict()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateOrderDto {
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

  @ApiProperty({
    description: 'Order items',
    type: [CreateOrderItemDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 item is required' })
  @ArrayMaxSize(500, { message: 'Maximum 500 items per order' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiPropertyOptional({
    description: 'Order notes',
    example: 'Please inspect quality before shipping',
  })
  @SanitizeHtmlStrict()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
