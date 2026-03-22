import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * Two-factor authentication method enum (mirrors Prisma TwoFactorMethod).
 */
export enum TwoFactorMethodDto {
  TOTP = 'TOTP',
  SMS = 'SMS',
}

/**
 * DTO for triggering 2FA setup — no body required.
 * The endpoint generates a TOTP secret and returns a QR code.
 */
export class Enable2FADto {}

/**
 * DTO for verifying a 2FA code (used to enable 2FA after setup,
 * and during login verification).
 */
export class Verify2FADto {
  @ApiProperty({
    example: '123456',
    description: 'Six-digit TOTP or SMS verification code',
  })
  @IsString()
  @IsNotEmpty({ message: 'Verification code is required' })
  @Length(6, 8, { message: 'Code must be between 6 and 8 characters' })
  code: string;
}

/**
 * DTO for disabling 2FA — requires both a valid code and the account password.
 */
export class Disable2FADto {
  @ApiProperty({
    example: '123456',
    description: 'Current TOTP or backup code',
  })
  @IsString()
  @IsNotEmpty({ message: 'Verification code is required' })
  code: string;

  @ApiProperty({
    example: 'Password@123',
    description: 'Account password for confirmation',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}

/**
 * DTO for the second step of login when 2FA is required.
 * Contains the temporary userId, verification code, and method.
 */
export class VerifyLoginOtpDto {
  @ApiPropertyOptional({
    example: 'clxxxxxxxxxxxxxxxxxx',
    description: 'Deprecated — userId is now extracted from the temp token. Ignored if sent.',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({
    example: '123456',
    description: 'TOTP, SMS, or backup code',
  })
  @IsString()
  @IsNotEmpty({ message: 'Verification code is required' })
  code: string;

  @ApiPropertyOptional({
    enum: TwoFactorMethodDto,
    example: TwoFactorMethodDto.TOTP,
    description: 'Two-factor method used (defaults to TOTP)',
  })
  @IsOptional()
  @IsEnum(TwoFactorMethodDto, { message: 'Method must be TOTP or SMS' })
  method?: TwoFactorMethodDto;
}

/**
 * DTO for setting up SMS-based two-factor authentication.
 */
export class SmsTwoFactorDto {
  @ApiProperty({
    example: '+84901234567',
    description: 'Phone number for receiving SMS OTP codes',
  })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'Phone number must be a valid international format (e.g. +84901234567)',
  })
  phoneNumber: string;
}
