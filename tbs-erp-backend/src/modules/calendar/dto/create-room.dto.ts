import { IsString, IsOptional, IsInt, IsArray, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomStatus } from '@prisma/client';

export class CreateRoomDto {
  @ApiProperty({ description: 'Ten phong hop' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Vi tri phong (tang, khu)', example: 'Tang 2, Phong A' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ description: 'Suc chua (so nguoi)', example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity: number;

  @ApiPropertyOptional({
    description: 'Trang thiet bi',
    type: [String],
    example: ['projector', 'whiteboard', 'video_conf'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];
}

export class UpdateRoomStatusDto {
  @ApiProperty({ enum: RoomStatus })
  @IsEnum(RoomStatus)
  status: RoomStatus;
}
