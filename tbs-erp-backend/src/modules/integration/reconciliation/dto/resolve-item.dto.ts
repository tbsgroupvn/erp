import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResolveItemDto {
  @ApiProperty({
    description: 'Resolution type',
    example: 'MANUAL_ADJUSTED',
    enum: ['AUTO_MATCHED', 'MANUAL_ADJUSTED', 'WRITTEN_OFF', 'DUPLICATE', 'TIMING_DIFFERENCE'],
  })
  @IsString()
  @IsNotEmpty()
  resolution: string;

  @ApiPropertyOptional({ description: 'Optional note explaining the resolution' })
  @IsOptional()
  @IsString()
  note?: string;
}
