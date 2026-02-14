import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { CustomerTier } from '@prisma/client';
import { CreateCustomerDto } from './create-customer.dto';

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @ApiPropertyOptional({
    description: 'Manually override customer tier (only for STRATEGIC)',
    enum: CustomerTier,
  })
  @IsOptional()
  @IsEnum(CustomerTier)
  tier?: CustomerTier;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
