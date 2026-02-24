import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateDeclarationLineDto {
  @ApiPropertyOptional({
    description: 'Declared HS code for customs',
    example: '6204.43.00',
  })
  @IsOptional()
  @IsString()
  declaredHsCode?: string;

  @ApiPropertyOptional({
    description: 'Declared description for customs',
    example: 'Women cotton trousers',
  })
  @IsOptional()
  @IsString()
  declaredDescription?: string;

  @ApiPropertyOptional({
    description: 'Declared quantity',
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  declaredQuantity?: number;

  @ApiPropertyOptional({
    description: 'Declared unit of measurement',
    example: 'PCS',
  })
  @IsOptional()
  @IsString()
  declaredUnit?: string;

  @ApiPropertyOptional({
    description: 'Declared unit price',
    example: 5.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  declaredUnitPrice?: number;

  @ApiPropertyOptional({
    description: 'Declared total value for this line',
    example: 550.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  declaredTotalValue?: number;

  @ApiPropertyOptional({
    description: 'Declared country of origin',
    example: 'CN',
  })
  @IsOptional()
  @IsString()
  declaredCountryOrigin?: string;

  @ApiPropertyOptional({
    description: 'Declared net weight in kg',
    example: 50.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  declaredNetWeight?: number;

  @ApiPropertyOptional({
    description: 'Declared gross weight in kg',
    example: 55.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  declaredGrossWeight?: number;
}
