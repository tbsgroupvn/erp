import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { TrackingEventType } from '@prisma/client';

// Re-export for convenience
export { TrackingEventType };

export class CreateTrackingEventDto {
  @ApiPropertyOptional({
    description: 'Package ID to attach this tracking event to',
    example: 'clxyz123abc',
  })
  @IsOptional()
  @IsString()
  packageId?: string;

  @ApiPropertyOptional({
    description: 'Container ID to attach this tracking event to',
    example: 'clxyz456def',
  })
  @IsOptional()
  @IsString()
  containerId?: string;

  @ApiProperty({
    description: 'Tracking number (Chinese carrier tracking number)',
    example: 'SF1234567890',
  })
  @IsString()
  @IsNotEmpty({ message: 'Tracking number is required' })
  trackingNumber: string;

  @ApiProperty({
    description: 'Tracking event type',
    enum: TrackingEventType,
    example: TrackingEventType.IN_WAREHOUSE_CN,
  })
  @IsEnum(TrackingEventType, { message: 'Invalid tracking event type' })
  eventType: TrackingEventType;

  @ApiProperty({
    description: 'Location where the event occurred',
    example: 'Guangzhou Warehouse, China',
  })
  @IsString()
  @IsNotEmpty({ message: 'Location is required' })
  location: string;

  @ApiPropertyOptional({
    description: 'Description of the tracking event',
    example: 'Package received at Guangzhou warehouse',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Timestamp of the event (ISO 8601). Defaults to now.',
    example: '2025-06-15T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  eventTimestamp?: string;

  @ApiPropertyOptional({
    description: 'Carrier name',
    example: 'SF Express',
  })
  @IsOptional()
  @IsString()
  carrier?: string;
}
