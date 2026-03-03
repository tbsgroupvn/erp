import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class BankWebhookPayloadDto {
  @ApiProperty({ description: 'Ma giao dich ngan hang (unique)', example: 'FT24060012345678' })
  @IsString()
  @IsNotEmpty()
  traceId: string;

  @ApiProperty({ description: 'So tien giao dich', example: 5000000 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Noi dung chuyen khoan', example: 'NAP TBS-KH-000001' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Ma ngan hang', example: 'VCB' })
  @IsOptional()
  @IsString()
  bankCode?: string;

  @ApiPropertyOptional({ description: 'So tai khoan nhan', example: '1234567890' })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiProperty({ description: 'Ngay giao dich', example: '2026-03-03T10:00:00Z' })
  @IsDateString()
  transactionDate: string;
}
