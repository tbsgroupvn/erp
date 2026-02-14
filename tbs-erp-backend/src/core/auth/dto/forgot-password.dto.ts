import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@tbs.vn',
    description: 'Email address of the account to reset password for',
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;
}
