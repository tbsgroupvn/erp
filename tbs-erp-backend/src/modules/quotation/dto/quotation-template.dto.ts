import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  Max,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ShippingRoute, Branch, ServiceType } from '@prisma/client';

export class TemplateItemDto {
  @ApiProperty({ example: 'Tai nghe Bluetooth' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  productName: string;

  @ApiPropertyOptional({ example: 'https://item.taobao.com/item.htm?id=123' })
  @IsOptional()
  @IsUrl()
  productUrl?: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 150.5 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ example: 'CNY' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'Màu đen' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateTemplateDto {
  @ApiProperty({ example: 'Mẫu BG vận chuyển tiểu ngạch' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Mẫu cho khách hàng vận chuyển đường biển' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @ApiProperty({ enum: Branch })
  @IsEnum(Branch)
  branch: Branch;

  @ApiPropertyOptional({ enum: ShippingRoute })
  @IsOptional()
  @IsEnum(ShippingRoute)
  shippingRoute?: ShippingRoute;

  @ApiProperty({ type: [TemplateItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  items: TemplateItemDto[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class SaveAsTemplateDto {
  @ApiProperty({ example: 'Mẫu BG cho KH ABC' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class CreateFromTemplateDto {
  @ApiProperty({ example: 'clxyz123abc' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  validityDays?: number;

  @ApiPropertyOptional({ example: 'Ghi chú' })
  @IsOptional()
  @IsString()
  note?: string;
}
