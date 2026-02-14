import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateCustomerProfileDto {
  @ApiPropertyOptional({ description: 'Full name' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Company name' })
  @IsOptional()
  @IsString()
  companyName?: string;
}
