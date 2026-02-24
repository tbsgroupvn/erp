import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ServiceType, CustomerTier } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export class CreateServiceFeeConfigDto {
  @ApiProperty({
    description: 'Rule name',
    example: 'VIP - Hang thuong',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Service type',
    enum: ServiceType,
    default: ServiceType.MHH,
  })
  @IsOptional()
  @IsEnum(ServiceType, { message: 'Invalid service type' })
  serviceType?: ServiceType;

  @ApiPropertyOptional({
    description: 'Customer tier condition (null = all tiers)',
    enum: CustomerTier,
  })
  @IsOptional()
  @IsEnum(CustomerTier, { message: 'Invalid customer tier' })
  customerTier?: CustomerTier;

  @ApiPropertyOptional({
    description: 'Minimum order value (CNY)',
    example: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'minOrderValue must be a number' })
  @Min(0)
  minOrderValue?: number;

  @ApiPropertyOptional({
    description: 'Maximum order value (CNY)',
    example: 10000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'maxOrderValue must be a number' })
  @Min(0)
  maxOrderValue?: number;

  @ApiPropertyOptional({
    description: 'Minimum quantity',
    example: 1,
  })
  @IsOptional()
  @IsInt({ message: 'minQuantity must be an integer' })
  @Min(0)
  minQuantity?: number;

  @ApiPropertyOptional({
    description: 'Product category',
    example: 'electronics',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  productCategory?: string;

  @ApiProperty({
    description: 'Service fee percent',
    example: 5.0,
    minimum: 0,
    maximum: 99.99,
  })
  @IsNumber({}, { message: 'feePercent must be a number' })
  @Min(0, { message: 'feePercent must not be negative' })
  @Max(99.99, { message: 'feePercent must not exceed 99.99' })
  feePercent: number;

  @ApiPropertyOptional({
    description: 'Minimum fee amount (CNY)',
    example: 10,
  })
  @IsOptional()
  @IsNumber({}, { message: 'minFeeAmount must be a number' })
  @Min(0)
  minFeeAmount?: number;

  @ApiPropertyOptional({
    description: 'Maximum fee amount (CNY)',
    example: 5000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'maxFeeAmount must be a number' })
  @Min(0)
  maxFeeAmount?: number;

  @ApiPropertyOptional({
    description: 'Priority (higher = applied first)',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt({ message: 'priority must be an integer' })
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Whether the config is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Note',
    example: 'Applied for VIP customers only',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export class UpdateServiceFeeConfigDto {
  @ApiPropertyOptional({
    description: 'Rule name',
    example: 'VIP - Hang thuong',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Name must not be empty' })
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Service type',
    enum: ServiceType,
  })
  @IsOptional()
  @IsEnum(ServiceType, { message: 'Invalid service type' })
  serviceType?: ServiceType;

  @ApiPropertyOptional({
    description: 'Customer tier condition (null = all tiers)',
    enum: CustomerTier,
  })
  @IsOptional()
  @IsEnum(CustomerTier, { message: 'Invalid customer tier' })
  customerTier?: CustomerTier;

  @ApiPropertyOptional({
    description: 'Minimum order value (CNY)',
    example: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'minOrderValue must be a number' })
  @Min(0)
  minOrderValue?: number;

  @ApiPropertyOptional({
    description: 'Maximum order value (CNY)',
    example: 10000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'maxOrderValue must be a number' })
  @Min(0)
  maxOrderValue?: number;

  @ApiPropertyOptional({
    description: 'Minimum quantity',
    example: 1,
  })
  @IsOptional()
  @IsInt({ message: 'minQuantity must be an integer' })
  @Min(0)
  minQuantity?: number;

  @ApiPropertyOptional({
    description: 'Product category',
    example: 'electronics',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  productCategory?: string;

  @ApiPropertyOptional({
    description: 'Service fee percent',
    example: 5.0,
    minimum: 0,
    maximum: 99.99,
  })
  @IsOptional()
  @IsNumber({}, { message: 'feePercent must be a number' })
  @Min(0, { message: 'feePercent must not be negative' })
  @Max(99.99, { message: 'feePercent must not exceed 99.99' })
  feePercent?: number;

  @ApiPropertyOptional({
    description: 'Minimum fee amount (CNY)',
    example: 10,
  })
  @IsOptional()
  @IsNumber({}, { message: 'minFeeAmount must be a number' })
  @Min(0)
  minFeeAmount?: number;

  @ApiPropertyOptional({
    description: 'Maximum fee amount (CNY)',
    example: 5000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'maxFeeAmount must be a number' })
  @Min(0)
  maxFeeAmount?: number;

  @ApiPropertyOptional({
    description: 'Priority (higher = applied first)',
    example: 0,
  })
  @IsOptional()
  @IsInt({ message: 'priority must be an integer' })
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Whether the config is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Note',
    example: 'Applied for VIP customers only',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export class ServiceFeeConfigQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by service type',
    enum: ServiceType,
    example: ServiceType.MHH,
  })
  @IsOptional()
  @IsEnum(ServiceType, { message: 'Invalid service type' })
  serviceType?: ServiceType;

  @ApiPropertyOptional({
    description: 'Filter by customer tier',
    enum: CustomerTier,
  })
  @IsOptional()
  @IsEnum(CustomerTier, { message: 'Invalid customer tier' })
  customerTier?: CustomerTier;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Search by name',
    example: 'VIP',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
