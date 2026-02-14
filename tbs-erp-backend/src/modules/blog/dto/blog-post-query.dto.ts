import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { BlogPostStatus } from '@prisma/client';

export class BlogPostQueryDto {
  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: BlogPostStatus,
  })
  @IsOptional()
  @IsEnum(BlogPostStatus)
  status?: BlogPostStatus;

  @ApiPropertyOptional({
    description: 'Filter by tag',
    example: 'logistics',
  })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({
    description: 'Search in title, excerpt, or content',
    example: 'logistics',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['createdAt', 'publishedAt', 'title'],
    default: 'publishedAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'publishedAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  get skip(): number {
    const page = this.page ?? 1;
    const limit = this.limit ?? 10;
    return (page - 1) * limit;
  }
}
