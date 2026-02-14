'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { useCreateTask } from '@/lib/hooks/use-tasks';
import { TaskPriority } from '@/lib/types';
import { TASK_PRIORITY_LABELS } from '@/lib/utils/constants';

const createTaskSchema = z.object({
  title: z.string().min(1, 'Tiêu đề bắt buộc'),
  description: z.string().optional(),
  assigneeId: z.string().min(1, 'Chọn người thực hiện'),
  priority: z.nativeEnum(TaskPriority),
  dueDate: z.string().optional(),
  tags: z.string().optional(),
});

type CreateTaskForm = z.infer<typeof createTaskSchema>;

export default function TaoMoiCongViecPage() {
  const router = useRouter();
  const createTask = useCreateTask();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      assigneeId: '',
      priority: TaskPriority.MEDIUM,
      dueDate: '',
      tags: '',
    },
  });

  const onSubmit = (data: CreateTaskForm) => {
    const payload = {
      ...data,
      tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    };
    createTask.mutate(payload, {
      onSuccess: () => {
        toast.success('Tạo công việc thành công');
        router.push('/cong-viec');
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.message || 'Lỗi tạo công việc');
      },
    });
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/cong-viec" className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader title="Tạo công việc mới" className="pb-0" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <label className="text-sm font-medium">Tiêu đề *</label>
              <input
                {...register('title')}
                placeholder="Nhập tiêu đề công việc"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>
            <div className="sm:col-span-2 space-y-2">
              <label className="text-sm font-medium">Mô tả</label>
              <textarea
                {...register('description')}
                rows={4}
                placeholder="Mô tả chi tiết công việc..."
                className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Người thực hiện *</label>
              <input
                {...register('assigneeId')}
                placeholder="ID người thực hiện"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.assigneeId && (
                <p className="text-xs text-destructive">{errors.assigneeId.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ưu tiên *</label>
              <select
                {...register('priority')}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Hạn hoàn thành</label>
              <input
                {...register('dueDate')}
                type="date"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
              <input
                {...register('tags')}
                placeholder="tag1, tag2, tag3"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">Phân cách bằng dấu phẩy</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Link href="/cong-viec" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
              Hủy
            </Link>
            <button
              type="submit"
              disabled={createTask.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createTask.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Tạo công việc
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
