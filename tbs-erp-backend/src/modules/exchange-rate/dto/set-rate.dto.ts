import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Currency } from '@prisma/client';

export class SetRateDto {
  @ApiProperty({ description: 'Source currency', enum: Currency, example: Currency.CNY })
  @IsEnum(Currency)
  fromCurrency: Currency;

  @ApiProperty({ description: 'Target currency', enum: Currency, example: Currency.VND })
  @IsEnum(Currency)
  toCurrency: Currency;

  @ApiProperty({ description: 'Exchange rate', example: 3450.5 })
  @IsNumber()
  @Min(0)
  rate: number;

  @ApiProperty({ description: 'Effective date (ISO 8601)', example: '2025-06-15' })
  @IsDateString()
  effectiveDate: string;

  @ApiPropertyOptional({ description: 'Rate source', example: 'VIETCOMBANK', default: 'MANUAL' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'User ID who sets the rate (for audit trail)' })
  @IsOptional()
  @IsString()
  userId?: string;
}
