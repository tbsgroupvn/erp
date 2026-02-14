import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
  Min,
} from 'class-validator';

export class JournalEntryLineDto {
  @ApiProperty({ description: 'Account code from chart of accounts', example: '1111' })
  @IsString()
  @IsNotEmpty()
  accountCode: string;

  @ApiProperty({ description: 'Debit amount', example: 1000000, minimum: 0 })
  @IsNumber()
  @Min(0)
  debit: number;

  @ApiProperty({ description: 'Credit amount', example: 0, minimum: 0 })
  @IsNumber()
  @Min(0)
  credit: number;

  @ApiPropertyOptional({ description: 'Line description', example: 'Cash received from customer' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateJournalEntryDto {
  @ApiProperty({ description: 'Journal entry date (ISO 8601)', example: '2025-06-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Journal entry description', example: 'Record customer payment' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Description must be at least 5 characters' })
  description: string;

  @ApiPropertyOptional({ description: 'Source document reference', example: 'INV-202506-0001' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ description: 'Journal entry lines (debits and credits)', type: [JournalEntryLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalEntryLineDto)
  entries: JournalEntryLineDto[];
}
