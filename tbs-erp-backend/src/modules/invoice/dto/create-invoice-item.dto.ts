import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator';

export enum TaxType {
  NO_TAX = 'NO_TAX',
  ZERO_PERCENT = 'ZERO_PERCENT',
  EIGHT_PERCENT = 'EIGHT_PERCENT',
  TEN_PERCENT = 'TEN_PERCENT',
}

export class CreateInvoiceItemDto {
  @ApiProperty({ description: 'Item description', example: 'Dich vu van chuyen hang hoa' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiProperty({ description: 'Quantity', example: 10 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ description: 'Unit price (before tax)', example: 500000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({
    description: 'Tax type for this item',
    enum: TaxType,
    example: TaxType.TEN_PERCENT,
  })
  @IsEnum(TaxType)
  taxType: TaxType;
}
