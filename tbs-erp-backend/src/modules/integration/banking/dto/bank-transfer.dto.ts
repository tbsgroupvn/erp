import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
  IsEnum,
} from 'class-validator';

export enum TransferType {
  /** Internal transfer within same bank */
  INTERNAL = 'INTERNAL',
  /** Domestic interbank transfer via Napas */
  DOMESTIC = 'DOMESTIC',
  /** International wire transfer */
  INTERNATIONAL = 'INTERNATIONAL',
}

export class BankTransferDto {
  @ApiProperty({ description: 'Source bank account number' })
  @IsString()
  @IsNotEmpty()
  fromAccountNumber: string;

  @ApiProperty({ description: 'Destination bank account number' })
  @IsString()
  @IsNotEmpty()
  toAccountNumber: string;

  @ApiProperty({ description: 'Destination bank code (e.g., VCB, TCB)', example: 'VCB' })
  @IsString()
  @IsNotEmpty()
  toBankCode: string;

  @ApiProperty({ description: 'Beneficiary name' })
  @IsString()
  @IsNotEmpty()
  beneficiaryName: string;

  @ApiProperty({ description: 'Transfer amount', example: 5000000 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'Currency code', example: 'VND' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({
    description: 'Type of transfer',
    enum: TransferType,
    example: TransferType.DOMESTIC,
  })
  @IsEnum(TransferType)
  transferType: TransferType;

  @ApiProperty({ description: 'Transfer description / memo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @ApiPropertyOptional({
    description: 'Reference to an ERP voucher or order ID for audit trail',
  })
  @IsOptional()
  @IsString()
  erpReference?: string;

  @ApiPropertyOptional({
    description: 'SWIFT code for international transfers',
  })
  @IsOptional()
  @IsString()
  swiftCode?: string;
}
