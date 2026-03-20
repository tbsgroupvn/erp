'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useCountUp } from '@/lib/hooks/use-count-up';
import type { LucideIcon } from 'lucide-react';

export type StatCardVariant = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan';

const VARIANT_STYLES: Record<
  StatCardVariant,
  { accent: string; iconBg: string; iconText: string; dot: string }
> = {
  blue:    { accent: 'bg-blue-500',    iconBg: 'bg-blue-50 dark:bg-blue-950/40',    iconText: 'text-blue-600 dark:text-blue-400',    dot: 'bg-blue-500' },
  emerald: { accent: 'bg-emerald-500', iconBg: 'bg-emerald-50 dark:bg-emerald-950/40', iconText: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  amber:   { accent: 'bg-amber-500',   iconBg: 'bg-amber-50 dark:bg-amber-950/40',   iconText: 'text-amber-600 dark:text-amber-400',   dot: 'bg-amber-500' },
  rose:    { accent: 'bg-rose-500',    iconBg: 'bg-rose-50 dark:bg-rose-950/40',    iconText: 'text-rose-600 dark:text-rose-400',    dot: 'bg-rose-500' },
  violet:  { accent: 'bg-violet-500',  iconBg: 'bg-violet-50 dark:bg-violet-950/40',  iconText: 'text-violet-600 dark:text-violet-400',  dot: 'bg-violet-500' },
  cyan:    { accent: 'bg-cyan-500',    iconBg: 'bg-cyan-50 dark:bg-cyan-950/40',    iconText: 'text-cyan-600 dark:text-cyan-400',    dot: 'bg-cyan-500' },
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

  const trendUp = trend && trend.value > 0;
  const trendDown = trend && trend.value < 0;
  const TrendIcon = trendUp ? TrendingUp : trendDown ? TrendingDown : Minus;

  const cardContent = (
    <div
      className={cn(
        'group relative rounded-xl border border-border/60 bg-card overflow-hidden',
        'shadow-sm transition-shadow duration-200',
        'hover:shadow-md',
        href ? 'cursor-pointer' : 'cursor-default',
        className
      )}
    >
      {/* Top accent line — 2px, full width */}
      <div className={cn('h-0.5 w-full', v.accent)} />

      <div className="p-5">
        {/* Top row: label left, icon right */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider leading-tight">
            {title}
          </p>
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              v.iconBg, v.iconText
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>

        {/* Value — hero number */}
        <div className="mt-3">
          <p className="text-2xl font-bold tracking-tight font-heading text-foreground tabular-nums leading-none">
            {isNumeric ? (
              <AnimatedNumber target={value as number} duration={countDuration} />
            ) : (
              value
            )}
          </p>

          {description && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{description}</p>
          )}
        </div>

        {/* Bottom row: trend indicator */}
        {trend && (
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/50">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums',
                trendUp
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : trendDown
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-muted-foreground'
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {trendUp ? '+' : ''}{trend.value}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </div>

      {/* External link indicator — appears on hover */}
      {href && (
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-60 transition-opacity duration-150">
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{cardContent}</Link>;
  }

  return cardContent;
}
