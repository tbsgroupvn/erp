import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, TaskStatus, TaskPriority } from '@prisma/client';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new task with auto-generated code TSK-YYYYMM-XXXX.
   * Includes retry logic for unique constraint violations on code generation.
   */
  async createTask(userId: string, dto: CreateTaskDto) {
    // Validate deadline is in the future when provided
    if (dto.dueDate) {
      const dueDate = new Date(dto.dueDate);
      if (isNaN(dueDate.getTime())) {
        throw new BadRequestException('Invalid dueDate format');
      }
      if (dueDate <= new Date()) {
        throw new BadRequestException('Task deadline must be in the future');
      }
    }

    let task: any;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const code = await this.generateTaskCode();

        task = await this.prisma.task.create({
          data: {
            code,
            title: dto.title,
            description: dto.description,
            assigneeId: dto.assigneeId,
            priority: dto.priority || TaskPriority.MEDIUM,
            status: TaskStatus.OPEN,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
            entityType: dto.entityType,
            entityId: dto.entityId,
            tags: dto.tags || [],
            createdBy: userId,
          },
          include: {
            assignee: { select: { id: true, fullName: true, email: true } },
            createdByUser: { select: { id: true, fullName: true } },
          },
        });
        break;
      } catch (error) {
        if (error.code === 'P2002' && attempt < 2) {
          this.logger.warn(`Task code conflict on attempt ${attempt + 1}, retrying...`);
          continue;
        }
        throw error;
      }
    }

    this.eventEmitter.emit('task.created', {
      taskId: task.id,
      code: task.code,
      assigneeId: dto.assigneeId,
      createdBy: userId,
    });

    this.logger.log(`Task ${task.code} created by ${userId}`);
    return task;
  }

  /**
   * Updates a task.
   */
  async updateTask(id: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Validate deadline is in the future when updating
    if (dto.dueDate !== undefined) {
      const dueDate = new Date(dto.dueDate);
      if (isNaN(dueDate.getTime())) {
        throw new BadRequestException('Invalid dueDate format');
      }
      if (dueDate <= new Date()) {
        throw new BadRequestException('Task deadline must be in the future');
      }
    }

    const updateData: Prisma.TaskUpdateInput = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.dueDate !== undefined) updateData.dueDate = new Date(dto.dueDate);
    if (dto.entityType !== undefined) updateData.entityType = dto.entityType;
    if (dto.entityId !== undefined) updateData.entityId = dto.entityId;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.assigneeId !== undefined) {
      updateData.assignee = { connect: { id: dto.assigneeId } };
    }

    return this.prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  /**
   * Lists tasks with pagination and filters.
   */
  async findAll(query: TaskQueryDto) {
    const where: Prisma.TaskWhereInput = {};

    if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy as Prisma.TaskOrderByWithRelationInput,
        include: {
          assignee: { select: { id: true, fullName: true } },
          createdByUser: { select: { id: true, fullName: true } },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets task detail with comments.
   */
  async findById(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        createdByUser: { select: { id: true, fullName: true } },
        comments: {
          include: {
            user: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  /**
   * Reassigns a task to another user.
   */
  async assignTo(id: string, assigneeId: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return this.prisma.task.update({
      where: { id },
      data: { assignee: { connect: { id: assigneeId } } },
      include: {
        assignee: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Changes task status.
   */
  async changeStatus(id: string, status: TaskStatus) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Validate status transitions
    const validTransitions: Record<string, TaskStatus[]> = {
      [TaskStatus.OPEN]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
      [TaskStatus.IN_PROGRESS]: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.OPEN],
      [TaskStatus.COMPLETED]: [],
      [TaskStatus.CANCELLED]: [],
    };

    const allowed = validTransitions[task.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${task.status} to ${status}`,
      );
    }

    const updateData: Prisma.TaskUpdateInput = { status };
    if (status === TaskStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    return this.prisma.task.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Adds a comment to a task.
   */
  async addComment(taskId: string, userId: string, content: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    return this.prisma.taskComment.create({
      data: {
        taskId,
        userId,
        content,
      },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Gets tasks assigned to a specific user.
   */
  async getMyTasks(userId: string, query: TaskQueryDto) {
    const where: Prisma.TaskWhereInput = { assigneeId: userId };

    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { dueDate: 'asc' },
        include: {
          createdByUser: { select: { id: true, fullName: true } },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets overdue tasks (past due date and not completed/cancelled).
   */
  async getOverdueTasks() {
    return this.prisma.task.findMany({
      where: {
        dueDate: { lt: new Date() },
        status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
      },
      include: {
        assignee: { select: { id: true, fullName: true } },
        createdByUser: { select: { id: true, fullName: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * Generates the next task code in format TSK-YYYYMM-XXXX.
   */
  private async generateTaskCode(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `TSK-${yearMonth}`;

    const latest = await this.prisma.task.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latest) {
      const lastSeq = parseInt(latest.code.split('-').pop() || '0', 10);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }
}
