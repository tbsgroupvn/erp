import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UploadMediaDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  folder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  alt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;
}
