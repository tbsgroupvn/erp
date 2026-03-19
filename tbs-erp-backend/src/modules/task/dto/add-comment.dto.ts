import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class AddCommentDto {
  @ApiProperty({ description: 'Comment content' })
  @SanitizeHtmlStrict()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
