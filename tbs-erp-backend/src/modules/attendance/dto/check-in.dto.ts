import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CheckInDto {
  @ApiProperty({ description: 'Check-in timestamp', example: '2025-06-01T08:30:00Z' })
  @IsDateString()
  timestamp: string;

  @ApiPropertyOptional({ description: 'Latitude', example: 21.0285 })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude', example: 105.8542 })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiProperty({
    description: 'Check-in type',
    enum: ['OFFICE', 'REMOTE', 'FIELD'],
    example: 'OFFICE',
  })
  @IsString()
  type: string;
}

export class CheckOutDto {
  @ApiProperty({ description: 'Check-out timestamp', example: '2025-06-01T17:30:00Z' })
  @IsDateString()
  timestamp: string;

  @ApiPropertyOptional({ description: 'Latitude', example: 21.0285 })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude', example: 105.8542 })
  @IsOptional()
  @IsNumber()
  lng?: number;
}
