import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface HoverCardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: 'lift' | 'scale' | 'glow' | 'all';
}

export function HoverCard({
  children,
  className,
  hoverEffect = 'all',
}: HoverCardProps) {
  const effects = {
    lift: 'hover:-translate-y-1',
    scale: 'hover:scale-105',
    glow: 'hover:shadow-xl',
    all: 'hover:-translate-y-1 hover:scale-105 hover:shadow-xl',
  };

  return (
    <div
      className={cn(
        'transition-all duration-300 ease-out',
        effects[hoverEffect],
        className
      )}
    >
      {children}
    </div>
  );
}
