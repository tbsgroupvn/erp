import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
  })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    example: 'NewPassword@123',
    description: 'New password (min 8 chars, must contain uppercase, lowercase, number, special char)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+])/, {
    message: 'Password must contain at least 1 uppercase, 1 lowercase, 1 number and 1 special character',
  })
  newPassword: string;
}
