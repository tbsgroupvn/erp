import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsArray,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ description: 'Tiêu đề cuộc họp', example: 'Họp dự án Q2' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Thời gian dự kiến (ISO 8601)', example: '2026-03-10T09:00:00Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'Số người tối đa', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(2)
  maxParticipants?: number;

  @ApiPropertyOptional({ description: 'Danh sách userId được mời', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantIds?: string[];

  @ApiPropertyOptional({ description: 'ID cuộc trò chuyện liên kết' })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({ description: 'ID sự kiện lịch liên kết' })
  @IsOptional()
  @IsString()
  calendarEventId?: string;
}

export class JoinRoomDto {
  @ApiProperty({ description: 'ID phòng họp' })
  @IsString()
  roomId: string;
}
