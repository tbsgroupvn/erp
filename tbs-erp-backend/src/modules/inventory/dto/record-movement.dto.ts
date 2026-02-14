import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { StockMovementType } from '@prisma/client';

export class RecordMovementDto {
  @ApiProperty({ description: 'Stock item ID', example: 'clxyz123abc' })
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({ description: 'Movement type', enum: StockMovementType })
  @IsEnum(StockMovementType)
  type: StockMovementType;

  @ApiProperty({ description: 'Quantity (positive for in, negative value will be absolute)', example: 25 })
  @IsNumber()
  quantity: number;

  @ApiPropertyOptional({ description: 'Reference document', example: 'PO-202506-0001' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
