import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class TopupWalletDto {
  @ApiProperty({ description: 'Amount to top up (VND)', example: 10000000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ description: 'Reference code (e.g. bank transfer reference)' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Note for this transaction' })
  @IsOptional()
  @IsString()
  note?: string;
}
