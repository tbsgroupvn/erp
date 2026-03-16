'use client';

import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getInfoTip, type InfoTip } from '@/lib/utils/info-tooltips';
import { cn } from '@/lib/utils/cn';

interface InfoTooltipProps {
  /** Route key (vi du: 'don-hang', '/khach-hang') hoac truc tiep truyen InfoTip */
  tipKey?: string;
  /** Truyen truc tiep noi dung tooltip thay vi dung tu dien */
  tip?: InfoTip;
  /** Kich thuoc icon */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Nut (i) - hover hien dinh nghia va cach lam.
 *
 * Cach dung:
 * ```tsx
 * <InfoTooltip tipKey="don-hang" />
 * <InfoTooltip tip={{ definition: 'Mo ta...', howTo: 'Buoc 1...' }} />
 * ```
 */
export function InfoTooltip({ tipKey, tip, size = 'sm', className }: InfoTooltipProps) {
  const resolved = tip || (tipKey ? getInfoTip(tipKey) : undefined);
  if (!resolved) return null;

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnSize = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center rounded-full border border-muted-foreground/30 text-muted-foreground/60 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
              btnSize,
              className,
            )}
            aria-label="Xem hướng dẫn"
          >
            <Info className={iconSize} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="max-w-xs rounded-lg bg-popover text-popover-foreground border shadow-lg p-0"
        >
          <div className="p-3 space-y-2">
            <p className="text-sm font-medium leading-snug">{resolved.definition}</p>
            {resolved.howTo && (
              <div className="border-t border-border/50 pt-2">
                <p className="text-xs font-semibold text-primary mb-0.5">Cách làm:</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{resolved.howTo}</p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
