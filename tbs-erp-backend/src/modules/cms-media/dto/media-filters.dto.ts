import { IsOptional, IsEnum, IsString, IsInt, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MediaType } from '@prisma/client';

export class MediaFiltersDto {
  @IsOptional()
  @IsEnum(MediaType)
  type?: MediaType;

  @IsOptional()
  @IsString()
  folder?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
