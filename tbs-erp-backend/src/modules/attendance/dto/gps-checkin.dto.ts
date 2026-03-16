import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
  Max,
  IsIn,
} from 'class-validator';

export class GpsCheckInDto {
  @ApiProperty({ description: 'Latitude', example: 10.7769 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ description: 'Longitude', example: 106.7009 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({
    description: 'Check-in method',
    enum: ['GPS', 'WIFI', 'MANUAL'],
    default: 'GPS',
  })
  @IsOptional()
  @IsString()
  @IsIn(['GPS', 'WIFI', 'MANUAL'])
  method?: string;

  @ApiPropertyOptional({ description: 'Check-in type', enum: ['OFFICE', 'REMOTE', 'FIELD'] })
  @IsOptional()
  @IsString()
  type?: string;
}

export class GpsCheckOutDto {
  @ApiProperty({ description: 'Latitude', example: 10.7769 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ description: 'Longitude', example: 106.7009 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({
    description: 'Check-out method',
    enum: ['GPS', 'WIFI', 'MANUAL'],
    default: 'GPS',
  })
  @IsOptional()
  @IsString()
  @IsIn(['GPS', 'WIFI', 'MANUAL'])
  method?: string;
}

export class CreateOfficeLocationDto {
  @ApiProperty({ description: 'Ten van phong', example: 'Van phong HCM' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Latitude', example: 10.7769 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ description: 'Longitude', example: 106.7009 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiPropertyOptional({ description: 'Ban kinh check-in (met)', default: 100 })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(5000)
  radiusMeters?: number;

  @ApiPropertyOptional({ description: 'WiFi SSID de auto check-in' })
  @IsOptional()
  @IsString()
  wifiSSID?: string;
}

export class UpdateOfficeLocationDto {
  @ApiPropertyOptional({ description: 'Ten van phong' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Latitude' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ description: 'Ban kinh check-in (met)' })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(5000)
  radiusMeters?: number;

  @ApiPropertyOptional({ description: 'WiFi SSID' })
  @IsOptional()
  @IsString()
  wifiSSID?: string;

  @ApiPropertyOptional({ description: 'Kich hoat' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
