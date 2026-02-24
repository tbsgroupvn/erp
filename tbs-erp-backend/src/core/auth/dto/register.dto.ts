import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { UserRole, Branch } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({
    example: 'user@tbs.vn',
    description: 'Email address of the user',
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'User password (min 8 characters)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+])/, {
    message: 'Password must contain at least 1 uppercase, 1 lowercase, 1 number and 1 special character',
  })
  password: string;

  @ApiProperty({
    example: 'Nguyen Van A',
    description: 'Full name of the user',
  })
  @IsString()
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  fullName: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.SALE,
    description: 'Role assigned to the user',
  })
  @IsEnum(UserRole, { message: 'Role must be a valid UserRole' })
  role: UserRole;

  @ApiPropertyOptional({
    enum: Branch,
    example: Branch.HN,
    description: 'Branch the user belongs to',
  })
  @IsOptional()
  @IsEnum(Branch, { message: 'Branch must be HN or HCM' })
  branch?: Branch;
}
