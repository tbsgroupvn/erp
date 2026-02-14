// ============================================
// TASK TYPES — Task, TaskComment
// ============================================

import { TaskPriority, TaskStatus } from './enums';

export interface Task {
  id: string;
  code: string;
  title: string;
  description?: string;
  assigneeId: string;
  assignee?: { id: string; fullName: string };
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  entityType?: string;
  entityId?: string;
  tags: string[];
  comments?: TaskComment[];
  createdBy: string;
  createdByUser?: { id: string; fullName: string };
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  user?: { id: string; fullName: string };
  content: string;
  createdAt: string;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  assigneeId: string;
  priority?: TaskPriority;
  dueDate?: string;
  entityType?: string;
  entityId?: string;
  tags?: string[];
}

export interface UpdateTaskDto extends Partial<CreateTaskDto> {}

export interface TaskQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
}
