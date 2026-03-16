import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SubmitContactDto {
  @ApiProperty({
    description: 'Contact name',
    example: 'Nguyen Van A',
  })
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Contact email address',
    example: 'customer@example.com',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({
    description: 'Contact phone number',
    example: '0912345678',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiProperty({
    description: 'Message subject',
    example: 'Inquiry about shipping services',
  })
  @IsNotEmpty({ message: 'Subject is required' })
  @IsString()
  @MaxLength(500)
  subject: string;

  @ApiProperty({
    description: 'Message content',
    example: 'I would like to know more about your LCL shipping rates.',
  })
  @IsNotEmpty({ message: 'Message is required' })
  @IsString()
  @MaxLength(5000)
  message: string;
}
