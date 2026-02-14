import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RecordPaymentDto {
  @ApiProperty({ description: 'Payment amount', example: 10000000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ description: 'Payment reference (bank transfer code, etc.)' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Note' })
  @IsOptional()
  @IsString()
  note?: string;
}
