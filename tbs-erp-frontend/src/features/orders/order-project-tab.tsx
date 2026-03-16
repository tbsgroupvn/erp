'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FolderOpen,
  GitMerge,
  ListChecks,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrderProject } from '@/lib/hooks/use-order-project';
import { OrderProjectTimeline, STAGE_LABELS, DEPARTMENT_LABELS } from './order-project-timeline';
import { OrderAssignmentCard } from './order-assignment-card';
import type { OrderProjectAutoTask } from '@/lib/types/order-project.types';
import { formatDate } from '@/lib/utils/format';

// ─── Props ────────────────────────────────────────────────────────────────────

interface OrderProjectTabProps {
  orderId: string;
  orderCode: string;
}

// ─── SLA bar helpers ──────────────────────────────────────────────────────────

function slaBarColor(percent: number, isOverdue: boolean): string {
  if (isOverdue) return 'bg-red-500';
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 70) return 'bg-amber-400';
  return 'bg-emerald-500';
}

function slaTrackColor(percent: number, isOverdue: boolean): string {
  if (isOverdue) return 'bg-red-100';
  if (percent >= 90) return 'bg-red-100';
  if (percent >= 70) return 'bg-amber-100';
  return 'bg-emerald-100';
}

function formatRemainingMs(remainingMs: number | null, isOverdue: boolean): string {
  if (remainingMs == null) return '—';
  const absMs = Math.abs(remainingMs);
  const totalMinutes = Math.floor(absMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeStr =
    hours > 0
      ? minutes > 0
        ? `${hours} giờ ${minutes} phút`
        : `${hours} giờ`
      : `${minutes} phút`;
  return isOverdue ? `Quá hạn ${timeStr}` : `Còn lại ${timeStr}`;
}

// ─── Task status helpers ──────────────────────────────────────────────────────

const TASK_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Chờ xử lý',
  IN_PROGRESS: 'Đang làm',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã huỷ',
};

const TASK_STATUS_CLASS: Record<string, string> = {
  OPEN: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-500 line-through',
};

const TASK_PRIORITY_CLASS: Record<string, string> = {
  LOW: 'bg-slate-50 text-slate-500 border-slate-200',
  MEDIUM: 'bg-blue-50 text-blue-600 border-blue-200',
  HIGH: 'bg-amber-50 text-amber-600 border-amber-200',
  URGENT: 'bg-red-50 text-red-600 border-red-200',
};

const TASK_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Bình thường',
  HIGH: 'Cao',
  URGENT: 'Khẩn',
};

// ─── Auto-task list grouped by stage ─────────────────────────────────────────

function AutoTaskList({ tasks }: { tasks: OrderProjectAutoTask[] }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ListChecks className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Chưa có công việc tự động</p>
      </div>
    );
  }

  // Group tasks by stage
  const grouped = tasks.reduce<Record<string, OrderProjectAutoTask[]>>((acc, task) => {
    const key = task.orderStage ?? 'UNCLASSIFIED';
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([stage, stageTasks]) => (
        <div key={stage}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {STAGE_LABELS[stage] ?? stage}
            </span>
            <span className="text-xs text-muted-foreground">({stageTasks.length})</span>
          </div>

          <div className="space-y-2">
            {stageTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 rounded-md border bg-muted/30 px-3 py-2.5"
              >
                {/* Completion icon */}
                {task.status === 'COMPLETED' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40" />
                )}

                <div className="flex-1 min-w-0 space-y-1">
                  {/* Title + status */}
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-xs font-medium leading-tight', task.status === 'CANCELLED' && 'line-through text-muted-foreground')}>
                      {task.title}
                    </p>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        TASK_STATUS_CLASS[task.status] ?? 'bg-gray-100 text-gray-600',
                      )}
                    >
                      {TASK_STATUS_LABELS[task.status] ?? task.status}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Priority */}
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] px-1.5 py-0',
                        TASK_PRIORITY_CLASS[task.priority] ?? 'bg-gray-50 text-gray-600',
                      )}
                    >
                      {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
                    </Badge>

                    {/* Assignee */}
                    {task.assignee && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {task.assignee.fullName}
                      </span>
                    )}

                    {/* Department */}
                    {task.departmentCode && (
                      <span className="text-[10px] text-muted-foreground">
                        {DEPARTMENT_LABELS[task.departmentCode] ?? task.departmentCode}
                      </span>
                    )}

                    {/* Due date */}
                    {task.dueDate && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        Hạn: {formatDate(task.dueDate, 'dd/MM HH:mm')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* SLA bar */}
      <div className="rounded-lg border bg-card p-4">
        <div className="h-4 w-32 rounded bg-muted mb-3" />
        <div className="h-2 w-full rounded-full bg-muted" />
        <div className="h-3 w-24 rounded bg-muted mt-2" />
      </div>

      {/* Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6 space-y-3 lg:col-span-1">
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-9 w-9 rounded-full bg-muted" />
          <div className="h-2 w-full rounded-full bg-muted" />
        </div>
        <div className="grid grid-cols-3 gap-3 lg:col-span-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
              <div className="h-3 w-16 rounded bg-muted" />
              <div className="h-6 w-10 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Timeline + tasks */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-6 space-y-4">
            <div className="h-4 w-36 rounded bg-muted" />
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex gap-3">
                <div className="h-4 w-4 rounded-full bg-muted shrink-0 mt-1" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OrderProjectTab({ orderId, orderCode }: OrderProjectTabProps) {
  const { data, isLoading, error } = useOrderProject(orderId);

  if (isLoading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-10 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm font-medium">Không thể tải dữ liệu dự án</p>
        <p className="text-xs text-muted-foreground mt-1">Vui lòng thử lại sau</p>
      </div>
    );
  }

  if (!data || (data.assignments.length === 0 && data.handoffs.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-10 text-center">
        <FolderOpen className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Chưa có dữ liệu dự án</p>
        <p className="text-xs text-muted-foreground mt-1">
          Dữ liệu phân công sẽ xuất hiện khi đơn hàng{' '}
          <span className="font-medium">{orderCode}</span> bắt đầu xử lý
        </p>
      </div>
    );
  }

  // Derived values
  const { assignments, handoffs, autoTasks, sla } = data;
  const activeAssignment = assignments.find((a) => a.status === 'ACTIVE');
  const overdueCount = assignments.filter((a) => a.isOverdue).length;
  const clampedPercent = Math.min(Math.max(sla.percentElapsed, 0), 100);

  return (
    <div className="space-y-5">
      {/* ── 1. SLA progress bar (full width) ──────────────────────────── */}
      <Card
        className={cn(
          sla.isOverdue
            ? 'border-red-300 bg-red-50/30'
            : clampedPercent >= 70
            ? 'border-amber-200 bg-amber-50/20'
            : 'border-emerald-200 bg-emerald-50/10',
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-2">
              <Clock
                className={cn(
                  'h-4 w-4 shrink-0',
                  sla.isOverdue
                    ? 'text-red-500'
                    : clampedPercent >= 70
                    ? 'text-amber-500'
                    : 'text-emerald-500',
                )}
              />
              <span className="text-sm font-medium">Tiến độ SLA tổng thể</span>
            </div>
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                sla.isOverdue
                  ? 'text-red-600'
                  : clampedPercent >= 70
                  ? 'text-amber-600'
                  : 'text-emerald-600',
              )}
            >
              {formatRemainingMs(sla.remainingMs, sla.isOverdue)}
            </span>
          </div>

          {/* Custom progress bar for coloured indicator */}
          <div
            className={cn(
              'h-2 w-full rounded-full overflow-hidden',
              slaTrackColor(clampedPercent, sla.isOverdue),
            )}
          >
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                slaBarColor(clampedPercent, sla.isOverdue),
              )}
              style={{ width: `${clampedPercent}%` }}
            />
          </div>

          <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
            {clampedPercent.toFixed(1)}% thời gian đã dùng
          </p>
        </CardContent>
      </Card>

      {/* ── 2. Current assignment + stat cards ────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Current assignment card */}
        <div className="lg:col-span-1">
          <OrderAssignmentCard assignment={activeAssignment} sla={sla} />
        </div>

        {/* Stat mini-cards */}
        <div className="grid grid-cols-3 gap-3 lg:col-span-2 content-start">
          {/* Total assignments */}
          <Card className="border-blue-200 bg-blue-50/30">
            <CardContent className="p-4 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-blue-600">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">Lần phân công</span>
              </div>
              <p className="text-2xl font-bold text-blue-700 tabular-nums">
                {assignments.length}
              </p>
              <p className="text-xs text-muted-foreground">tổng cộng</p>
            </CardContent>
          </Card>

          {/* Total handoffs */}
          <Card className="border-violet-200 bg-violet-50/30">
            <CardContent className="p-4 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-violet-600">
                <GitMerge className="h-4 w-4" />
                <span className="text-xs font-medium">Bàn giao</span>
              </div>
              <p className="text-2xl font-bold text-violet-700 tabular-nums">
                {handoffs.length}
              </p>
              <p className="text-xs text-muted-foreground">lần chuyển giao</p>
            </CardContent>
          </Card>

          {/* Overdue count */}
          <Card
            className={cn(
              overdueCount > 0
                ? 'border-red-300 bg-red-50/30'
                : 'border-emerald-200 bg-emerald-50/30',
            )}
          >
            <CardContent className="p-4 flex flex-col gap-1">
              <div
                className={cn(
                  'flex items-center gap-1.5',
                  overdueCount > 0 ? 'text-red-600' : 'text-emerald-600',
                )}
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs font-medium">Quá hạn</span>
              </div>
              <p
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  overdueCount > 0 ? 'text-red-700' : 'text-emerald-700',
                )}
              >
                {overdueCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {overdueCount > 0 ? 'giai đoạn trễ hạn' : 'đúng tiến độ'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── 3. Timeline + Auto-tasks ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Timeline — left column */}
        <OrderProjectTimeline handoffs={handoffs} assignments={assignments} />

        {/* Auto-tasks — right column */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Công việc tự động
              </CardTitle>
              {autoTasks.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {autoTasks.filter((t) => t.status === 'COMPLETED').length}/
                  {autoTasks.length} hoàn thành
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="max-h-[520px] overflow-y-auto pr-2">
            <AutoTaskList tasks={autoTasks} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
