import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  MinLength,
} from 'class-validator';
import { CostType, Currency } from '@prisma/client';

export class CreateCostAdjustmentDto {
  @ApiProperty({ description: 'Order ID (completed order)', example: 'clxyz123abc' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: 'Cost type', enum: CostType })
  @IsEnum(CostType)
  costType: CostType;

  @ApiProperty({ description: 'Adjustment amount', example: 500000 })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount: number;

  @ApiPropertyOptional({ description: 'Currency', enum: Currency, default: 'VND' })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({ description: 'Description of the cost adjustment', example: 'Phi luu bai kiem hoa hai quan' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Description must be at least 5 characters' })
  description: string;

  @ApiPropertyOptional({ description: 'Invoice reference from vendor', example: 'INV-2026-0456' })
  @IsOptional()
  @IsString()
  invoiceRef?: string;

  @ApiPropertyOptional({ description: 'Attachment URLs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @ApiPropertyOptional({ description: 'Vendor name', example: 'ABC Logistics Co.' })
  @IsOptional()
  @IsString()
  vendorName?: string;
}
