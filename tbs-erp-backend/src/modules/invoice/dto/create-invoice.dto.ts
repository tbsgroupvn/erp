import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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
    description: 'Tax rate (default 0.10 = 10%)',
    example: 0.1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  taxRate?: number;
}
