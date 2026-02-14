import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class ReceiptItemDto {
  @ApiProperty({ description: 'Item description', example: 'Cardboard boxes 60x40x30' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Quantity received', example: 95 })
  @IsNumber()
  @Min(0)
  receivedQty: number;

  @ApiPropertyOptional({ description: 'Notes about condition or discrepancies' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordReceiptDto {
  @ApiProperty({ description: 'Receipt items', type: [ReceiptItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptItemDto)
  items: ReceiptItemDto[];

  @ApiPropertyOptional({ description: 'Receipt notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
