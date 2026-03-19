import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsArray } from 'class-validator';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class CreateReturnRequestDto {
  @ApiProperty({ description: 'Lý do yêu cầu trả hàng', minLength: 10 })
  @SanitizeHtmlStrict()
  @IsString()
  @MinLength(10)
  reason: string;

  @ApiPropertyOptional({ description: 'Danh sách file đính kèm (URLs)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
