import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Branch } from '@prisma/client';

export class CreateDriverDto {
  @ApiPropertyOptional({ description: 'Employee ID (optional for external drivers)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  employeeId?: string;

  @ApiProperty({ description: 'Full name', example: 'Tran Van B' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName: string;

  @ApiProperty({ description: 'Phone number', example: '0912345678' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @ApiPropertyOptional({ description: 'License number', example: 'B2-123456' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  licenseNumber?: string;

  @ApiPropertyOptional({ description: 'License expiry date', example: '2027-12-31' })
  @IsOptional()
  @IsDateString()
  licenseExpiry?: string;

  @ApiPropertyOptional({ description: 'License type (B2, C, D, etc.)', example: 'C' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  licenseType?: string;

  @ApiPropertyOptional({ description: 'Assigned vehicle ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vehicleId?: string;

  @ApiProperty({ description: 'Branch', enum: Branch, example: Branch.HN })
  @IsEnum(Branch)
  branch: Branch;
}
