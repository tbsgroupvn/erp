import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'user@tbs.vn',
    description: 'Email address of the user',
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @MaxLength(254, { message: 'Email không được vượt quá 254 ký tự' })
  email: string;

  @ApiProperty({
    example: 'Password@123',
    description: 'User password (min 8 chars)',
  })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxLength(256, { message: 'Mật khẩu không được vượt quá 256 ký tự' })
  password: string;
}
