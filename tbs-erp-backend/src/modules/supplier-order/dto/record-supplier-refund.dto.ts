import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  Min,
  MinLength,
  ArrayMinSize,
} from 'class-validator';

export class RecordSupplierRefundDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsString()
  customerId: string;

  @ApiProperty({ description: 'Supplier order ID' })
  @IsString()
  supplierOrderId: string;

  @ApiProperty({ description: 'Refund amount in CNY', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  refundAmountCNY: number;

  @ApiProperty({ description: 'Reason for refund (minimum 10 characters)' })
  @IsString()
  @MinLength(10)
  reason: string;

  @ApiProperty({
    description: 'Proof attachments (Alipay screenshots, etc.)',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  attachments: string[];

  @ApiPropertyOptional({ description: 'Additional note' })
  @IsOptional()
  @IsString()
  note?: string;
}
