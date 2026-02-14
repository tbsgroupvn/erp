import { IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PageStatus } from '@prisma/client';

export class PageFiltersDto {
  @IsOptional()
  @IsEnum(PageStatus)
  status?: PageStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
