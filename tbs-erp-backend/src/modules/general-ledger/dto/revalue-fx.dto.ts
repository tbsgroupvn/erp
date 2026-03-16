import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class RevalueFxDto {
  @ApiProperty({ description: 'Nam ke toan', example: 2026, minimum: 2000, maximum: 2100 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiProperty({ description: 'Thang ke toan (1-12)', example: 3, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ description: 'Ty gia hien tai (VND/USD)', example: 25400, minimum: 1 })
  @IsNumber()
  @Min(1)
  currentRate: number;
}
