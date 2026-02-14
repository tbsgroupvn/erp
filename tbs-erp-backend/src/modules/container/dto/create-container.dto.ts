import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  Min,
} from 'class-validator';
import { ShippingRoute } from '@prisma/client';

export class CreateContainerDto {
  @ApiProperty({
    description: 'Shipping route for this container',
    enum: ShippingRoute,
    example: ShippingRoute.SEA,
  })
  @IsEnum(ShippingRoute, { message: 'Invalid shipping route' })
  shippingRoute: ShippingRoute;

  @ApiPropertyOptional({
    description: 'Origin warehouse location',
    example: 'Guangzhou Warehouse',
  })
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiPropertyOptional({
    description: 'Destination warehouse location',
    example: 'Hanoi Warehouse',
  })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional({
    description: 'Carrier name (shipping line or trucking company)',
    example: 'COSCO Shipping',
  })
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiPropertyOptional({
    description: 'Booking reference number',
    example: 'BK-2025-001234',
  })
  @IsOptional()
  @IsString()
  bookingRef?: string;

  @ApiPropertyOptional({
    description: 'Container seal number',
    example: 'SEAL123456',
  })
  @IsOptional()
  @IsString()
  sealNumber?: string;

  @ApiPropertyOptional({
    description: 'Vessel or vehicle name',
    example: 'COSCO SHIPPING ARIES',
  })
  @IsOptional()
  @IsString()
  vesselName?: string;

  @ApiPropertyOptional({
    description: 'Maximum capacity in metric tons',
    example: 20,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCapacity?: number;

  @ApiPropertyOptional({
    description: 'Estimated departure date (ISO 8601)',
    example: '2025-02-15T08:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  estimatedDepartureAt?: string;

  @ApiPropertyOptional({
    description: 'Estimated arrival date (ISO 8601)',
    example: '2025-03-01T08:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  estimatedArrivalAt?: string;
}
