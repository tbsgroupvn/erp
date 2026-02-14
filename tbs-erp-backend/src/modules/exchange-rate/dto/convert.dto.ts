import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { Currency } from '@prisma/client';

export class ConvertDto {
  @ApiProperty({ description: 'Amount to convert', example: 1000 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Source currency', enum: Currency, example: Currency.CNY })
  @IsEnum(Currency)
  from: Currency;

  @ApiProperty({ description: 'Target currency', enum: Currency, example: Currency.VND })
  @IsEnum(Currency)
  to: Currency;

  @ApiPropertyOptional({ description: 'Date for historical rate (ISO 8601). Defaults to latest rate.' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
