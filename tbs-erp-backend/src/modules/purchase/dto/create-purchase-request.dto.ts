import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Currency } from '@prisma/client';

export class PurchaseRequestItemDto {
  @ApiProperty({ description: 'Item description', example: 'Cardboard boxes 60x40x30' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @ApiProperty({ description: 'Quantity', example: 100 })
  @IsNumber()
  @Min(0.01)
  qty: number;

  @ApiProperty({ description: 'Unit of measurement', example: 'pcs' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit: string;

  @ApiProperty({ description: 'Unit price', example: 15000 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ description: 'Currency', enum: Currency, default: Currency.VND })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}

export class CreatePurchaseRequestDto {
  @ApiPropertyOptional({ description: 'Vendor ID', example: 'clxyz123abc' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vendorId?: string;

  @ApiPropertyOptional({ description: 'Related order ID', example: 'clxyz789def' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  orderId?: string;

  @ApiPropertyOptional({ description: 'Notes', example: 'Urgent order for warehouse supplies' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiProperty({ description: 'Purchase request items', type: [PurchaseRequestItemDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequestItemDto)
  items: PurchaseRequestItemDto[];
}
