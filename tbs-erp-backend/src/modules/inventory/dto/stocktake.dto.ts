import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsString, Min, ValidateNested } from 'class-validator';

export class StocktakeItemDto {
  @ApiProperty({ description: 'Stock item ID', example: 'clxyz123abc' })
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({ description: 'Physical count quantity', example: 48 })
  @IsNumber()
  @Min(0)
  actualQty: number;
}

export class StocktakeDto {
  @ApiProperty({ description: 'Stocktake items with physical counts', type: [StocktakeItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StocktakeItemDto)
  items: StocktakeItemDto[];
}
