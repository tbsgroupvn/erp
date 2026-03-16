'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { CalendarGrid, type CalendarView } from '@/features/calendar/calendar-grid';
import { EventForm } from '@/features/calendar/event-form';
import { useCalendarEvents } from '@/lib/hooks/use-calendar';

// ─── Helpers ───────────────────────────────────────────────────────────────

function getRangeForView(view: CalendarView, date: Date): { from: string; to: string } {
  if (view === 'month') {
    const from = new Date(date.getFullYear(), date.getMonth(), 1);
    const to = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  if (view === 'week') {
    const dayOfWeek = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { from: monday.toISOString(), to: sunday.toISOString() };
  }

  // Day view
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(date);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

// ─── Inner component (uses useSearchParams) ────────────────────────────────

function LichContent() {
  const searchParams = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState<Date | undefined>(undefined);
  const [view, setView] = useState<CalendarView>('month');

  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const d = new Date(dateParam);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  // Sync date param changes
  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const d = new Date(dateParam);
      if (!isNaN(d.getTime())) {
        setCurrentDate(d);
        setView('day');
      }
    }
  }, [searchParams]);

  const { from, to } = getRangeForView(view, currentDate);
  const { data: events = [], isLoading } = useCalendarEvents(from, to);

  const handleCreateClick = (date: Date) => {
    setCreateDefaultDate(date);
    setShowCreate(true);
  };

  const handleOpenCreate = () => {
    setCreateDefaultDate(undefined);
    setShowCreate(true);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lich lam viec"
        description="Quan ly su kien, cuoc hop va lich trinh cua ban"
        infoKey="lich"
      >
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Tao su kien
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Đang tải lịch...
        </div>
      ) : (
        <CalendarGrid
          events={events}
          view={view}
          onViewChange={setView}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          onCreateClick={handleCreateClick}
        />
      )}

      <EventForm
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) setCreateDefaultDate(undefined);
        }}
        defaultDate={createDefaultDate}
      />
    </div>
  );
}

// ─── Page export ─────────────────────────────────────────────────────────

export default function LichPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Đang tải...
        </div>
      }
    >
      <LichContent />
    </Suspense>
  );
}
