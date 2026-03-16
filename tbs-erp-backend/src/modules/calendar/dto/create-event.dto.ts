import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventVisibility } from '@prisma/client';

export class CreateEventDto {
  @ApiProperty({ description: 'Tieu de su kien' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Mo ta chi tiet' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Dia diem' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Mau su kien (hex)', example: '#3b82f6' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: 'Su kien ca ngay', default: false })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiProperty({ description: 'Thoi gian bat dau (ISO 8601)', example: '2026-03-10T09:00:00.000Z' })
  @IsDateString()
  startAt: string;

  @ApiProperty({ description: 'Thoi gian ket thuc (ISO 8601)', example: '2026-03-10T10:00:00.000Z' })
  @IsDateString()
  endAt: string;

  @ApiPropertyOptional({ description: 'Quy tac lap lai (iCal RRULE)', example: 'FREQ=WEEKLY;BYDAY=MO,WE,FR' })
  @IsOptional()
  @IsString()
  recurrence?: string;

  @ApiPropertyOptional({ enum: EventVisibility, default: EventVisibility.PUBLIC })
  @IsOptional()
  @IsEnum(EventVisibility)
  visibility?: EventVisibility;

  @ApiPropertyOptional({ description: 'ID phong hop' })
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiPropertyOptional({ description: 'Danh sach ID nguoi tham gia', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantIds?: string[];

  @ApiPropertyOptional({
    description: 'Nhac truoc bao nhieu phut (vi du: [15, 60])',
    type: [Number],
    example: [15, 60],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  reminderMinutes?: number[];
}

export class UpdateEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ enum: EventVisibility })
  @IsOptional()
  @IsEnum(EventVisibility)
  visibility?: EventVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roomId?: string;
}

export class RespondEventDto {
  @ApiProperty({ enum: ['ACCEPTED', 'DECLINED', 'TENTATIVE'] })
  @IsString()
  status: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';
}

export class EventQueryDto {
  @ApiPropertyOptional({ description: 'Bat dau khoang thoi gian (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Ket thuc khoang thoi gian (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Xem lich cua user khac (chi free/busy)' })
  @IsOptional()
  @IsString()
  userId?: string;
}
