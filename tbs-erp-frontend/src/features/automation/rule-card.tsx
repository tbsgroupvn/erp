'use client';

import * as React from 'react';
import {
  Play,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  TRIGGER_CATALOG,
  ACTION_CATALOG,
  type AutomationRule,
} from '@/lib/types/automation.types';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface RuleCardProps {
  rule: AutomationRule;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
  onTest: (id: string) => void;
  isTestPending?: boolean;
  isTogglePending?: boolean;
}

const STATUS_CONFIG = {
  ACTIVE: {
    label: 'Đang chạy',
    variant: 'default' as const,
    icon: CheckCircle2,
    className: 'bg-emerald-500/15 text-emerald-600 border-emerald-200',
  },
  INACTIVE: {
    label: 'Tắt',
    variant: 'secondary' as const,
    icon: XCircle,
    className: 'bg-muted text-muted-foreground',
  },
  ERROR: {
    label: 'Lỗi',
    variant: 'destructive' as const,
    icon: AlertCircle,
    className: 'bg-destructive/15 text-destructive border-destructive/20',
  },
};

export function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
  onTest,
  isTestPending,
  isTogglePending,
}: RuleCardProps) {
  const statusCfg = STATUS_CONFIG[rule.status];
  const StatusIcon = statusCfg.icon;

  const triggerMeta = TRIGGER_CATALOG.find((t) => t.type === rule.trigger?.type);
  const actionLabels = (rule.actions ?? [])
    .slice(0, 3)
    .map((a) => ACTION_CATALOG.find((ac) => ac.type === a.type)?.label ?? a.type)
    .join(', ');

  const lastRunText = rule.lastRunAt
    ? formatDistanceToNow(new Date(rule.lastRunAt), {
        addSuffix: true,
        locale: vi,
      })
    : 'Chưa chạy';

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Zap className="h-4 w-4 text-primary" />
          </div>

          {/* Main content */}
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Title + status */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">{rule.name}</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusCfg.className}`}
              >
                <StatusIcon className="h-3 w-3" />
                {statusCfg.label}
              </span>
            </div>

            {/* Description */}
            {rule.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {rule.description}
              </p>
            )}

            {/* Trigger + actions summary */}
            <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              {triggerMeta && (
                <span className="flex items-center gap-1 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-blue-600">
                  Khi: {triggerMeta.label}
                </span>
              )}
              {actionLabels && (
                <span className="flex items-center gap-1 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-violet-600">
                  Thi: {actionLabels}
                  {(rule.actions?.length ?? 0) > 3 && ` +${rule.actions.length - 3}`}
                </span>
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {lastRunText}
              </span>
              <span>{rule.runCount} lần chạy</span>
              {rule.lastError && (
                <span className="text-destructive truncate max-w-[200px]" title={rule.lastError}>
                  Lỗi: {rule.lastError}
                </span>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-1.5">
            <Switch
              checked={rule.status === 'ACTIVE'}
              disabled={isTogglePending}
              onCheckedChange={(checked) => onToggle(rule.id, checked)}
              aria-label="Toggle rule"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => onTest(rule.id)}
              disabled={isTestPending}
              title="Test chạy thử"
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(rule)}
              title="Sửa rule"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(rule.id)}
              title="Xóa rule"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
