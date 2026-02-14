import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class RateVendorDto {
  @ApiProperty({ description: 'Rating score (1-5)', example: 4, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @ApiPropertyOptional({ description: 'Rating category', example: 'QUALITY' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Comment', example: 'Good packaging quality, timely delivery' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ description: 'Related order ID' })
  @IsOptional()
  @IsString()
  orderId?: string;
}
