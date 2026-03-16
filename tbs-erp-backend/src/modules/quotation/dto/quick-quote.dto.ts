import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsEnum, IsNumber, IsOptional, IsArray,
  ValidateNested, Min, IsUrl, IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceType, ShippingRoute, RateCardOrigin, RateCardDestination, Branch } from '@prisma/client';

export class QuickQuoteItemDto {
  @ApiProperty({ example: 'Bình giữ nhiệt 500ml' })
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiPropertyOptional({ example: 'Màu bạc, dung tích 500ml' })
  @IsOptional()
  @IsString()
  productDescription?: string;

  @ApiPropertyOptional({ example: 'https://detail.1688.com/offer/...' })
  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @ApiPropertyOptional({ example: 'https://img.example.com/product.jpg' })
  @IsOptional()
  @IsString()
  productImageUrl?: string;

  @ApiPropertyOptional({ description: 'Vendor ID nếu chọn từ danh sách NCC đã duyệt' })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiPropertyOptional({ example: 'Yiwu Bottle Co.' })
  @IsOptional()
  @IsString()
  vendorName?: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 'cái', default: 'cái' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ example: 12.5, description: 'Đơn giá NCC (CNY)' })
  @IsNumber()
  @Min(0)
  unitPriceCNY: number;

  @ApiPropertyOptional({ example: 0.5, description: 'Phí ship nội địa TQ (CNY/item)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  domesticShippingCNY?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class QuickQuoteDto {
  @ApiProperty({ example: 'clxyz123abc', description: 'Customer ID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ enum: ServiceType, example: ServiceType.VCT })
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @ApiProperty({ enum: RateCardOrigin, example: RateCardOrigin.YIWU })
  @IsEnum(RateCardOrigin)
  origin: RateCardOrigin;

  @ApiProperty({ enum: RateCardDestination, example: RateCardDestination.HANOI })
  @IsEnum(RateCardDestination)
  destination: RateCardDestination;

  @ApiProperty({ enum: ShippingRoute, example: ShippingRoute.SEA })
  @IsEnum(ShippingRoute)
  transportMode: ShippingRoute;

  // --- MHH: danh sách sản phẩm ---
  @ApiPropertyOptional({ type: [QuickQuoteItemDto], description: 'Bắt buộc với MHH mode' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuickQuoteItemDto)
  items?: QuickQuoteItemDto[];

  // --- Vận chuyển ---
  @ApiPropertyOptional({ example: 2.5, description: 'CBM ước tính' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cbm?: number;

  @ApiPropertyOptional({ example: 100, description: 'KG ước tính' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  kg?: number;

  // --- Override ---
  @ApiPropertyOptional({ example: 5, description: 'Chiết khấu override (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountOverride?: number;

  @ApiPropertyOptional({ enum: Branch, example: Branch.HN, description: 'Chi nhánh (auto-fill từ user nếu không truyền)' })
  @IsOptional()
  @IsEnum(Branch)
  branch?: Branch;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
