import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// DTO tao moi volume tier
export class CreateVolumeTierDto {
  @ApiProperty({
    example: 100,
    description: 'Can nang toi thieu (kg) de ap dung tier nay. >= minWeight.',
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minWeight: number;

  @ApiPropertyOptional({
    example: 500,
    description:
      'Can nang toi da (kg). null = khong gioi han (ap dung cho moi khoi luong >= minWeight).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxWeight?: number;

  @ApiProperty({
    example: 10,
    description:
      '% giam gia tren don gia goc (pricePerKG). Dung khi fixedPrice = null. ' +
      'Vi du: 10 = giam 10%, gia cuoi = pricePerKG * (1 - 10/100).',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  discountPct: number;

  @ApiPropertyOptional({
    example: 22000,
    description:
      'Don gia co dinh VND/kg cho tier nay. ' +
      'Neu co gia tri nay thi bo qua discountPct, dung truc tiep fixedPrice * weight lam gia cuoc.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  fixedPrice?: number;
}

// DTO cap nhat volume tier (tat ca field la optional)
export class UpdateVolumeTierDto {
  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minWeight?: number;

  @ApiPropertyOptional({
    example: null,
    description: 'Truyen null de xoa gioi han tren (tier ap dung khong gioi han).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxWeight?: number | null;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  discountPct?: number;

  @ApiPropertyOptional({
    example: null,
    description: 'Truyen null de xoa fixed price, chuyen sang dung discountPct.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  fixedPrice?: number | null;
}

// DTO query calculate-price
export class CalculatePriceQueryDto {
  @ApiProperty({
    example: 350,
    description: 'Can nang tinh cuoc (kg). Thuong la chargeable weight sau khi quy doi CBM.',
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  weight: number;

  @ApiPropertyOptional({
    description: 'ID khach hang (de kiem tra customer price override neu co)',
    example: 'clxxx...',
  })
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Ngay tinh gia (ISO 8601). Mac dinh = hom nay. Dung de kiem tra seasonal rule.',
    example: '2026-02-01',
  })
  @IsOptional()
  date?: string;
}

// Ket qua tinh gia
export interface PriceBreakdown {
  rateCardId: string;
  rateCardCode: string;
  weight: number;
  basePrice: number;       // pricePerKG goc (VND/kg)
  tierApplied: TierInfo | null;
  finalPricePerKg: number; // don gia sau khi ap tier
  shippingAmount: number;  // finalPricePerKg * weight (da round)
}

export interface TierInfo {
  tierId: string;
  minWeight: number;
  maxWeight: number | null;
  discountPct: number;
  fixedPrice: number | null;
  // mo ta tier duoc ap dung
  label: string;
}
