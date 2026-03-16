import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class EditMessageDto {
  @ApiProperty({ description: 'New message content' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
