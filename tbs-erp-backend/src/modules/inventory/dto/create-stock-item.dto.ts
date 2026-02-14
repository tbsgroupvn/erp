import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateStockItemDto {
  @ApiProperty({ description: 'Item code', example: 'BOX-60x40x30' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Item name', example: 'Cardboard Box 60x40x30cm' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Unit of measurement', example: 'pcs' })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiPropertyOptional({ description: 'Category', example: 'Packaging' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Minimum stock level', example: 50, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minLevel?: number;

  @ApiPropertyOptional({ description: 'Maximum stock level', example: 500, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxLevel?: number;

  @ApiPropertyOptional({ description: 'Storage location', example: 'Warehouse VN - Shelf A3' })
  @IsOptional()
  @IsString()
  location?: string;
}
