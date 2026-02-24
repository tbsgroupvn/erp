import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContractType, Currency } from '@prisma/client';

export class CreateContractDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ description: 'Sale/owner user ID' })
  @IsString()
  @IsNotEmpty()
  saleId: string;

  @ApiProperty({ description: 'Contract type', enum: ContractType })
  @IsEnum(ContractType)
  type: ContractType;

  @ApiPropertyOptional({ description: 'Parent contract ID (for appendix)' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Linked quotation ID' })
  @IsOptional()
  @IsString()
  quotationId?: string;

  @ApiProperty({ description: 'Contract title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Effective date (ISO 8601)' })
  @IsDateString()
  effectiveDate: string;

  @ApiPropertyOptional({ description: 'Expiry date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Total contract value', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalValue?: number;

  @ApiPropertyOptional({ description: 'Deposit required', default: 0 })
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
