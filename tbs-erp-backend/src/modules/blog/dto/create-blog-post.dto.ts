import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BlogPostStatus } from '@prisma/client';
import { SanitizeHtml, SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class CreateBlogPostDto {
  @ApiProperty({
    description: 'Blog post title',
    example: 'How to Optimize Your Logistics Operations',
    maxLength: 500,
  })
  @SanitizeHtmlStrict() // Remove all HTML from title
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @MinLength(3)
  title: string;

  @ApiPropertyOptional({
    description: 'Short excerpt or summary',
    example: 'Learn the best practices for streamlining your supply chain.',
    maxLength: 1000,
  })
  @SanitizeHtml() // Allow safe HTML in excerpt
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  excerpt?: string;

  @ApiProperty({
    description: 'Full blog post content (HTML/Markdown) - XSS-safe, dangerous tags removed',
    example: "<h2>Introduction</h2><p>In today's fast-paced logistics industry...</p>",
  })
  @SanitizeHtml() // Allow safe HTML in content, remove dangerous tags
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: 'Cover image URL',
    example: '/uploads/blog/cover-image.jpg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string;

  @ApiProperty({
    description: 'Author name',
    example: 'John Doe',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  author: string;

  @ApiPropertyOptional({
    description: 'Tags for categorization',
    example: ['logistics', 'supply-chain', 'optimization'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Publication status',
    enum: BlogPostStatus,
    default: BlogPostStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(BlogPostStatus)
  status?: BlogPostStatus;
}
