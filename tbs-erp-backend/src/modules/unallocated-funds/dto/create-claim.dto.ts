import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateClaimDto {
  @ApiProperty({ description: 'Wallet transaction ID to claim' })
  @IsNotEmpty()
  @IsString()
  walletTransactionId: string;

  @ApiProperty({ description: 'Customer ID who owns the funds' })
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @ApiProperty({ description: 'Claimed amount', example: 5000000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({
    description: 'Evidence URLs (screenshots, bank statements, etc.)',
    type: [String],
    example: ['https://storage.example.com/evidence/receipt-001.pdf'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence?: string[];

  @ApiPropertyOptional({ description: 'Target order ID to allocate funds to' })
  @IsOptional()
  @IsString()
  targetOrderId?: string;

  @ApiPropertyOptional({ description: 'Target contract ID to allocate funds to' })
  @IsOptional()
  @IsString()
  targetContractId?: string;

  @ApiPropertyOptional({
    description: 'Additional note',
    example: 'Customer confirmed via phone call',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
