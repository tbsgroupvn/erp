'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useCountUp } from '@/lib/hooks/use-count-up';
import type { LucideIcon } from 'lucide-react';

export type StatCardVariant = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan';

const VARIANT_STYLES: Record<StatCardVariant, { border: string; iconBg: string; iconBgHover: string; iconText: string }> = {
  blue:    { border: 'stat-card-blue',    iconBg: 'bg-blue-50',    iconBgHover: 'group-hover:bg-blue-500',    iconText: 'text-blue-600' },
  emerald: { border: 'stat-card-emerald', iconBg: 'bg-emerald-50', iconBgHover: 'group-hover:bg-emerald-500', iconText: 'text-emerald-600' },
  amber:   { border: 'stat-card-amber',   iconBg: 'bg-amber-50',   iconBgHover: 'group-hover:bg-amber-500',   iconText: 'text-amber-600' },
  rose:    { border: 'stat-card-rose',    iconBg: 'bg-rose-50',    iconBgHover: 'group-hover:bg-rose-500',    iconText: 'text-rose-600' },
  violet:  { border: 'stat-card-violet',  iconBg: 'bg-violet-50',  iconBgHover: 'group-hover:bg-violet-500',  iconText: 'text-violet-600' },
  cyan:    { border: 'stat-card-cyan',    iconBg: 'bg-cyan-50',    iconBgHover: 'group-hover:bg-cyan-500',    iconText: 'text-cyan-600' },
};

interface StatCardProps {
  title: string;
  /** Pass a numeric value to enable animated counting; pass a string for pre-formatted values (e.g. currency) */
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: { value: number; label: string };
  variant?: StatCardVariant;
  className?: string;
  /** Duration in ms for the count-up animation (default 500) */
  countDuration?: number;
  /** When provided, the card becomes a clickable link to this URL */
  href?: string;
}

/** Inner component that runs the count-up hook — only mounted when value is numeric */
function AnimatedNumber({ target, duration }: { target: number; duration: number }) {
  const count = useCountUp(target, duration);
  return <span className="tabular-nums">{count.toLocaleString('vi-VN')}</span>;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  variant = 'blue',
  className,
  countDuration = 500,
  href,
}: StatCardProps) {
  const v = VARIANT_STYLES[variant];
  const isNumeric = typeof value === 'number';

  const trendIcon =
    trend && trend.value > 0
      ? TrendingUp
      : trend && trend.value < 0
      ? TrendingDown
      : Minus;
  const TrendIcon = trendIcon;

  const cardContent = (
    <div
      className={cn(
        'group relative rounded-xl border bg-card p-6 shadow-sm transition-all duration-300',
        'hover:shadow-lg hover:-translate-y-1',
        href ? 'cursor-pointer' : 'cursor-default',
        'animate-fade-in',
        v.border,
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300',
            v.iconBg, v.iconText, v.iconBgHover,
            'group-hover:text-white group-hover:shadow-md'
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-3xl font-bold font-heading text-foreground">
          {isNumeric ? (
            <AnimatedNumber target={value as number} duration={countDuration} />
          ) : (
            value
          )}
        </p>
        {description && (
          <p className="text-sm text-muted-foreground mt-2">{description}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1.5 mt-3">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                trend.value > 0
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : trend.value < 0
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </div>

      {href && (
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{cardContent}</Link>;
  }

  return cardContent;
}
