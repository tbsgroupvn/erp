import { IsString, IsEnum, IsBoolean, IsOptional, MaxLength } from 'class-validator';
import { MenuLocation } from '@prisma/client';

export class CreateMenuDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsEnum(MenuLocation)
  location: MenuLocation;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
