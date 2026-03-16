import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class ChatDto {
  @ApiPropertyOptional({ description: 'Session ID (omit to create new session)' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty({ description: 'User message', example: 'Đơn hàng của tôi đang ở đâu?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;
}
