import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ServiceType } from '@prisma/client';

export class CreateCommissionRuleDto {
  @ApiProperty({ description: 'Service type this rule applies to', enum: ServiceType })
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @ApiProperty({ description: 'Minimum net profit for this tier', example: 0 })
  @IsNumber()
  @Min(0)
  minProfit: number;

  @ApiProperty({ description: 'Maximum net profit for this tier', example: 50000000 })
  @IsNumber()
  @Min(0)
  maxProfit: number;

  @ApiProperty({ description: 'Commission rate (0.0 to 1.0)', example: 0.05 })
  @IsNumber()
  @Min(0)
  @Max(1)
  rate: number;

  @ApiPropertyOptional({ description: 'Rule description', example: 'Standard commission for MHH orders with profit 0-50M' })
  @IsOptional()
  @IsString()
  description?: string;
}
