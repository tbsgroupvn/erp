import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class TaskQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by assignee ID' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ description: 'Filter by priority', enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Search by title' })
  @IsOptional()
  @IsString()
  search?: string;
}
