import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsEnum, IsNumber, IsOptional, IsBoolean,
  IsDateString, Min, IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RateCardOrigin, RateCardDestination, ShippingRoute, ServiceType, CustomerTier } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class CreateRateCardSurchargeDto {
  @ApiProperty({ example: 'Phí handling' })
  @IsString()
  name: string;

  @ApiProperty({ example: 150000 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  percent?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPercent?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class CreateRateCardDiscountDto {
  @ApiProperty({ enum: CustomerTier })
  @IsEnum(CustomerTier)
  customerTier: CustomerTier;

  @ApiProperty({ example: 5, description: '% chiết khấu' })
  @IsNumber()
  @Min(0)
  discountPercent: number;
}

export class CreateRateCardDto {
  @ApiProperty({ example: 'Giá biển Nghĩa Ô → HN T3/2026' })
  @IsString()
  name: string;

  @ApiProperty({ enum: RateCardOrigin, default: RateCardOrigin.YIWU })
  @IsEnum(RateCardOrigin)
  origin: RateCardOrigin;

  @ApiProperty({ enum: RateCardDestination, default: RateCardDestination.HANOI })
  @IsEnum(RateCardDestination)
  destination: RateCardDestination;

  @ApiProperty({ enum: ShippingRoute })
  @IsEnum(ShippingRoute)
  transportMode: ShippingRoute;

  @ApiPropertyOptional({ enum: ServiceType, default: ServiceType.VCT })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiProperty({ example: 1200000, description: 'VND/CBM' })
  @IsNumber()
  @Min(0)
  pricePerCBM: number;

  @ApiProperty({ example: 25000, description: 'VND/KG' })
  @IsNumber()
  @Min(0)
  pricePerKG: number;

  @ApiPropertyOptional({ example: 300000, description: 'Cước tối thiểu VND' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minChargeAmount?: number;

  @ApiProperty({ example: '2026-03-01' })
  @IsDateString()
  validFrom: string;

  @ApiPropertyOptional({ example: '2026-05-31', description: 'null = vô thời hạn' })
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ type: [CreateRateCardSurchargeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRateCardSurchargeDto)
  surcharges?: CreateRateCardSurchargeDto[];

  @ApiPropertyOptional({ type: [CreateRateCardDiscountDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRateCardDiscountDto)
  discounts?: CreateRateCardDiscountDto[];
}

export class RateCardQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: RateCardOrigin })
  @IsOptional()
  @IsEnum(RateCardOrigin)
  origin?: RateCardOrigin;

  @ApiPropertyOptional({ enum: RateCardDestination })
  @IsOptional()
  @IsEnum(RateCardDestination)
  destination?: RateCardDestination;

  @ApiPropertyOptional({ enum: ShippingRoute })
  @IsOptional()
  @IsEnum(ShippingRoute)
  transportMode?: ShippingRoute;

  @ApiPropertyOptional({ enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class LookupRateCardDto {
  @ApiProperty({ enum: RateCardOrigin })
  @IsEnum(RateCardOrigin)
  origin: RateCardOrigin;

  @ApiProperty({ enum: RateCardDestination })
  @IsEnum(RateCardDestination)
  destination: RateCardDestination;

  @ApiProperty({ enum: ShippingRoute })
  @IsEnum(ShippingRoute)
  transportMode: ShippingRoute;

  @ApiPropertyOptional({ enum: ServiceType, default: ServiceType.VCT })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiPropertyOptional({ example: 2.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cbm?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  kg?: number;

  @ApiPropertyOptional({ enum: CustomerTier })
  @IsOptional()
  @IsEnum(CustomerTier)
  customerTier?: CustomerTier;

  @ApiPropertyOptional({
    description: 'ID khach hang: de kiem tra customer price override (uu tien cao nhat)',
    example: 'clxxx...',
  })
  @IsOptional()
  @IsString()
  customerId?: string;
}
