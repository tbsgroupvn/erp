import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EmployeeStatus } from '@prisma/client';

export class DeactivateEmployeeDto {
  @ApiProperty({ description: 'Reason for deactivation', example: 'Resigned voluntarily' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({
    description: 'Effective date of deactivation',
    example: '2025-06-30',
  })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({
    description: 'Target status',
    enum: [EmployeeStatus.INACTIVE, EmployeeStatus.RESIGNED],
    default: EmployeeStatus.RESIGNED,
  })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;
}
