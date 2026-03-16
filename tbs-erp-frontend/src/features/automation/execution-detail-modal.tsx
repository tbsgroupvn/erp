'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ChevronDown,
  ChevronRight,
  SkipForward,
  AlertTriangle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/cn';
import type { AutomationExecution } from '@/lib/types/automation.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecutionDetailEntry extends AutomationExecution {
  ruleName?: string;
  triggerEvent?: string;
  conditionsEvaluated?: ConditionEvalResult[];
  actionsExecuted?: ActionExecResult[];
}

export interface ConditionEvalResult {
  field: string;
  operator: string;
  expectedValue: string | number;
  actualValue: string | number;
  passed: boolean;
}

export interface ActionExecResult {
  type: string;
  label: string;
  status: 'success' | 'failed' | 'skipped';
  errorMessage?: string;
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const STATUS_CFG = {
  SUCCESS: {
    icon: CheckCircle2,
    label: 'Thành công',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-400',
    iconClass: 'text-emerald-600',
  },
  FAILED: {
    icon: XCircle,
    label: 'Thất bại',
    badgeClass: 'bg-destructive/15 text-destructive border-destructive/20',
    iconClass: 'text-destructive',
  },
  SKIPPED: {
    icon: SkipForward,
    label: 'Bỏ qua',
    badgeClass: 'bg-muted text-muted-foreground',
    iconClass: 'text-muted-foreground',
  },
};

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors py-1"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}
      </button>
      {open && <div className="mt-2 ml-6">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

interface ExecutionDetailModalProps {
  execution: ExecutionDetailEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExecutionDetailModal({
  execution,
  open,
  onOpenChange,
}: ExecutionDetailModalProps) {
  if (!execution) return null;

  const cfg = STATUS_CFG[execution.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.FAILED;
  const Icon = cfg.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn('h-5 w-5', cfg.iconClass)} />
            Chi tiết thực thi automation
          </DialogTitle>
          {execution.ruleName && (
            <DialogDescription>{execution.ruleName}</DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Overview row */}
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground mb-1">Trạng thái</p>
              <Badge className={cn('border text-xs', cfg.badgeClass)}>{cfg.label}</Badge>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground mb-1">Thời gian chạy</p>
              <p className="text-sm font-medium">
                {format(new Date(execution.executedAt), 'HH:mm:ss dd/MM', { locale: vi })}
              </p>
            </div>
            {execution.durationMs != null && (
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground mb-1">Thời lượng</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {execution.durationMs} ms
                </p>
              </div>
            )}
            {execution.triggerEvent && (
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground mb-1">Trigger</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  {execution.triggerEvent}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Error */}
          {execution.errorMsg && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-destructive mb-1">Lỗi xảy ra:</p>
                  <pre className="text-xs text-destructive/80 font-mono whitespace-pre-wrap break-all">
                    {execution.errorMsg}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Conditions evaluated */}
          {execution.conditionsEvaluated && execution.conditionsEvaluated.length > 0 && (
            <CollapsibleSection title={`Điều kiện đánh giá (${execution.conditionsEvaluated.length})`}>
              <div className="space-y-2">
                {execution.conditionsEvaluated.map((cond, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-3 rounded-md border px-3 py-2 text-xs',
                      cond.passed
                        ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10'
                        : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10',
                    )}
                  >
                    {cond.passed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    )}
                    <span className="font-mono font-medium">{cond.field}</span>
                    <span className="text-muted-foreground">{cond.operator}</span>
                    <span className="font-medium">{String(cond.expectedValue)}</span>
                    <span className="text-muted-foreground ml-auto">
                      thực tế: <span className="font-medium">{String(cond.actualValue)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Actions executed */}
          {execution.actionsExecuted && execution.actionsExecuted.length > 0 && (
            <CollapsibleSection title={`Hành động thực thi (${execution.actionsExecuted.length})`}>
              <div className="space-y-2">
                {execution.actionsExecuted.map((action, i) => (
                  <div key={i} className="rounded-md border bg-card text-xs">
                    <div className="flex items-center gap-3 px-3 py-2">
                      {action.status === 'success' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      ) : action.status === 'failed' ? (
                        <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      ) : (
                        <SkipForward className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-medium flex-1">{action.label}</span>
                      <span className="font-mono text-muted-foreground text-[10px]">{action.type}</span>
                      {action.durationMs != null && (
                        <span className="text-muted-foreground">{action.durationMs}ms</span>
                      )}
                      <Badge
                        className={cn(
                          'border text-[10px] px-1.5',
                          action.status === 'success'
                            ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400'
                            : action.status === 'failed'
                            ? 'bg-destructive/10 text-destructive border-destructive/20'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {action.status === 'success' ? 'OK' : action.status === 'failed' ? 'Lỗi' : 'Bỏ qua'}
                      </Badge>
                    </div>
                    {action.errorMessage && (
                      <div className="border-t border-destructive/20 px-3 py-2 bg-destructive/5">
                        <pre className="text-[10px] text-destructive font-mono whitespace-pre-wrap">
                          {action.errorMessage}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Input context */}
          {execution.input && (
            <CollapsibleSection title="Input context" defaultOpen={false}>
              <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto max-h-48 text-muted-foreground">
                {JSON.stringify(execution.input, null, 2)}
              </pre>
            </CollapsibleSection>
          )}

          {/* Output */}
          {execution.output && (
            <CollapsibleSection title="Output" defaultOpen={false}>
              <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto max-h-48 text-muted-foreground">
                {JSON.stringify(execution.output, null, 2)}
              </pre>
            </CollapsibleSection>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
