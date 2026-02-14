import { cn } from '@/lib/utils/cn';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between pb-8 border-b border-border mb-6', className)}>
      <div className="space-y-1">
        <h1 className="text-3xl font-bold font-heading tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="text-base text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
