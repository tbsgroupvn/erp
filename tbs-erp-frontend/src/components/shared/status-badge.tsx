import { cn } from '@/lib/utils/cn';

interface StatusBadgeProps {
  label: string;
  colorClass: string;
  className?: string;
}

export function StatusBadge({ label, colorClass, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 hover:scale-105',
        colorClass,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
