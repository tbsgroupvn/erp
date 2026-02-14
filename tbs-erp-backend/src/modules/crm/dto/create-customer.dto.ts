import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Branch } from '@prisma/client';

export class CreateCustomerDto {
  @ApiProperty({ description: 'Full name of the customer', example: 'Nguyen Van A' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  fullName: string;

  @ApiPropertyOptional({ description: 'Company name', example: 'Cong ty ABC' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiProperty({ description: 'Phone number', example: '0912345678' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  phone: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'customer@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Tax code (Ma so thue)', example: '0123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  taxCode?: string;

  @ApiPropertyOptional({ description: 'Branch', enum: Branch })
  @IsOptional()
  @IsEnum(Branch)
  branch?: Branch;

  @ApiPropertyOptional({ description: 'Sale ID responsible for this customer' })
  @IsOptional()
  @IsString()
  saleId?: string;

  @ApiPropertyOptional({ description: 'Note' })
  @IsOptional()
  @IsString()
  note?: string;
}
