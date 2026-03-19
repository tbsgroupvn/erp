import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class AddResponseDto {
  @ApiProperty({
    description: 'Response content',
    example: 'We are looking into your issue and will get back to you shortly.',
    maxLength: 10000,
  })
  @SanitizeHtmlStrict()
  @IsString()
  @IsNotEmpty({ message: 'Content is required' })
  @MaxLength(10000)
  content: string;

  @ApiPropertyOptional({
    description: 'Whether this is an internal note (not visible to customer)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
