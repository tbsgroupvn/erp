import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class UnsubscribeNewsletterDto {
  @ApiProperty({
    description: 'Unsubscribe token received via email',
    example: 'a1b2c3d4e5f6...',
  })
  @IsNotEmpty({ message: 'Token is required' })
  @IsString()
  @Length(64, 64, { message: 'Invalid unsubscribe token' })
  @Matches(/^[0-9a-f]+$/, { message: 'Invalid unsubscribe token' })
  token: string;
}
