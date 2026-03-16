import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateLostItemDto {
  @ApiPropertyOptional({
    description: 'Tracking number from Chinese courier',
    example: 'YT2025060112345',
  })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({
    description: 'Package description',
    example: 'Brown cardboard box, electronics',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Weight in kg', example: 2.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiProperty({ description: 'Warehouse where item was received (CN or VN)', example: 'CN' })
  @IsString()
  @IsNotEmpty()
  warehouse: string;

  @ApiPropertyOptional({ description: 'Photo URLs of the item', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @ApiPropertyOptional({ description: 'Date received (ISO 8601)', example: '2025-06-15' })
  @IsOptional()
  @IsDateString()
  receivedAt?: string;
}
