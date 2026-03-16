import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CheckInDto {
  @ApiPropertyOptional({ description: 'Check-in timestamp (defaults to now)', example: '2025-06-01T08:30:00Z' })
  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @ApiPropertyOptional({ description: 'Latitude', example: 21.0285 })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude', example: 105.8542 })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({
    description: 'Check-in type',
    enum: ['OFFICE', 'REMOTE', 'FIELD'],
    example: 'OFFICE',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Note' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CheckOutDto {
  @ApiPropertyOptional({ description: 'Check-out timestamp (defaults to now)', example: '2025-06-01T17:30:00Z' })
  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @ApiPropertyOptional({ description: 'Latitude', example: 21.0285 })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude', example: 105.8542 })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ description: 'Note' })
  @IsOptional()
  @IsString()
  note?: string;
}
