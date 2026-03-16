'use client';

import { MessageSquare, CalendarDays, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format';
import { TaskPriority } from '@/lib/types';
import type { Task } from '@/lib/types';

const PRIORITY_BADGE: Record<TaskPriority, { label: string; className: string }> = {
  [TaskPriority.URGENT]: { label: 'Khẩn', className: 'bg-red-100 text-red-700 border-red-200' },
  [TaskPriority.HIGH]: { label: 'Cao', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  [TaskPriority.MEDIUM]: { label: 'TB', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  [TaskPriority.LOW]: { label: 'Thấp', className: 'bg-blue-100 text-blue-700 border-blue-200' },
};

interface TaskCardProps {
  task: Task;
  onClick?: (task: Task) => void;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}

export function TaskCard({ task, onClick, isDragging, dragHandleProps }: TaskCardProps) {
  const priority = PRIORITY_BADGE[task.priority as TaskPriority] ?? PRIORITY_BADGE[TaskPriority.LOW];
  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== 'COMPLETED' &&
    task.status !== 'CANCELLED';

  const initials = task.assignee?.fullName
    ? task.assignee.fullName
        .split(' ')
        .map((w) => w[0])
        .slice(-2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <div
      onClick={() => onClick?.(task)}
      className={cn(
        'group relative rounded-lg border bg-card p-3 shadow-sm cursor-pointer',
        'hover:border-primary/40 hover:shadow-md transition-all duration-150',
        isDragging && 'opacity-50 rotate-1 scale-105',
      )}
    >
      {/* Drag handle */}
      <button
        {...dragHandleProps}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded text-muted-foreground/50 hover:text-muted-foreground group-hover:flex"
        aria-label="Kéo thả"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Priority badge */}
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
            priority.className,
          )}
        >
          {priority.label}
        </span>
        <span className="text-xs text-muted-foreground font-mono">{task.code}</span>
      </div>

      {/* Title */}
      <p className="line-clamp-2 text-sm font-medium leading-snug mb-3 pr-4">{task.title}</p>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {/* Assignee avatar */}
          {task.assignee && (
            <div
              title={task.assignee.fullName}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary"
            >
              {initials}
            </div>
          )}

          {/* Due date */}
          {task.dueDate && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs',
                isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground',
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {formatDate(task.dueDate, 'dd/MM')}
            </span>
          )}
        </div>

        {/* Comments count */}
        {task.comments && task.comments.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            {task.comments.length}
          </span>
        )}
      </div>
    </div>
  );
}
