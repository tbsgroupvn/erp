import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Currency } from '@prisma/client';

export class CreateArDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @ApiPropertyOptional({ description: 'Related order ID' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiProperty({ description: 'Amount receivable', example: 50000000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'Currency', enum: Currency, default: 'VND' })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({ description: 'Due date (ISO 8601)', example: '2025-03-15' })
  @IsNotEmpty()
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ description: 'Note' })
  @IsOptional()
  @IsString()
  note?: string;
}
