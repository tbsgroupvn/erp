import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RecordCODCollectionDto {
  @ApiProperty({ description: 'Delivery ID', example: 'clxyz123abc' })
  @IsString()
  @IsNotEmpty()
  deliveryId: string;

  @ApiProperty({ description: 'COD amount collected', example: 5500000 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'Payment method', example: 'CASH' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Notes', example: 'Customer paid in full' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Photo URL of COD receipt' })
  @IsOptional()
  @IsString()
  photoUrl?: string;
}
