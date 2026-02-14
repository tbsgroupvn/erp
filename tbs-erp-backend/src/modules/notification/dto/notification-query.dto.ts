import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';

export class NotificationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by type (ORDER, PAYMENT, APPROVAL, etc.)' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by read status (true/false)' })
  @IsOptional()
  @IsString()
  isRead?: string;
}
