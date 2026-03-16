import { IsOptional, IsString, IsBoolean, IsInt, Min, IsNotEmpty } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { SanitizeHtml, SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class GetFaqDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPublished?: boolean | string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class CreateFaqDto {
  @SanitizeHtmlStrict() // Remove all HTML from question
  @IsNotEmpty()
  @IsString()
  question: string;

  @SanitizeHtml() // Allow safe HTML in answer
  @IsNotEmpty()
  @IsString()
  answer: string;

  @IsNotEmpty()
  @IsString()
  category: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateFaqDto {
  @SanitizeHtmlStrict() // Remove all HTML from question
  @IsOptional()
  @IsString()
  question?: string;

  @SanitizeHtml() // Allow safe HTML in answer
  @IsOptional()
  @IsString()
  answer?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
