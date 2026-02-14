import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { AddCommentDto } from './dto/add-comment.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  async create(@Body() dto: CreateTaskDto, @CurrentUser() user: ICurrentUser) {
    const task = await this.taskService.createTask(user.id, dto);
    return BaseResponse.ok(task, 'Task created successfully');
  }

  @Get()
  @ApiOperation({ summary: 'List tasks with filters' })
  @ApiResponse({ status: 200, description: 'Tasks retrieved successfully' })
  async findAll(@Query() query: TaskQueryDto) {
    const result = await this.taskService.findAll(query);
    return PaginatedResponse.paginate(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my tasks' })
  async getMyTasks(@Query() query: TaskQueryDto, @CurrentUser() user: ICurrentUser) {
    const result = await this.taskService.getMyTasks(user.id, query);
    return PaginatedResponse.paginate(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get('overdue')
  @ApiOperation({ summary: 'Get overdue tasks' })
  async getOverdueTasks() {
    const tasks = await this.taskService.getOverdueTasks();
    return BaseResponse.ok(tasks);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task detail with comments' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  async findById(@Param('id') id: string) {
    const task = await this.taskService.findById(id);
    return BaseResponse.ok(task);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update task details' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    const task = await this.taskService.updateTask(id, dto);
    return BaseResponse.ok(task, 'Task updated successfully');
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Reassign task' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  async assignTo(@Param('id') id: string, @Body('assigneeId') assigneeId: string) {
    const task = await this.taskService.assignTo(id, assigneeId);
    return BaseResponse.ok(task, 'Task reassigned');
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change task status' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  async changeStatus(
    @Param('id') id: string,
    @Body('status') status: TaskStatus,
  ) {
    const task = await this.taskService.changeStatus(id, status);
    return BaseResponse.ok(task, `Status changed to ${status}`);
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a comment to a task' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  async addComment(
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const comment = await this.taskService.addComment(id, user.id, dto.content);
    return BaseResponse.ok(comment, 'Comment added');
  }
}
