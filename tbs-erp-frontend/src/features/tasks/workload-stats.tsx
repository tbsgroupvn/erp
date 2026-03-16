'use client';

import { useMemo } from 'react';
import { AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { TaskStatus } from '@/lib/types';
import type { Task } from '@/lib/types';
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '@/lib/utils/constants';

interface WorkloadStatsProps {
  tasks: Task[];
}

const STATUS_ORDER: TaskStatus[] = [
  TaskStatus.OPEN,
  TaskStatus.IN_PROGRESS,
  TaskStatus.COMPLETED,
  TaskStatus.CANCELLED,
];

// Map status color tokens to solid bar colors
const STATUS_BAR_COLORS: Record<TaskStatus, string> = {
  [TaskStatus.OPEN]: 'bg-slate-400',
  [TaskStatus.IN_PROGRESS]: 'bg-blue-500',
  [TaskStatus.COMPLETED]: 'bg-green-500',
  [TaskStatus.CANCELLED]: 'bg-gray-300',
};

export function WorkloadStats({ tasks }: WorkloadStatsProps) {
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<TaskStatus, number>> = {};
    tasks.forEach((t) => {
      counts[t.status as TaskStatus] = (counts[t.status as TaskStatus] ?? 0) + 1;
    });
    return counts;
  }, [tasks]);

  const overdueTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate) < new Date() &&
          t.status !== TaskStatus.COMPLETED &&
          t.status !== TaskStatus.CANCELLED,
      ),
    [tasks],
  );

  const assigneeCounts = useMemo(() => {
    const map = new Map<string, { name: string; count: number; overdue: number }>();
    tasks.forEach((t) => {
      if (!t.assignee) return;
      const existing = map.get(t.assigneeId);
      const isOverdue =
        t.dueDate &&
        new Date(t.dueDate) < new Date() &&
        t.status !== TaskStatus.COMPLETED &&
        t.status !== TaskStatus.CANCELLED;

      if (existing) {
        existing.count += 1;
        if (isOverdue) existing.overdue += 1;
      } else {
        map.set(t.assigneeId, {
          name: t.assignee.fullName,
          count: 1,
          overdue: isOverdue ? 1 : 0,
        });
      }
    });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [tasks]);

  const maxCount = Math.max(...Object.values(statusCounts), 1);
  const maxAssigneeCount = Math.max(...assigneeCounts.map((a) => a.count), 1);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Status distribution */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Phân bổ trạng thái</h3>
        </div>
        <div className="space-y-2">
          {STATUS_ORDER.map((status) => {
            const count = statusCounts[status] ?? 0;
            const pct = (count / maxCount) * 100;
            return (
              <div key={status}>
                <div className="mb-0.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{TASK_STATUS_LABELS[status]}</span>
                  <span className="font-medium tabular-nums">{count}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', STATUS_BAR_COLORS[status])}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Tổng cộng: <span className="font-semibold text-foreground">{tasks.length}</span> công việc
        </p>
      </div>

      {/* Overdue tasks */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-semibold">Quá hạn</h3>
        </div>
        {overdueTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <span className="text-green-600 text-lg">✓</span>
            </div>
            <p className="text-sm font-medium text-green-700">Không có quá hạn</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-center">
              <span className="text-4xl font-bold text-destructive">{overdueTasks.length}</span>
            </div>
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {overdueTasks.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-md bg-destructive/5 px-2 py-1"
                >
                  <span className="line-clamp-1 text-xs font-medium">{t.title}</span>
                  <span className="ml-2 flex-shrink-0 text-[10px] text-destructive">
                    {t.assignee?.fullName?.split(' ').pop()}
                  </span>
                </div>
              ))}
              {overdueTasks.length > 5 && (
                <p className="text-center text-xs text-muted-foreground">
                  +{overdueTasks.length - 5} công việc khác
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Top assignees */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Top người thực hiện</h3>
        </div>
        {assigneeCounts.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Chưa có dữ liệu</p>
        ) : (
          <div className="space-y-2.5">
            {assigneeCounts.map((a, i) => {
              const pct = (a.count / maxAssigneeCount) * 100;
              return (
                <div key={i}>
                  <div className="mb-0.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {a.name.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase()}
                      </span>
                      <span className="truncate text-muted-foreground">{a.name}</span>
                    </div>
                    <div className="ml-2 flex items-center gap-1 flex-shrink-0">
                      <span className="font-medium tabular-nums">{a.count}</span>
                      {a.overdue > 0 && (
                        <span className="text-destructive text-[10px]">({a.overdue} QH)</span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/60 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
