import { IsInt, IsString, IsNumber, IsArray, IsOptional, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordReceivedDto {
  @ApiPropertyOptional({ description: 'Quantity actually received at CN warehouse' })
  @IsOptional()
  @IsInt()
  quantityReceived?: number;

  @ApiPropertyOptional({ description: 'Actual price paid in CNY (may differ from quoted)' })
  @IsOptional()
  @IsNumber()
  actualPriceCNY?: number;

  @ApiPropertyOptional({ description: 'Note about the received goods (condition, discrepancies, etc.)' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ description: 'Array of attachment URLs (photos of received goods) — mandatory', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  attachments: string[];
}
