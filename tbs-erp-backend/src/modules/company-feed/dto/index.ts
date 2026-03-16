import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PostCategory, PostStatus, ReactionType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({ description: 'Tiêu đề bài viết' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @ApiProperty({ description: 'Nội dung HTML' })
  @IsString()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({ description: 'Tóm tắt ngắn' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  excerpt?: string;

  @ApiPropertyOptional({ enum: PostCategory, description: 'Danh mục bài viết' })
  @IsOptional()
  @IsEnum(PostCategory)
  category?: PostCategory;

  @ApiPropertyOptional({ description: 'Ghim bài viết lên đầu' })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ description: 'URL ảnh bìa' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ description: 'Thời gian lên lịch đăng (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'true = đăng ngay (PUBLISHED), false = DRAFT' })
  @IsOptional()
  @IsBoolean()
  publishNow?: boolean;
}

export class UpdatePostDto {
  @ApiPropertyOptional({ description: 'Tiêu đề bài viết' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ description: 'Nội dung HTML' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Tóm tắt ngắn' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  excerpt?: string;

  @ApiPropertyOptional({ enum: PostCategory })
  @IsOptional()
  @IsEnum(PostCategory)
  category?: PostCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ enum: PostStatus })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}

export class PostQueryDto {
  @ApiPropertyOptional({ enum: PostCategory })
  @IsOptional()
  @IsEnum(PostCategory)
  category?: PostCategory;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo tiêu đề, tóm tắt' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Type(() => Number)
  limit?: number = 10;
}

export class ReactPostDto {
  @ApiProperty({ enum: ReactionType, description: 'Loại reaction' })
  @IsEnum(ReactionType)
  type: ReactionType;
}

export class CreateCommentDto {
  @ApiProperty({ description: 'Nội dung bình luận' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;

  @ApiPropertyOptional({ description: 'ID comment cha (để trả lời)' })
  @IsOptional()
  @IsString()
  parentId?: string;
}
