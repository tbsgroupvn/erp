import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Currency, CostType } from '@prisma/client';

// Re-export for convenience
export { CostType };

export class CreateCostDto {
  @ApiProperty({
    description: 'Container ID this cost is associated with',
    example: 'clxyz123abc',
  })
  @IsString()
  @IsNotEmpty({ message: 'Container ID is required' })
  containerId: string;

  @ApiProperty({
    description: 'Type of cost',
    enum: CostType,
    example: CostType.FREIGHT,
  })
  @IsEnum(CostType, { message: 'Invalid cost type' })
  costType: CostType;

  @ApiProperty({
    description: 'Cost amount',
    example: 15000000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0, { message: 'Amount must not be negative' })
  amount: number;

  @ApiPropertyOptional({
    description: 'Currency of the cost',
    enum: Currency,
    default: Currency.VND,
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({
    description: 'Description of the cost',
    example: 'Sea freight charges for container CN-2025-001',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Invoice or receipt reference number',
    example: 'INV-2025-0456',
  })
  @IsOptional()
  @IsString()
  invoiceRef?: string;

  @ApiPropertyOptional({
    description: 'Estimated amount (for variance comparison)',
    example: 14000000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Estimated amount must not be negative' })
  estimatedAmount?: number;

  @ApiPropertyOptional({
    description: 'Additional notes',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
