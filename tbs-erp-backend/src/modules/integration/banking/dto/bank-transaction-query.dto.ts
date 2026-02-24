import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
  ALL = 'ALL',
}

export class BankTransactionQueryDto {
  @ApiProperty({ description: 'Bank account ID or number' })
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ description: 'Start date (ISO 8601)', example: '2025-01-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date (ISO 8601)', example: '2025-12-31' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Transaction type filter',
    enum: TransactionType,
    default: TransactionType.ALL,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType = TransactionType.ALL;

  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 50,
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}
