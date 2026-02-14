import { IsString, IsOptional, IsBoolean, IsInt, IsArray, MaxLength } from 'class-validator';

export class CreateMenuItemDto {
  @IsString()
  @MaxLength(255)
  label: string;

  @IsString()
  @MaxLength(500)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  target?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}
