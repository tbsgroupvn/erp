import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RequestOvertimeDto {
  @ApiProperty({ description: 'Overtime date', example: '2025-06-20' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Number of OT hours', example: 2 })
  @IsNumber()
  @Min(0.5)
  hours: number;

  @ApiPropertyOptional({ description: 'Reason for overtime' })
  @IsOptional()
  @IsString()
  reason?: string;
}
