import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Branch, VehicleType } from '@prisma/client';

export class CreateVehicleDto {
  @ApiProperty({ description: 'Plate number', example: '30A-12345' })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @ApiProperty({ description: 'Vehicle type', enum: VehicleType, example: VehicleType.TRUCK })
  @IsEnum(VehicleType)
  type: VehicleType;

  @ApiPropertyOptional({ description: 'Brand', example: 'Hyundai' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: 'Model', example: 'HD72' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ description: 'Manufacturing year', example: 2023 })
  @IsOptional()
  @IsNumber()
  year?: number;

  @ApiPropertyOptional({ description: 'Capacity in kg', example: 3500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  capacityKg?: number;

  @ApiPropertyOptional({ description: 'Volume in m3', example: 20 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  volumeM3?: number;

  @ApiProperty({ description: 'Branch', enum: Branch, example: Branch.HN })
  @IsEnum(Branch)
  branch: Branch;

  @ApiPropertyOptional({ description: 'Insurance expiry date', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  insuranceExpiry?: string;

  @ApiPropertyOptional({ description: 'Registration expiry date', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  registrationExpiry?: string;
}
