'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  X,
  Send,
  Calendar,
  User,
  Tag,
  Clock,
  CheckSquare,
  Square,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format';
import { TaskStatus, TaskPriority } from '@/lib/types';
import type { Task } from '@/lib/types';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
} from '@/lib/utils/constants';
import { useUpdateTask, useAddComment } from '@/lib/hooks/use-tasks';

interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

interface TaskDetailSheetProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}

export function TaskDetailSheet({ task, open, onClose }: TaskDetailSheetProps) {
  const updateTask = useUpdateTask();
  const addComment = useAddComment();

  // Editable fields
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.OPEN);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [dueDate, setDueDate] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Local subtasks (frontend-only demo since backend may not support)
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');

  // Comment
  const [commentText, setCommentText] = useState('');

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Sync task data when sheet opens
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setStatus(task.status as TaskStatus);
      setPriority(task.priority as TaskPriority);
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
      setTags(task.tags ?? []);
      setSubtasks([]);
    }
  }, [task]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  if (!task) return null;

  const handleSaveTitle = () => {
    setEditingTitle(false);
    if (title.trim() && title !== task.title) {
      updateTask.mutate({ id: task.id, data: { title: title.trim() } });
    }
  };

  const handleFieldBlur = (
    field: keyof { description: string; status: TaskStatus; priority: TaskPriority; dueDate: string },
    value: string,
  ) => {
    const original: Record<string, unknown> = {
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
    };
    if (value !== original[field]) {
      updateTask.mutate({
        id: task.id,
        data: { [field]: value || undefined } as Record<string, unknown>,
      });
    }
  };

  const handleAddTag = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      const updated = [...tags, tagInput.trim()];
      setTags(updated);
      setTagInput('');
      updateTask.mutate({ id: task.id, data: { tags: updated } });
    }
  };

  const handleRemoveTag = (tag: string) => {
    const updated = tags.filter((t) => t !== tag);
    setTags(updated);
    updateTask.mutate({ id: task.id, data: { tags: updated } });
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: newSubtask.trim(), done: false },
    ]);
    setNewSubtask('');
  };

  const handleToggleSubtask = (id: string) => {
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  };

  const handleDeleteSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    addComment.mutate(
      { id: task.id, content: commentText },
      { onSuccess: () => setCommentText('') },
    );
  };

  const doneCount = subtasks.filter((s) => s.done).length;
  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== 'COMPLETED' &&
    task.status !== 'CANCELLED';

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-xl flex-col overflow-hidden p-0 sm:max-w-xl"
      >
        {/* Header */}
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {editingTitle ? (
                <input
                  ref={titleInputRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                  className="w-full rounded border bg-background px-2 py-1 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                />
              ) : (
                <SheetTitle
                  className="cursor-pointer text-base leading-snug hover:text-primary"
                  onClick={() => setEditingTitle(true)}
                  title="Nhấn để sửa tiêu đề"
                >
                  {title}
                </SheetTitle>
              )}
              <p className="mt-1 text-xs text-muted-foreground font-mono">{task.code}</p>
            </div>
            <button
              onClick={onClose}
              className="mt-1 flex-shrink-0 rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Trạng thái
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const val = e.target.value as TaskStatus;
                  setStatus(val);
                  handleFieldBlur('status', val);
                }}
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.values(TaskStatus).map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                Ưu tiên
              </label>
              <select
                value={priority}
                onChange={(e) => {
                  const val = e.target.value as TaskPriority;
                  setPriority(val);
                  handleFieldBlur('priority', val);
                }}
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.values(TaskPriority).map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <User className="h-3.5 w-3.5" /> Người thực hiện
            </label>
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm">
              {task.assignee ? (
                <>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {task.assignee.fullName.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase()}
                  </span>
                  <span>{task.assignee.fullName}</span>
                </>
              ) : (
                <span className="text-muted-foreground">Chưa phân công</span>
              )}
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" /> Hạn hoàn thành
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={() => handleFieldBlur('dueDate', dueDate)}
              className={cn(
                'h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                isOverdue && 'border-destructive text-destructive',
              )}
            />
            {isOverdue && (
              <p className="mt-1 text-xs text-destructive">Công việc đã quá hạn</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => handleFieldBlur('description', description)}
              rows={3}
              placeholder="Thêm mô tả..."
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Tag className="h-3.5 w-3.5" /> Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-0.5 opacity-60 hover:opacity-100"
                    aria-label={`Xóa tag ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Nhập tag rồi Enter..."
              className="h-8 w-full rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Subtasks */}
          <div>
            <label className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5" />
                Công việc con
              </span>
              {subtasks.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {doneCount}/{subtasks.length}
                </span>
              )}
            </label>

            {subtasks.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {/* Progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all duration-300"
                    style={{ width: `${subtasks.length ? (doneCount / subtasks.length) * 100 : 0}%` }}
                  />
                </div>
                {subtasks.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50"
                  >
                    <button
                      onClick={() => handleToggleSubtask(sub.id)}
                      className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      {sub.done ? (
                        <CheckSquare className="h-4 w-4 text-green-500" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                    <span
                      className={cn(
                        'flex-1 text-sm',
                        sub.done && 'line-through text-muted-foreground',
                      )}
                    >
                      {sub.title}
                    </span>
                    <button
                      onClick={() => handleDeleteSubtask(sub.id)}
                      className="opacity-0 hover:opacity-100 group-hover:opacity-50 text-muted-foreground hover:text-destructive"
                      aria-label="Xóa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                placeholder="Thêm công việc con..."
                className="flex-1 h-8 rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={handleAddSubtask}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent"
                aria-label="Thêm"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              Bình luận ({task.comments?.length ?? 0})
            </label>
            {task.comments && task.comments.length > 0 ? (
              <div className="mb-3 space-y-3">
                {task.comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg bg-muted/50 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold">
                        {comment.user?.fullName ?? 'Ẩn danh'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-xs text-muted-foreground">Chưa có bình luận</p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Nhập bình luận..."
                className="flex-1 h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={handleAddComment}
                disabled={addComment.isPending || !commentText.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" /> Gửi
              </button>
            </div>
          </div>

          {/* Activity log */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Hoạt động</p>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>
                Tạo bởi <span className="font-medium text-foreground">{task.createdByUser?.fullName ?? '---'}</span>
                {' '}{formatDate(task.createdAt)}
              </p>
              {task.updatedAt !== task.createdAt && (
                <p>Cập nhật lần cuối {formatDate(task.updatedAt)}</p>
              )}
              {task.completedAt && (
                <p>
                  Hoàn thành lúc{' '}
                  <span className="font-medium text-green-600">
                    {formatDate(task.completedAt)}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
