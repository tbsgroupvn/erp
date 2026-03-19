import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class CreateInteractionNoteDto {
  @ApiProperty({ description: 'Noi dung ghi chu tuong tac', example: 'Khach hang hoi ve don hang ORD-001' })
  @SanitizeHtmlStrict()
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({
    description: 'Kenh tuong tac',
    example: 'PHONE',
    enum: ['PHONE', 'EMAIL', 'ZALO', 'FACEBOOK', 'IN_PERSON', 'OTHER'],
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  channel?: string;
}
