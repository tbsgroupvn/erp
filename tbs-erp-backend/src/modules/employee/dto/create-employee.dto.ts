import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { Branch } from '@prisma/client';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class CreateEmployeeDto {
  @ApiProperty({ description: 'Full name of the employee', example: 'Nguyen Van A' })
  @SanitizeHtmlStrict()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'nguyenvana@tbs.vn' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '0901234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ description: 'Department code', example: 'SALES' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  departmentCode: string;

  @ApiProperty({ description: 'Position title', example: 'Sales Executive' })
  @SanitizeHtmlStrict()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  positionTitle: string;

  @ApiProperty({ description: 'Branch', enum: Branch, example: Branch.HN })
  @IsEnum(Branch)
  branch: Branch;

  @ApiPropertyOptional({ description: 'Manager employee ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  managerId?: string;

  @ApiProperty({ description: 'Join date (ISO 8601)', example: '2025-01-15' })
  @IsDateString()
  joinDate: string;

  @ApiPropertyOptional({ description: 'Monthly salary', example: 15000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salary?: number;

  @ApiPropertyOptional({ description: 'Bank account number' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  bankAccount?: string;

  @ApiPropertyOptional({ description: 'Bank name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @ApiPropertyOptional({ description: 'Tax code' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  taxCode?: string;

  @ApiPropertyOptional({ description: 'Insurance ID' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  insuranceId?: string;

  @ApiPropertyOptional({ description: 'Associated user ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  userId?: string;
}
