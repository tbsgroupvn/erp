import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddCommentDto {
  @ApiProperty({ description: 'Comment content' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
