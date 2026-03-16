'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { EventDetail } from './event-detail';
import type { CalendarEvent } from '@/lib/types/calendar.types';

// ─── Types ─────────────────────────────────────────────────────────────────

export type CalendarView = 'day' | 'week' | 'month';

interface CalendarGridProps {
  events: CalendarEvent[];
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  currentDate: Date;
  onDateChange: (d: Date) => void;
  onCreateClick?: (date: Date) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTH_NAMES = [
  'Thang 1', 'Thang 2', 'Thang 3', 'Thang 4', 'Thang 5', 'Thang 6',
  'Thang 7', 'Thang 8', 'Thang 9', 'Thang 10', 'Thang 11', 'Thang 12',
];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay(); // 0=Sun
  const cells: Date[] = [];

  // Padding days from prev month
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push(new Date(year, month, -i));
  }
  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(new Date(year, month, d));
  }
  // Padding days for next month (fill to multiple of 7)
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push(new Date(year, month + 1, d));
    }
  }
  return cells;
}

function getWeekDays(baseDate: Date): Date[] {
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - ((day + 6) % 7)); // Mon-Sun week
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  }
  return days;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((e) => {
    const start = new Date(e.startAt);
    const end = new Date(e.endAt);
    if (e.allDay) {
      return day >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) &&
        day <= new Date(end.getFullYear(), end.getMonth(), end.getDate());
    }
    return isSameDay(start, day);
  });
}

// ─── Month View ─────────────────────────────────────────────────────────────

function MonthView({
  currentDate,
  events,
  onDayClick,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (d: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const today = new Date();
  const cells = getMonthGrid(currentDate.getFullYear(), currentDate.getMonth());
  const currentMonth = currentDate.getMonth();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b">
        {WEEKDAY_SHORT.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 flex-1 divide-x divide-y border-b">
        {cells.map((day, idx) => {
          const isCurrentMonth = day.getMonth() === currentMonth;
          const isToday = isSameDay(day, today);
          const dayEvents = eventsOnDay(events, day);

          return (
            <div
              key={idx}
              className={cn(
                'min-h-[90px] p-1 cursor-pointer hover:bg-accent/50 transition-colors',
                !isCurrentMonth && 'opacity-40',
              )}
              onClick={() => onDayClick(day)}
            >
              <div
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-1',
                  isToday && 'bg-primary text-primary-foreground',
                  !isToday && 'text-foreground',
                )}
              >
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    className="w-full text-left truncate rounded px-1.5 py-0.5 text-xs text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: ev.color }}
                    title={ev.title}
                  >
                    {!ev.allDay && (
                      <span className="mr-1 opacity-80">{formatTime(ev.startAt)}</span>
                    )}
                    {ev.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <p className="px-1 text-xs text-muted-foreground">
                    +{dayEvents.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ──────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function WeekView({
  currentDate,
  events,
  onDayClick,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (d: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const today = new Date();
  const weekDays = getWeekDays(currentDate);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header row */}
      <div className="flex border-b">
        <div className="w-14 shrink-0" />
        {weekDays.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className="flex-1 text-center py-2 cursor-pointer hover:bg-accent/50"
              onClick={() => onDayClick(day)}
            >
              <p className="text-xs text-muted-foreground">
                {WEEKDAY_SHORT[day.getDay()]}
              </p>
              <p
                className={cn(
                  'mx-auto mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium',
                  isToday && 'bg-primary text-primary-foreground',
                )}
              >
                {day.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        {HOURS.map((hour) => (
          <div key={hour} className="flex border-b" style={{ minHeight: 48 }}>
            <div className="w-14 shrink-0 pr-2 pt-1 text-right text-xs text-muted-foreground">
              {hour === 0 ? '' : `${String(hour).padStart(2, '0')}:00`}
            </div>
            {weekDays.map((day) => {
              const hourEvents = events.filter((ev) => {
                if (ev.allDay) return false;
                const start = new Date(ev.startAt);
                return isSameDay(start, day) && start.getHours() === hour;
              });

              return (
                <div
                  key={day.toISOString()}
                  className="flex-1 border-l px-0.5 py-0.5 space-y-0.5"
                >
                  {hourEvents.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      className="w-full text-left rounded px-1.5 py-1 text-xs text-white hover:opacity-90"
                      style={{ backgroundColor: ev.color }}
                      title={ev.title}
                    >
                      <p className="font-medium truncate">{ev.title}</p>
                      <p className="opacity-80">
                        {formatTime(ev.startAt)} — {formatTime(ev.endAt)}
                      </p>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Day View ───────────────────────────────────────────────────────────────

function DayView({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
}) {
  const dayEvents = eventsOnDay(events, currentDate);
  const allDayEvents = dayEvents.filter((e) => e.allDay);
  const timedEvents = dayEvents.filter((e) => !e.allDay);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="border-b px-4 py-2 space-y-1">
          <p className="text-xs text-muted-foreground mb-1">Ca ngay</p>
          {allDayEvents.map((ev) => (
            <button
              key={ev.id}
              onClick={() => onEventClick(ev)}
              className="w-full text-left rounded px-2 py-1 text-sm text-white hover:opacity-90"
              style={{ backgroundColor: ev.color }}
            >
              {ev.title}
            </button>
          ))}
        </div>
      )}

      {/* Hourly grid */}
      <div className="flex-1 overflow-y-auto">
        {HOURS.map((hour) => {
          const hourEvents = timedEvents.filter(
            (ev) => new Date(ev.startAt).getHours() === hour,
          );
          return (
            <div key={hour} className="flex border-b min-h-[56px]">
              <div className="w-16 shrink-0 pr-3 pt-1 text-right text-xs text-muted-foreground">
                {hour === 0 ? '' : `${String(hour).padStart(2, '0')}:00`}
              </div>
              <div className="flex-1 border-l px-2 py-1 space-y-1">
                {hourEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className="w-full text-left rounded-md px-3 py-2 text-sm text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: ev.color }}
                  >
                    <p className="font-medium">{ev.title}</p>
                    <p className="text-xs opacity-90">
                      {formatTime(ev.startAt)} — {formatTime(ev.endAt)}
                    </p>
                    {ev.location && (
                      <p className="text-xs opacity-80 mt-0.5">{ev.location}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main CalendarGrid ──────────────────────────────────────────────────────

export function CalendarGrid({
  events,
  view,
  onViewChange,
  currentDate,
  onDateChange,
  onCreateClick,
}: CalendarGridProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (view === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else if (view === 'week') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 1);
    }
    onDateChange(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (view === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else if (view === 'week') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
    }
    onDateChange(d);
  };

  const handleToday = () => onDateChange(new Date());

  const handleDayClick = (day: Date) => {
    if (view === 'month') {
      // Click on a day in month view: navigate to that day in day view? Or open create
      onCreateClick?.(day);
    }
  };

  const getHeaderTitle = () => {
    if (view === 'month') {
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (view === 'week') {
      const days = getWeekDays(currentDate);
      const first = days[0];
      const last = days[6];
      if (first.getMonth() === last.getMonth()) {
        return `${first.getDate()} — ${last.getDate()} ${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
      }
      return `${first.getDate()} ${MONTH_NAMES[first.getMonth()]} — ${last.getDate()} ${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`;
    }
    // Day
    return currentDate.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="flex flex-col rounded-lg border bg-card overflow-hidden" style={{ minHeight: 600 }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToday}>
            Hom nay
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handlePrev} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleNext} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-base font-semibold whitespace-nowrap">{getHeaderTitle()}</h2>
        </div>

        {/* View switcher */}
        <div className="flex rounded-md border overflow-hidden">
          {(['month', 'week', 'day'] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors',
                view === v
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent',
              )}
            >
              {v === 'month' ? 'Thang' : v === 'week' ? 'Tuan' : 'Ngay'}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar body */}
      {view === 'month' && (
        <MonthView
          currentDate={currentDate}
          events={events}
          onDayClick={handleDayClick}
          onEventClick={setSelectedEvent}
        />
      )}
      {view === 'week' && (
        <WeekView
          currentDate={currentDate}
          events={events}
          onDayClick={handleDayClick}
          onEventClick={setSelectedEvent}
        />
      )}
      {view === 'day' && (
        <DayView
          currentDate={currentDate}
          events={events}
          onEventClick={setSelectedEvent}
        />
      )}

      {/* Event detail dialog */}
      <EventDetail
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
