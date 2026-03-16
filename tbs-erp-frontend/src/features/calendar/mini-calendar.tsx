'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCalendarEvents } from '@/lib/hooks/use-calendar';
import { cn } from '@/lib/utils/cn';

// ─── Helpers ───────────────────────────────────────────────────────────────

const WEEKDAY_MINI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function getMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay(); // 0=Sun
  const cells: Date[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push(new Date(year, month, -i));
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(new Date(year, month, d));
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push(new Date(year, month + 1, d));
    }
  }
  return cells;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const MONTH_NAMES = [
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12',
];

// ─── Props ─────────────────────────────────────────────────────────────────

interface MiniCalendarProps {
  /** If true, clicking a day navigates to /lich?date=... */
  navigateOnClick?: boolean;
  className?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function MiniCalendar({ navigateOnClick = true, className }: MiniCalendarProps) {
  const router = useRouter();
  const [current, setCurrent] = useState(() => new Date());
  const today = new Date();

  const year = current.getFullYear();
  const month = current.getMonth();

  // Fetch events for current month
  const fromDate = new Date(year, month, 1);
  const toDate = new Date(year, month + 1, 0, 23, 59, 59);
  const { data: events = [] } = useCalendarEvents(
    fromDate.toISOString(),
    toDate.toISOString(),
  );

  // Build a set of days that have events
  const daysWithEvents = new Set<string>();
  for (const ev of events) {
    const start = new Date(ev.startAt);
    if (start.getMonth() === month && start.getFullYear() === year) {
      daysWithEvents.add(toDateKey(start));
    }
  }

  const cells = getMonthGrid(year, month);

  const handlePrev = () => setCurrent(new Date(year, month - 1, 1));
  const handleNext = () => setCurrent(new Date(year, month + 1, 1));

  const handleDayClick = (day: Date) => {
    if (!navigateOnClick) return;
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    router.push(`/lich?date=${iso}`);
  };

  return (
    <div className={cn('rounded-lg border bg-card p-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handlePrev}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-sm font-semibold">
          {MONTH_NAMES[month]} {year}
        </span>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleNext}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_MINI.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          const isCurrentMonth = day.getMonth() === month;
          const isToday = isSameDay(day, today);
          const hasEvents = isCurrentMonth && daysWithEvents.has(toDateKey(day));

          return (
            <button
              key={idx}
              onClick={() => isCurrentMonth && handleDayClick(day)}
              className={cn(
                'relative flex flex-col items-center justify-center h-7 w-full rounded-md text-xs transition-colors',
                isCurrentMonth
                  ? 'hover:bg-accent cursor-pointer'
                  : 'opacity-30 cursor-default',
                isToday && 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              <span>{day.getDate()}</span>
              {hasEvents && !isToday && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer: event count */}
      {events.length > 0 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {events.length} su kien trong thang nay
        </p>
      )}
    </div>
  );
}
