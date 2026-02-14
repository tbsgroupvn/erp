import { IsArray, IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum PhotoType {
  GENERAL = 'general',
  DETAIL = 'detail',
  DEFECT = 'defect',
}

export class AddPhotosDto {
  @ApiProperty({ description: 'Array of photo URLs to add', type: [String] })
  @IsArray()
  @IsString({ each: true })
  photoUrls: string[];

  @ApiProperty({
    description: 'Type of photos being added',
    enum: PhotoType,
    example: PhotoType.GENERAL,
  })
  @IsEnum(PhotoType)
  type: PhotoType;
}
