import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class SendMessageDto {
  @ApiProperty({ description: 'Message content' })
  @SanitizeHtmlStrict()
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Reply-to message ID' })
  @IsOptional()
  @IsString()
  replyToId?: string;
}
