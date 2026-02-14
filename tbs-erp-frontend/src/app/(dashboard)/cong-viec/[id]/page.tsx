'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { useTask, useChangeTaskStatus, useAddComment } from '@/lib/hooks/use-tasks';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from '@/lib/utils/constants';
import { formatDate } from '@/lib/utils/format';
import type { TaskStatus, TaskPriority } from '@/lib/types';
import { TaskStatus as TaskStatusEnum } from '@/lib/types';

export default function TaskDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: task, isLoading } = useTask(id);
  const changeStatus = useChangeTaskStatus();
  const addComment = useAddComment();
  const [commentText, setCommentText] = useState('');

  if (isLoading) return <LoadingOverlay className="h-[60vh]" />;
  if (!task) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Không tìm thấy công việc</p>
        <Link href="/cong-viec" className="text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const t = task as any;
  const status = t.status as TaskStatus;
  const priority = t.priority as TaskPriority;

  const handleStatusChange = (newStatus: string) => {
    changeStatus.mutate({ id, status: newStatus });
  };

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    addComment.mutate({ id, content: commentText }, {
      onSuccess: () => setCommentText(''),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/cong-viec" className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{t.code}</h1>
            <StatusBadge
              label={TASK_STATUS_LABELS[status] || status}
              colorClass={TASK_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
            />
            <StatusBadge
              label={TASK_PRIORITY_LABELS[priority] || priority}
              colorClass={TASK_PRIORITY_COLORS[priority] || 'bg-gray-100 text-gray-700'}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Tạo lúc {formatDate(t.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Thông tin công việc</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tiêu đề</dt>
              <dd className="text-right max-w-[60%]">{t.title}</dd>
            </div>
            {t.description && (
              <div>
                <dt className="text-muted-foreground mb-1">Mô tả</dt>
                <dd className="whitespace-pre-wrap text-sm">{t.description}</dd>
              </div>
            )}
            {t.tags && t.tags.length > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tags</dt>
                <dd className="flex flex-wrap gap-1">
                  {t.tags.map((tag: string) => (
                    <span key={tag} className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">{tag}</span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Phân công</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Người thực hiện</dt>
              <dd>{t.assignee?.fullName ?? '---'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Người tạo</dt>
              <dd>{t.createdByUser?.fullName ?? '---'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Thời gian</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ngày tạo</dt>
              <dd>{formatDate(t.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Hạn hoàn thành</dt>
              <dd className={t.dueDate && new Date(t.dueDate) < new Date() && status !== 'COMPLETED' ? 'text-destructive font-medium' : ''}>
                {t.dueDate ? formatDate(t.dueDate, 'dd/MM/yyyy') : '---'}
              </dd>
            </div>
            {t.completedAt && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Hoàn thành lúc</dt>
                <dd>{formatDate(t.completedAt)}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Thay đổi trạng thái</h3>
          <div className="flex flex-wrap gap-2">
            {status !== TaskStatusEnum.IN_PROGRESS && status !== TaskStatusEnum.COMPLETED && (
              <button onClick={() => handleStatusChange(TaskStatusEnum.IN_PROGRESS)} disabled={changeStatus.isPending} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Bắt đầu</button>
            )}
            {status !== TaskStatusEnum.COMPLETED && (
              <button onClick={() => handleStatusChange(TaskStatusEnum.COMPLETED)} disabled={changeStatus.isPending} className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">Hoàn thành</button>
            )}
            {status !== TaskStatusEnum.CANCELLED && status !== TaskStatusEnum.COMPLETED && (
              <button onClick={() => handleStatusChange(TaskStatusEnum.CANCELLED)} disabled={changeStatus.isPending} className="rounded-md border border-destructive px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50">Hủy</button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Bình luận</h3>
        {t.comments && t.comments.length > 0 ? (
          <div className="space-y-4 mb-4">
            {t.comments.map((comment: any) => (
              <div key={comment.id} className="rounded-md bg-muted/50 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{comment.user?.fullName ?? 'Ẩn danh'}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
                </div>
                <p className="text-sm">{comment.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-4">Chưa có bình luận</p>
        )}
        <div className="flex gap-2">
          <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Nhập bình luận..." onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} className="flex-1 h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <button onClick={handleAddComment} disabled={addComment.isPending || !commentText.trim()} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Send className="h-4 w-4" /> Gửi
          </button>
        </div>
      </div>
    </div>
  );
}
