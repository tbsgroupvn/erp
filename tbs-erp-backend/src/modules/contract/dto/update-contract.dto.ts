import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Currency } from '@prisma/client';

export class UpdateContractDto {
  @ApiPropertyOptional({ description: 'Contract title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Effective date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({ description: 'Expiry date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Total contract value' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalValue?: number;

  @ApiPropertyOptional({ description: 'Deposit required' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositRequired?: number;

  @ApiPropertyOptional({ description: 'Currency', enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ description: 'Contract terms (rich text)' })
  @IsOptional()
  @IsString()
  terms?: string;

  @ApiPropertyOptional({ description: 'Note' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Attachment URLs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
