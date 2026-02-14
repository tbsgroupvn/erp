'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

import { cn } from '@/lib/utils/cn';

type DateFormat = 'short' | 'long' | 'relative';

interface DateDisplayProps {
  date: string | Date;
  dateFormat?: DateFormat;
  className?: string;
}

function formatDate(date: Date, dateFormat: DateFormat): string {
  switch (dateFormat) {
    case 'short':
      return format(date, 'dd/MM/yyyy', { locale: vi });
    case 'long':
      return format(date, 'dd/MM/yyyy HH:mm', { locale: vi });
    case 'relative':
      return formatDistanceToNow(date, { addSuffix: true, locale: vi });
    default:
      return format(date, 'dd/MM/yyyy', { locale: vi });
  }
}

export function DateDisplay({
  date,
  dateFormat = 'short',
  className,
}: DateDisplayProps) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Guard against invalid dates
  if (isNaN(dateObj.getTime())) {
    return <span className={cn('text-muted-foreground', className)}>--</span>;
  }

  const formatted = formatDate(dateObj, dateFormat);

  return (
    <time
      dateTime={dateObj.toISOString()}
      className={cn(className)}
      title={format(dateObj, 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
    >
      {formatted}
    </time>
  );
}
