import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateEmojiDto {
  @ApiProperty({
    description: 'Tên emoji (định dạng :tbs_name:)',
    example: ':tbs_logo:',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^:[a-z0-9_]+:$/, {
    message: 'Tên emoji phải có định dạng :ten_emoji: (chữ thường, số, dấu gạch dưới)',
  })
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: 'URL ảnh emoji trong MinIO/S3',
    example: 'https://minio.tbslogistics.com/tbs-media/emojis/tbs_logo.png',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  imageUrl: string;

  @ApiPropertyOptional({
    description: 'Danh mục emoji',
    example: 'company',
    default: 'general',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;
}
