import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'user@tbs.vn',
    description: 'Email address of the user',
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @ApiProperty({
    example: 'Password@123',
    description: 'User password (min 8 chars, must contain uppercase, lowercase, number, special char)',
  })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+])/, {
    message: 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt',
  })
  password: string;
}
