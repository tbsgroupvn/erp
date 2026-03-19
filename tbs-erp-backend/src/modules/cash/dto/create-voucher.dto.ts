import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  ArrayMaxSize,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Currency, PaymentMethod } from '@prisma/client';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export enum VoucherType {
  RECEIPT = 'RECEIPT',
  PAYMENT = 'PAYMENT',
}

export class CreateVoucherDto {
  @ApiProperty({ description: 'Voucher type', enum: VoucherType })
  @IsNotEmpty()
  @IsEnum(VoucherType)
  type: VoucherType;

  @ApiProperty({ description: 'Related order ID' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  orderId: string;

  @ApiProperty({ description: 'Amount', example: 5000000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ description: 'Currency', enum: Currency, default: 'VND' })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({ description: 'Payment method', enum: PaymentMethod })
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ description: 'Cost type (Loai chi phi)', example: 'Van chuyen noi dia' })
  @SanitizeHtmlStrict()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  costType: string;

  @ApiProperty({ description: 'Beneficiary name (Nguoi thu huong)', example: 'Nguyen Van B' })
  @SanitizeHtmlStrict()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  beneficiary: string;

  @ApiProperty({
    description: 'Reason for this voucher (minimum 20 characters)',
    example: 'Thanh toan phi van chuyen noi dia cho don hang TBS-ORD-240101-0001',
  })
  @SanitizeHtmlStrict()
  @IsNotEmpty()
  @IsString()
  @MinLength(20)
  reason: string;

  @ApiPropertyOptional({
    description: 'Attachment URLs (receipts, invoices)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  attachments?: string[];

  @ApiPropertyOptional({
    description: 'Related supplier order ID (for NCC procurement payments)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  supplierOrderId?: string;

  @ApiPropertyOptional({
    description: 'Ma giao dich ngan hang (bat buoc cho RECEIPT + BANK_TRANSFER)',
    example: 'FT24060012345678',
  })
  @IsOptional()
  @IsString()
  @MinLength(5, { message: 'Ma giao dich ngan hang phai co it nhat 5 ky tu' })
  bankTraceId?: string;

  @ApiPropertyOptional({
    description: 'Exchange rate at payment time (for foreign currency PAYMENT vouchers). If not provided, current rate will be used.',
    example: 3500,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  exchangeRateAtPayment?: number;
}
