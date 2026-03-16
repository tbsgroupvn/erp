'use client';

import { useState, useMemo, useRef, type MouseEvent } from 'react';
import {
  differenceInDays,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  endOfQuarter,
  addDays,
  addMonths,
  addWeeks,
  format,
  isToday,
  isBefore,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { TaskStatus, TaskPriority } from '@/lib/types';
import type { Task } from '@/lib/types';

// ---------------------------------------------------------------------------
// Zoom modes
// ---------------------------------------------------------------------------

type ZoomMode = 'week' | 'month' | 'quarter';

interface ZoomConfig {
  label: string;
  totalDays: number;
  headerFormat: string;
  cellWidth: number;
  getCells: (start: Date) => Date[];
  cellLabel: (d: Date) => string;
}

function getZoomConfig(mode: ZoomMode, rangeStart: Date): ZoomConfig {
  if (mode === 'week') {
    const cells = Array.from({ length: 14 }, (_, i) => addDays(rangeStart, i));
    return {
      label: 'Tuần',
      totalDays: 14,
      headerFormat: 'dd/MM',
      cellWidth: 44,
      getCells: () => cells,
      cellLabel: (d) => format(d, 'dd/MM'),
    };
  }
  if (mode === 'month') {
    const cells = Array.from({ length: 30 }, (_, i) => addDays(rangeStart, i));
    return {
      label: 'Tháng',
      totalDays: 30,
      headerFormat: 'dd',
      cellWidth: 32,
      getCells: () => cells,
      cellLabel: (d) => format(d, 'dd'),
    };
  }
  // quarter
  const cells = Array.from({ length: 13 }, (_, i) => addWeeks(rangeStart, i));
  return {
    label: 'Quý',
    totalDays: 91,
    headerFormat: 'dd/MM',
    cellWidth: 56,
    getCells: () => cells,
    cellLabel: (d) => `T${format(d, 'w', { locale: vi })}`,
  };
}

// ---------------------------------------------------------------------------
// Bar color by status
// ---------------------------------------------------------------------------

const STATUS_BAR: Record<TaskStatus, string> = {
  [TaskStatus.OPEN]: 'bg-slate-400',
  [TaskStatus.IN_PROGRESS]: 'bg-blue-500',
  [TaskStatus.COMPLETED]: 'bg-green-500',
  [TaskStatus.CANCELLED]: 'bg-gray-300',
};

// ---------------------------------------------------------------------------
// Bar calculation
// ---------------------------------------------------------------------------

function calcBarStyle(
  task: Task,
  rangeStart: Date,
  totalDays: number,
  cellWidth: number,
): { left: number; width: number } | null {
  const start = new Date(task.startDate ?? task.createdAt);
  const end = task.dueDate ? new Date(task.dueDate) : addDays(start, 1);

  const leftDays = differenceInDays(start, rangeStart);
  const widthDays = Math.max(1, differenceInDays(end, start));

  const leftPct = leftDays / totalDays;
  const widthPct = widthDays / totalDays;

  // Skip tasks outside range
  if (leftDays >= totalDays || leftDays + widthDays < 0) return null;

  const totalWidth = cellWidth * totalDays;
  return {
    left: Math.max(0, leftPct * totalWidth),
    width: Math.min(widthPct * totalWidth, totalWidth - Math.max(0, leftPct * totalWidth)),
  };
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipState {
  task: Task;
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Gantt chart
// ---------------------------------------------------------------------------

interface GanttChartProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

const ROW_HEIGHT = 40;
const LABEL_WIDTH = 220;

export function GanttChart({ tasks, onTaskClick }: GanttChartProps) {
  const [zoom, setZoom] = useState<ZoomMode>('month');
  const [offset, setOffset] = useState(0); // number of zoom units to shift
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rangeStart = useMemo(() => {
    const base = startOfMonth(new Date());
    if (zoom === 'week') return addWeeks(base, offset);
    if (zoom === 'quarter') return startOfQuarter(addMonths(base, offset * 3));
    return addMonths(base, offset);
  }, [zoom, offset]);

  const config = useMemo(() => getZoomConfig(zoom, rangeStart), [zoom, rangeStart]);
  const cells = config.getCells(rangeStart);
  const totalWidth = config.cellWidth * cells.length;

  // Today position
  const todayLeft = useMemo(() => {
    const diff = differenceInDays(new Date(), rangeStart);
    if (diff < 0 || diff >= config.totalDays) return null;
    return (diff / config.totalDays) * totalWidth;
  }, [rangeStart, config, totalWidth]);

  const handleBarMouseEnter = (task: Task, e: MouseEvent) => {
    setTooltip({ task, x: e.clientX, y: e.clientY });
  };

  const handleBarMouseLeave = () => setTooltip(null);

  return (
    <div className="rounded-lg border bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {(['week', 'month', 'quarter'] as ZoomMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setZoom(m); setOffset(0); }}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                zoom === m ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
              )}
            >
              {m === 'week' ? 'Tuần' : m === 'month' ? 'Tháng' : 'Quý'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset((o) => o - 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent"
            aria-label="Trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[120px] text-center text-sm font-medium">
            {format(rangeStart, zoom === 'quarter' ? 'Qo yyyy' : 'MMMM yyyy', { locale: vi })}
          </span>
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent"
            aria-label="Sau"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="flex overflow-hidden">
        {/* Task labels */}
        <div
          style={{ width: LABEL_WIDTH, flexShrink: 0 }}
          className="border-r bg-muted/20"
        >
          {/* Header spacer */}
          <div className="flex h-9 items-center border-b px-3">
            <span className="text-xs font-semibold text-muted-foreground">Công việc</span>
          </div>
          {tasks.map((task) => (
            <div
              key={task.id}
              style={{ height: ROW_HEIGHT }}
              className="flex cursor-pointer items-center border-b px-3 hover:bg-accent/50"
              onClick={() => onTaskClick?.(task)}
            >
              <span className="line-clamp-1 text-xs">{task.title}</span>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto">
          <div style={{ width: totalWidth, minWidth: '100%' }}>
            {/* Date header */}
            <div className="flex h-9 border-b">
              {cells.map((cell, i) => (
                <div
                  key={i}
                  style={{ width: config.cellWidth, flexShrink: 0 }}
                  className={cn(
                    'flex items-center justify-center border-r text-[10px] text-muted-foreground',
                    isToday(cell) && 'bg-red-50 font-bold text-red-600',
                  )}
                >
                  {config.cellLabel(cell)}
                </div>
              ))}
            </div>

            {/* Task rows */}
            <div className="relative">
              {tasks.map((task) => {
                const bar = calcBarStyle(task, rangeStart, config.totalDays, config.cellWidth);
                const isOverdue =
                  task.dueDate &&
                  isBefore(new Date(task.dueDate), new Date()) &&
                  task.status !== TaskStatus.COMPLETED &&
                  task.status !== TaskStatus.CANCELLED;

                return (
                  <div
                    key={task.id}
                    style={{ height: ROW_HEIGHT }}
                    className="relative flex items-center border-b"
                  >
                    {/* Column grid lines */}
                    {cells.map((_, i) => (
                      <div
                        key={i}
                        style={{ left: i * config.cellWidth, width: config.cellWidth }}
                        className="absolute inset-y-0 border-r border-muted/40"
                      />
                    ))}

                    {/* Bar */}
                    {bar && (
                      <div
                        style={{ left: bar.left, width: bar.width }}
                        className={cn(
                          'absolute flex h-6 cursor-pointer items-center rounded-full px-2',
                          'transition-opacity hover:opacity-80',
                          STATUS_BAR[task.status as TaskStatus] ?? 'bg-slate-400',
                          isOverdue && 'ring-2 ring-red-500 ring-offset-1',
                        )}
                        onMouseEnter={(e) => handleBarMouseEnter(task, e)}
                        onMouseLeave={handleBarMouseLeave}
                        onClick={() => onTaskClick?.(task)}
                      >
                        <span className="truncate text-[10px] font-medium text-white">
                          {task.title}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Today indicator */}
              {todayLeft !== null && (
                <div
                  style={{ left: todayLeft }}
                  className="pointer-events-none absolute inset-y-0 w-px bg-red-500 opacity-70"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{ position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 8, zIndex: 9999 }}
          className="pointer-events-none rounded-lg border bg-popover px-3 py-2 shadow-xl text-sm"
        >
          <p className="font-semibold mb-1">{tooltip.task.title}</p>
          <p className="text-xs text-muted-foreground">
            Người thực hiện: {tooltip.task.assignee?.fullName ?? '---'}
          </p>
          {tooltip.task.dueDate && (
            <p className="text-xs text-muted-foreground">
              Hạn: {format(new Date(tooltip.task.dueDate), 'dd/MM/yyyy')}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Trạng thái: {tooltip.task.status}
          </p>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Không có công việc nào
        </div>
      )}
    </div>
  );
}
