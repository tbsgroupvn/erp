import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class DutyCalculationDto {
  @ApiProperty({ description: 'HS code of the goods', example: '8471.30.00' })
  @IsString()
  @IsNotEmpty()
  hsCode: string;

  @ApiProperty({ description: 'CIF value (Cost + Insurance + Freight)', example: 50000 })
  @IsNumber()
  @Min(0)
  cifValue: number;

  @ApiProperty({ description: 'Currency of the CIF value', example: 'USD' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiPropertyOptional({
    description: 'Country of origin for preferential tariff lookup',
    example: 'CN',
  })
  @IsOptional()
  @IsString()
  countryOfOrigin?: string;

  @ApiPropertyOptional({ description: 'Quantity of goods', example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Unit of measurement', example: 'KG' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({
    description: 'Specific exchange rate to use (if not provided, current rate will be fetched)',
    example: 24500,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRate?: number;
}
