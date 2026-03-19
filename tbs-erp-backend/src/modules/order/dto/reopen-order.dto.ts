import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class ReopenOrderDto {
  @ApiProperty({ description: 'Reason for reopening the completed order', minLength: 10, maxLength: 500 })
  @SanitizeHtmlStrict()
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Lý do mở lại đơn phải có ít nhất 10 ký tự' })
  @MaxLength(500)
  reason: string;
}
