import { IsString, IsOptional, IsArray, MaxLength } from 'class-validator';

export class UpdateMediaDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  alt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  folder?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
