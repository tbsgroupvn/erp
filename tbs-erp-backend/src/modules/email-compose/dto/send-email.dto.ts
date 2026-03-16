import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  MaxLength,
} from 'class-validator';

export class SendEmailDto {
  @ApiProperty({ description: 'Email người nhận', example: 'khachhang@example.com' })
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @ApiProperty({ description: 'Tiêu đề email', example: 'Thông tin đơn hàng' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @ApiProperty({ description: 'Nội dung email (HTML hoặc plain text)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  body: string;

  @ApiPropertyOptional({ description: 'Danh sách email CC', type: [String] })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];
}

export class SendQuotationEmailDto {
  @ApiProperty({ description: 'Email người nhận', example: 'khachhang@example.com' })
  @IsEmail()
  @IsNotEmpty()
  to: string;
}

export class SendInvoiceEmailDto {
  @ApiProperty({ description: 'Email người nhận', example: 'khachhang@example.com' })
  @IsEmail()
  @IsNotEmpty()
  to: string;
}
