import { IsArray, IsString, IsIn, IsOptional, MinLength } from 'class-validator';

export class CustomsSplitDto {
  @IsArray()
  @IsString({ each: true })
  heldPackageIds: string[];

  @IsString()
  @MinLength(5)
  reason: string;

  @IsOptional()
  @IsString()
  estimatedReleaseDate?: string;
}

export class ResolveHeldPackagesDto {
  @IsArray()
  @IsString({ each: true })
  packageIds: string[];

  @IsIn(['RELEASED', 'CONFISCATED'])
  resolution: 'RELEASED' | 'CONFISCATED';

  @IsOptional()
  @IsString()
  note?: string;
}
