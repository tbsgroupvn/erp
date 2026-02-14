import { cn } from '@/lib/utils/cn';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ title, value, icon: Icon, description, trend, className }: StatCardProps) {
  return (
    <div className={cn(
      'group relative rounded-xl border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-default',
      className
    )}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold font-heading text-foreground">{value}</p>
        {description && (
          <p className="text-sm text-muted-foreground mt-2">{description}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1 mt-3">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                trend.value >= 0
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700',
              )}
            >
              {trend.value >= 0 ? '↗' : '↘'} {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
