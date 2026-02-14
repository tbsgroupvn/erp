import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DeliveryItemDto {
  @ApiProperty({
    description: 'Order ID for this delivery',
    example: 'clord001',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    description: 'Recipient name',
    example: 'Nguyen Van A',
  })
  @IsString()
  @IsNotEmpty()
  recipientName: string;

  @ApiProperty({
    description: 'Recipient phone number',
    example: '0901234567',
  })
  @IsString()
  @IsNotEmpty()
  recipientPhone: string;

  @ApiProperty({
    description: 'Delivery address',
    example: '123 Le Loi, Quan 1, Ho Chi Minh',
  })
  @IsString()
  @IsNotEmpty()
  deliveryAddress: string;

  @ApiPropertyOptional({
    description: 'COD amount to collect (0 if no COD)',
    example: 5000000,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  codAmount?: number;

  @ApiPropertyOptional({
    description: 'Delivery notes',
    example: 'Call before delivery, gate code: 1234',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

/**
 * DTO for dispatching deliveries from Warehouse VN.
 */
export class DispatchDto {
  @ApiPropertyOptional({
    description: 'Driver user ID to assign',
    example: 'cldriver001',
  })
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiPropertyOptional({
    description: 'Vehicle ID to assign',
    example: 'clvehicle001',
  })
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiProperty({
    description: 'Delivery items to dispatch',
    type: [DeliveryItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryItemDto)
  deliveries: DeliveryItemDto[];

  @ApiPropertyOptional({
    description: 'Scheduled delivery date (ISO 8601)',
    example: '2025-02-15T09:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
