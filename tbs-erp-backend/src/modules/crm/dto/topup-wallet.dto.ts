import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class TopupWalletDto {
  @ApiProperty({ description: 'Amount to top up (VND)', example: 10000000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'Nhap lai so tien de xac nhan (phai trung voi amount)', example: 10000000 })
  @IsNotEmpty({ message: 'Xac nhan so tien la bat buoc' })
  @IsNumber()
  @Min(1)
  confirmAmount: number;

  @ApiProperty({ description: 'Ma giao dich ngan hang (Bank Trace ID) - bat buoc', example: 'FT24060012345678' })
  @IsNotEmpty({ message: 'Ma giao dich ngan hang (Bank Trace ID) la bat buoc' })
  @IsString()
  @MinLength(5, { message: 'Ma giao dich ngan hang phai co it nhat 5 ky tu' })
  bankTraceId: string;

  @ApiPropertyOptional({ description: 'Reference code (e.g. bank transfer reference)' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Note for this transaction' })
  @IsOptional()
  @IsString()
  note?: string;
}
