import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CursorPaginationDto } from '@common/dto/pagination.dto';

export class ConversationQueryDto {
  @ApiPropertyOptional({ description: 'Search by conversation name or participant name' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class MessageQueryDto extends CursorPaginationDto {}
