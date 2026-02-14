import { IsOptional, IsInt, IsString, IsNumber, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ description: 'Array of attachment URLs (photos of received goods)', type: [String] })
  @IsOptional()
  @IsArray()
  attachments?: string[];
}
