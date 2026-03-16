import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsString,
  IsOptional,
  IsBoolean,
  ArrayMinSize,
  ArrayMaxSize,
  IsDateString,
} from 'class-validator';

export class BatchReceiveDto {
  @ApiProperty({ description: 'Array of tracking numbers to receive', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  trackingNumbers: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receivedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  forceReceive?: boolean;
}

export class BatchReceiveResultDto {
  received: string[];
  duplicates: string[];
  notFound: string[];
  total: number;
}
