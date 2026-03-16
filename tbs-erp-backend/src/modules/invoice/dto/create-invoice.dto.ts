import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateInvoiceItemDto } from './create-invoice-item.dto';

export class CreateInvoiceDto {
  @ApiPropertyOptional({ description: 'Related order ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  orderId?: string;

  @ApiProperty({ description: 'Customer ID' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  customerId: string;

  @ApiPropertyOptional({
    description: 'Invoice type',
    example: 'GTGT',
    default: 'GTGT',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  type?: string;

  @ApiProperty({ description: 'Invoice amount (before tax)', example: 50000000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({
    description: 'Tax rate (default 0.10 = 10%). Ignored when items are provided.',
    example: 0.1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  taxRate?: number;

  @ApiPropertyOptional({
    description:
      'Invoice line items with per-item tax types. When provided, totals are computed from items.',
    type: [CreateInvoiceItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items?: CreateInvoiceItemDto[];
}
