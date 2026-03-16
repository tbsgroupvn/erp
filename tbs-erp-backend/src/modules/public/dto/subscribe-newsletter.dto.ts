import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SubscribeNewsletterDto {
  @ApiProperty({
    description: 'Subscriber email address',
    example: 'subscriber@example.com',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({
    description: 'Subscriber name',
    example: 'Nguyen Van A',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Subscription source',
    example: 'homepage',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;
}
