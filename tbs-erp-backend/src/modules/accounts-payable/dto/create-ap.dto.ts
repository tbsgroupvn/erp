import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Currency } from '@prisma/client';

export class CreateApDto {
  @ApiPropertyOptional({ description: 'Vendor/supplier ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vendorId?: string;

  @ApiPropertyOptional({ description: 'Vendor/supplier name (deprecated, use vendorId instead)', example: 'Nha cung cap ABC' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  vendorName?: string;

  @ApiProperty({ description: 'Amount payable', example: 30000000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(999999999999)
  amount: number;

  @ApiPropertyOptional({ description: 'Currency', enum: Currency, default: 'VND' })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({ description: 'Due date (ISO 8601)', example: '2025-04-01' })
  @IsNotEmpty()
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ description: 'Note' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
