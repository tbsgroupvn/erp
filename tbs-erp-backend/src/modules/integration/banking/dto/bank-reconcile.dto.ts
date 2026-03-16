import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString, IsOptional, IsBoolean } from 'class-validator';

export class BankReconcileDto {
  @ApiProperty({ description: 'Bank code to reconcile (e.g., VCB, TCB, BIDV)', example: 'VCB' })
  @IsString()
  @IsNotEmpty()
  bankCode: string;

  @ApiProperty({ description: 'Start date (ISO 8601)', example: '2025-01-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date (ISO 8601)', example: '2025-01-31' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description:
      'Specific bank account number to reconcile (if omitted, all accounts for the bank)',
  })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiPropertyOptional({
    description: 'Whether to auto-approve high-confidence matches',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoApproveHighConfidence?: boolean = false;
}
