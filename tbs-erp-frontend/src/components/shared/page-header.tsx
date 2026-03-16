import { cn } from '@/lib/utils/cn';
import { InfoTooltip } from '@/components/shared/info-tooltip';
import type { InfoTip } from '@/lib/utils/info-tooltips';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  /** Route key de lay tooltip tu tu dien (vi du: 'don-hang') */
  infoKey?: string;
  /** Hoac truyen tooltip truc tiep */
  infoTip?: InfoTip;
}

export function PageHeader({ title, description, children, className, infoKey, infoTip }: PageHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between pb-6 mb-6 border-b border-border/60', className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold font-heading tracking-tight text-foreground">{title}</h1>
          {(infoKey || infoTip) && (
            <InfoTooltip tipKey={infoKey} tip={infoTip} size="md" />
          )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
