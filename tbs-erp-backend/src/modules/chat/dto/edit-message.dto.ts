import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class EditMessageDto {
  @ApiProperty({ description: 'New message content' })
  @SanitizeHtmlStrict()
  @IsString()
  @IsNotEmpty()
  content: string;
}
