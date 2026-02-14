import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ServiceType } from '@prisma/client';

export class CaptureLeadDto {
  @ApiProperty({
    description: 'Full name of the lead',
    example: 'Nguyen Van A',
  })
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString()
  @MaxLength(255)
  fullName: string;

  @ApiProperty({
    description: 'Phone number (Vietnamese format)',
    example: '0912345678',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  @Matches(/^(0|\+84)[0-9]{9,10}$/, {
    message: 'Phone number must be a valid Vietnamese phone number',
  })
  phone: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'customer@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email?: string;

  @ApiProperty({
    description: 'Service type interested in',
    enum: ServiceType,
    example: ServiceType.VCT,
  })
  @IsNotEmpty({ message: 'Service type is required' })
  @IsEnum(ServiceType, {
    message: 'Service type must be one of: VCT, MHH, UTXNK, LCLCN',
  })
  service: ServiceType;

  @ApiPropertyOptional({
    description: 'Message or inquiry from the lead',
    example: 'Toi muon van chuyen hang tu Trung Quoc ve Viet Nam',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
