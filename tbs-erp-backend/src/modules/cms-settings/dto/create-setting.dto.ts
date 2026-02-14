import { IsString, IsBoolean, IsOptional, IsInt, MaxLength } from 'class-validator';

export class CreateSettingDto {
  @IsString()
  @MaxLength(255)
  key: string;

  @IsString()
  value: string;

  @IsString()
  @MaxLength(50)
  type: string; // string, number, boolean, json, image

  @IsString()
  @MaxLength(100)
  group: string;

  @IsString()
  @MaxLength(255)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  hint?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
