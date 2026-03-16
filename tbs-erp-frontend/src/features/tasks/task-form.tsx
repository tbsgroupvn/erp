'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils/cn';
import { TaskPriority } from '@/lib/types';
import { TASK_PRIORITY_LABELS } from '@/lib/utils/constants';
import { useCreateTask, useUpdateTask } from '@/lib/hooks/use-tasks';
import type { Task } from '@/lib/types';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const taskSchema = z
  .object({
    title: z.string().min(1, 'Tiêu đề không được để trống').max(200, 'Tiêu đề quá dài'),
    description: z.string().optional(),
    assigneeId: z.string().min(1, 'Chọn người thực hiện'),
    priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    tags: z.string().optional(), // comma-separated
  })
  .refine(
    (data) => {
      if (data.startDate && data.dueDate) {
        return new Date(data.dueDate) >= new Date(data.startDate);
      }
      return true;
    },
    { message: 'Hạn hoàn thành phải sau ngày bắt đầu', path: ['dueDate'] },
  );

type TaskFormValues = z.infer<typeof taskSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  editTask?: Task | null;
}

export function TaskForm({ open, onClose, editTask }: TaskFormProps) {
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const isEditing = !!editTask;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      assigneeId: '',
      priority: TaskPriority.MEDIUM,
      startDate: '',
      dueDate: '',
      tags: '',
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (editTask) {
      reset({
        title: editTask.title,
        description: editTask.description ?? '',
        assigneeId: editTask.assigneeId,
        priority: editTask.priority as TaskPriority,
        startDate: editTask.startDate?.split('T')[0] ?? '',
        dueDate: editTask.dueDate?.split('T')[0] ?? '',
        tags: editTask.tags?.join(', ') ?? '',
      });
    } else {
      reset({
        title: '',
        description: '',
        assigneeId: '',
        priority: TaskPriority.MEDIUM,
        startDate: '',
        dueDate: '',
        tags: '',
      });
    }
  }, [editTask, open, reset]);

  const onSubmit = async (values: TaskFormValues) => {
    const payload = {
      title: values.title,
      description: values.description || undefined,
      assigneeId: values.assigneeId,
      priority: values.priority,
      startDate: values.startDate || undefined,
      dueDate: values.dueDate || undefined,
      tags: values.tags
        ? values.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    };

    if (isEditing && editTask) {
      updateTask.mutate(
        { id: editTask.id, data: payload },
        { onSuccess: () => { reset(); onClose(); } },
      );
    } else {
      createTask.mutate(payload, {
        onSuccess: () => { reset(); onClose(); },
      });
    }
  };

  const isPending = createTask.isPending || updateTask.isPending || isSubmitting;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Sửa công việc' : 'Tạo công việc mới'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Tiêu đề <span className="text-destructive">*</span>
            </label>
            <input
              {...register('title')}
              placeholder="Nhập tiêu đề công việc..."
              className={cn(
                'h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                errors.title && 'border-destructive',
              )}
            />
            {errors.title && (
              <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium">Mô tả</label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Mô tả chi tiết..."
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Assignee ID */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              ID người thực hiện <span className="text-destructive">*</span>
            </label>
            <input
              {...register('assigneeId')}
              placeholder="User ID..."
              className={cn(
                'h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                errors.assigneeId && 'border-destructive',
              )}
            />
            {errors.assigneeId && (
              <p className="mt-1 text-xs text-destructive">{errors.assigneeId.message}</p>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="mb-1 block text-sm font-medium">Ưu tiên</label>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {Object.values(TaskPriority).map((p) => (
                    <option key={p} value={p}>
                      {TASK_PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Ngày bắt đầu</label>
              <input
                type="date"
                {...register('startDate')}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Hạn hoàn thành</label>
              <input
                type="date"
                {...register('dueDate')}
                className={cn(
                  'h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                  errors.dueDate && 'border-destructive',
                )}
              />
              {errors.dueDate && (
                <p className="mt-1 text-xs text-destructive">{errors.dueDate.message}</p>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1 block text-sm font-medium">Tags</label>
            <input
              {...register('tags')}
              placeholder="tag1, tag2, tag3 (cách nhau bằng dấu phẩy)"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">Nhập các tag, cách nhau bằng dấu phẩy</p>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => { reset(); onClose(); }}
              className="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-accent"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? 'Đang lưu...' : isEditing ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
