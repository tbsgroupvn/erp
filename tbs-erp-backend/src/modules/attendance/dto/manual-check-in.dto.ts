import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class ManualCheckInDto {
  @ApiProperty({ description: 'URL of the selfie image uploaded by the employee' })
  @IsString()
  selfieUrl: string;

  @ApiProperty({ description: 'Reason for manual check-in', example: 'Forgot badge at home' })
  @IsString()
  manualReason: string;

  @ApiPropertyOptional({ description: 'Latitude', example: 21.0285 })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude', example: 105.8542 })
  @IsOptional()
  @IsNumber()
  lng?: number;
}

export class ReviewManualCheckInDto {
  @ApiProperty({ description: 'Whether to approve or reject the manual check-in' })
  approved: boolean;
}
