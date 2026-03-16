import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class BankTransactionDto {
  @ApiProperty({ description: 'Transaction reference / ID from bank', example: 'VCB-20260301-001' })
  @IsString()
  @IsNotEmpty()
  reference: string;

  @ApiProperty({ description: 'Transaction amount', example: 5000000 })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Transaction date (ISO 8601)', example: '2026-03-01' })
  @IsDateString()
  date: Date;

  @ApiPropertyOptional({ description: 'Transaction description', example: 'TT don hang TBS-ORD-001234' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Bank-internal reference number', example: 'FT26060001234' })
  @IsOptional()
  @IsString()
  bankReference?: string;
}

export class ImportBankStatementDto {
  @ApiProperty({
    description: 'Array of bank transactions to import',
    type: [BankTransactionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankTransactionDto)
  transactions: BankTransactionDto[];
}
