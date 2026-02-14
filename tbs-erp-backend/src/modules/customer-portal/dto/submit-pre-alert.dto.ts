import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SubmitPreAlertDto {
  @ApiProperty({ description: 'China tracking number', example: 'YT1234567890' })
  @IsString()
  @IsNotEmpty()
  trackingNumber: string;

  @ApiPropertyOptional({ description: 'Item description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Expected number of parcels', example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedParcels?: number;

  @ApiPropertyOptional({ description: 'Screenshot URLs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  screenshots?: string[];
}
