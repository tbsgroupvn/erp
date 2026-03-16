import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO for measuring a package at Warehouse CN.
 * Warehouse agent enters dimensions and weight after physical measurement.
 * The system calculates volumetric and chargeable weight automatically.
 */
export class MeasurePackageDto {
  @ApiProperty({
    description: 'Actual weight in kilograms',
    example: 15.5,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01, { message: 'Actual weight must be greater than 0' })
  actualWeight: number;

  @ApiProperty({
    description: 'Length in centimeters',
    example: 60,
    minimum: 0.1,
  })
  @IsNumber()
  @Min(0.1, { message: 'Length must be greater than 0' })
  length: number;

  @ApiProperty({
    description: 'Width in centimeters',
    example: 40,
    minimum: 0.1,
  })
  @IsNumber()
  @Min(0.1, { message: 'Width must be greater than 0' })
  width: number;

  @ApiProperty({
    description: 'Height in centimeters',
    example: 30,
    minimum: 0.1,
  })
  @IsNumber()
  @Min(0.1, { message: 'Height must be greater than 0' })
  height: number;

  @ApiPropertyOptional({
    description: 'Additional measurement notes',
    example: 'Irregular shape, measured at widest points',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
