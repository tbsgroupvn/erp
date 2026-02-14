import { IsString, IsOptional, IsEnum, IsArray, IsInt, MaxLength } from 'class-validator';
import { PageStatus } from '@prisma/client';

export class CreatePageDto {
  @IsString()
  @MaxLength(255)
  slug: string;

  @IsString()
  @MaxLength(500)
  title: string;

  @IsString()
  @MaxLength(500000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metaKeywords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ogImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  template?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  featuredImage?: string;

  @IsEnum(PageStatus)
  status: PageStatus;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}
