import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// DTO tao moi customer price override
export class CreateCustomerPriceOverrideDto {
  @ApiProperty({
    description: 'ID khach hang duoc ap dung gia rieng',
    example: 'clxxx...',
  })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({
    description: '% giam gia rieng cho khach hang nay (0 = khong giam)',
    example: 10,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  discountPct: number;

  @ApiPropertyOptional({
    description:
      'Gia co dinh rieng (VND/kg). Neu co, se ghi de discountPct. ' +
      'Truyen null de su dung discountPct.',
    example: 18000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  fixedPrice?: number;

  @ApiPropertyOptional({ description: 'Ghi chu noi bo', example: 'KH VIP dong y hop dong 6 thang' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    description: 'Ngay bat dau hieu luc (ISO 8601)',
    example: '2026-01-01',
  })
  @IsDateString()
  validFrom: string;

  @ApiPropertyOptional({
    description: 'Ngay het hieu luc. Null = khong het han.',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional({ description: 'Kich hoat override', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// DTO cap nhat customer price override (tat ca optional)
export class UpdateCustomerPriceOverrideDto {
  @ApiPropertyOptional({ description: '% giam gia moi', example: 15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  discountPct?: number;

  @ApiPropertyOptional({
    description: 'Gia co dinh moi. Truyen null de bo gia co dinh, chuyen sang dung discountPct.',
    example: null,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  fixedPrice?: number | null;

  @ApiPropertyOptional({ description: 'Ghi chu cap nhat' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Ngay bat dau hieu luc moi', example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({
    description: 'Ngay het hieu luc moi. Truyen null de bo gioi han ngay.',
    example: null,
  })
  @IsOptional()
  @IsDateString()
  validTo?: string | null;

  @ApiPropertyOptional({ description: 'Kich hoat/vo hieu' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// DTO simulate price
export class SimulatePriceDto {
  @ApiProperty({
    description: 'Can nang tinh gia (kg). Thuong la chargeable weight.',
    example: 350,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  weight: number;

  @ApiPropertyOptional({
    description: 'ID khach hang (de kiem tra customer override)',
    example: 'clxxx...',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description:
      'Ngay tinh gia (de kiem tra seasonal rule). Mac dinh = ngay hien tai. ' +
      'Format ISO 8601: 2026-02-01.',
    example: '2026-02-01',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}

// Ket qua simulate price chi tiet tung buoc
export interface SimulatePriceResult {
  rateCardId: string;
  rateCardCode: string;
  weight: number;
  // Buoc 1: base price
  basePrice: number;
  // Buoc 2: volume tier
  volumeTierApplied: {
    tierId: string;
    label: string;
    discountPct: number;
    fixedPrice: number | null;
    priceAfterTier: number;
  } | null;
  priceAfterVolumeTier: number;
  // Buoc 3: seasonal adjustment
  seasonalRuleApplied: {
    ruleId: string;
    name: string;
    adjustPct: number;
    priceAfterSeasonal: number;
  } | null;
  priceAfterSeasonal: number;
  // Buoc 4: customer override
  customerOverrideApplied: {
    overrideId: string;
    customerId: string;
    discountPct: number;
    fixedPrice: number | null;
    priceAfterOverride: number;
  } | null;
  // Gia cuoi cung
  finalPricePerKg: number;
  shippingAmount: number;
  // Mo ta tung buoc
  breakdown: string[];
}
