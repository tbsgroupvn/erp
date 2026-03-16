'use client';

import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

// ============================================
// DateRangeFilter
// ============================================

export interface DateRangeValue {
  from: string;
  to: string;
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  label?: string;
}

export function DateRangeFilter({ value, onChange, label = 'Khoang thoi gian' }: DateRangeFilterProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="h-8 text-xs"
        />
        <span className="text-muted-foreground text-xs">den</span>
        <Input
          type="date"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="h-8 text-xs"
        />
        {(value.from || value.to) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onChange({ from: '', to: '' })}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// MonthYearFilter
// ============================================

export interface MonthYearValue {
  month: number;
  year: number;
}

interface MonthYearFilterProps {
  value: MonthYearValue;
  onChange: (v: MonthYearValue) => void;
  label?: string;
}

export function MonthYearFilter({ value, onChange, label = 'Thang/Nam' }: MonthYearFilterProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Thang ${i + 1}` }));

  return (
    <div className="flex flex-col gap-1">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <div className="flex items-center gap-2">
        <select
          value={value.month}
          onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
          className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={value.year}
          onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
          className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ============================================
// StatusFilter (generic)
// ============================================

interface StatusFilterProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label?: string;
  placeholder?: string;
}

export function StatusFilter({
  value,
  onChange,
  options,
  label = 'Trang thai',
  placeholder = 'Tat ca',
}: StatusFilterProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================
// FilterCard — wraps filters in a collapsible card
// ============================================

interface FilterCardProps {
  children: ReactNode;
  onReset?: () => void;
}

export function FilterCard({ children, onReset }: FilterCardProps) {
  const [open, setOpen] = useState(true);

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <button
            className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors"
            onClick={() => setOpen((p) => !p)}
          >
            <Filter className="h-3.5 w-3.5" />
            Bo loc
            <span className="text-muted-foreground text-xs">{open ? '(--)' : '(+)'}</span>
          </button>
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset} className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" />
              Dat lai
            </Button>
          )}
        </div>
        {open && (
          <div className="flex flex-wrap items-end gap-4">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// useReportFilters — convenience hook
// ============================================

interface UseReportFiltersOptions {
  defaultDateRange?: DateRangeValue;
  defaultMonthYear?: MonthYearValue;
}

export function useReportFilters(opts: UseReportFiltersOptions = {}) {
  // Memoize `now` so it does not change on every render and avoids stale
  // closure issues in useCallback — only computed once per hook mount.
  const now = useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState<DateRangeValue>(
    opts.defaultDateRange ?? { from: '', to: '' },
  );
  const [monthYear, setMonthYear] = useState<MonthYearValue>(
    opts.defaultMonthYear ?? { month: now.getMonth() + 1, year: now.getFullYear() },
  );
  const [status, setStatus] = useState('');

  const reset = useCallback(() => {
    setDateRange({ from: '', to: '' });
    setMonthYear({ month: now.getMonth() + 1, year: now.getFullYear() });
    setStatus('');
  }, [now]);

  return { dateRange, setDateRange, monthYear, setMonthYear, status, setStatus, reset };
}
