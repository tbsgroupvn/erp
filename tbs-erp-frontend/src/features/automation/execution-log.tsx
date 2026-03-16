'use client';

import * as React from 'react';
import { CheckCircle2, XCircle, SkipForward, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';
import type { AutomationExecution } from '@/lib/types/automation.types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ExecutionDetailModal, type ExecutionDetailEntry } from './execution-detail-modal';

interface ExecutionLogProps {
  executions: AutomationExecution[];
  isLoading?: boolean;
  ruleName?: string;
}

const STATUS_CFG = {
  SUCCESS: {
    icon: CheckCircle2,
    label: 'Thành công',
    className: 'text-emerald-600',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
  },
  FAILED: {
    icon: XCircle,
    label: 'Thất bại',
    className: 'text-destructive',
    badgeClass: 'bg-destructive/15 text-destructive border-destructive/20',
  },
  SKIPPED: {
    icon: SkipForward,
    label: 'Bỏ qua',
    className: 'text-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground',
  },
};

export function ExecutionLog({ executions, isLoading, ruleName }: ExecutionLogProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [detailEntry, setDetailEntry] = React.useState<ExecutionDetailEntry | null>(null);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openDetail(exec: AutomationExecution) {
    setDetailEntry({ ...exec, ruleName });
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Chưa có lịch sử thực thi
      </p>
    );
  }

  return (
    <>
    <div className="space-y-1.5">
      {executions.map((exec) => {
        const cfg = STATUS_CFG[exec.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.FAILED;
        const Icon = cfg.icon;
        const isExpanded = expanded.has(exec.id);
        const hasDetail = exec.errorMsg || exec.input || exec.output;

        return (
          <div key={exec.id} className="rounded-lg border bg-card text-sm">
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2.5 text-left',
                hasDetail && 'cursor-pointer hover:bg-muted/40',
              )}
              onClick={() => hasDetail && toggleExpand(exec.id)}
            >
              {/* Expand toggle */}
              {hasDetail ? (
                isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )
              ) : (
                <span className="h-3.5 w-3.5 shrink-0" />
              )}

              {/* Status icon */}
              <Icon className={cn('h-4 w-4 shrink-0', cfg.className)} />

              {/* Timestamp */}
              <span className="w-40 shrink-0 text-xs text-muted-foreground">
                {format(new Date(exec.executedAt), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
              </span>

              {/* Status badge */}
              <span
                className={cn(
                  'shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium',
                  cfg.badgeClass,
                )}
              >
                {cfg.label}
              </span>

              {/* Spacer to push duration and detail button to right */}
              <span className="flex-1" />

              {/* Duration */}
              {exec.durationMs != null && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {exec.durationMs}ms
                </span>
              )}

              {/* Triggered by */}
              {exec.triggeredBy && (
                <span className="hidden text-xs text-muted-foreground sm:block">
                  bởi {exec.triggeredBy}
                </span>
              )}

              {/* Detail button */}
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => { e.stopPropagation(); openDetail(exec); }}
                title="Xem chi tiết"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </button>

            {/* Expanded detail */}
            {isExpanded && hasDetail && (
              <div className="border-t px-3 py-2.5 space-y-2 bg-muted/20">
                {exec.errorMsg && (
                  <div>
                    <p className="text-xs font-medium text-destructive mb-1">Lỗi:</p>
                    <p className="text-xs text-destructive/80 font-mono bg-destructive/10 rounded p-2">
                      {exec.errorMsg}
                    </p>
                  </div>
                )}
                {exec.input && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Input context:</p>
                    <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-h-32">
                      {JSON.stringify(exec.input, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>

    {/* Detail modal */}
    <ExecutionDetailModal
      execution={detailEntry}
      open={!!detailEntry}
      onOpenChange={(v) => !v && setDetailEntry(null)}
    />
    </>
  );
}
