import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Currency } from '@prisma/client';

export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'Vendor ID', example: 'clxyz123abc' })
  @IsString()
  @IsNotEmpty()
  vendorId: string;

  @ApiPropertyOptional({ description: 'Related order ID' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Currency', enum: Currency, default: Currency.CNY })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
