'use client';

import { useState, type ComponentType } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useCheckIn } from '@/lib/hooks/use-okr';
import type { KeyResult, KeyResultStatus } from '@/lib/types/okr.types';
import { KR_STATUS_LABELS } from '@/lib/types/okr.types';
import { cn } from '@/lib/utils';
import { TrendingUp, CheckCircle2, AlertTriangle, Clock, XCircle } from 'lucide-react';

interface KeyResultItemProps {
  keyResult: KeyResult;
  objectiveId: string;
  showCheckIn?: boolean;
}

const statusConfig: Record<
  KeyResultStatus,
  { color: string; bgColor: string; icon: ComponentType<{ className?: string }> }
> = {
  NOT_STARTED: {
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    icon: Clock,
  },
  ON_TRACK: {
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    icon: TrendingUp,
  },
  AT_RISK: {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    icon: AlertTriangle,
  },
  BEHIND: {
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    icon: XCircle,
  },
  COMPLETED: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    icon: CheckCircle2,
  },
};

const progressBarColor: Record<KeyResultStatus, string> = {
  NOT_STARTED: 'bg-gray-300',
  ON_TRACK: 'bg-green-500',
  AT_RISK: 'bg-yellow-500',
  BEHIND: 'bg-red-500',
  COMPLETED: 'bg-blue-500',
};

function computeKRProgress(current: number, target: number): number {
  if (target === 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

function formatValue(value: number, metricType: string, unit?: string | null): string {
  if (metricType === 'CURRENCY') {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  }
  if (metricType === 'BOOLEAN') {
    return value >= 1 ? 'Hoan thanh' : 'Chua hoan thanh';
  }
  const suffix = unit ? ` ${unit}` : metricType === 'PERCENTAGE' ? '%' : '';
  return `${value.toLocaleString('vi-VN')}${suffix}`;
}

export function KeyResultItem({ keyResult, objectiveId, showCheckIn = true }: KeyResultItemProps) {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInValue, setCheckInValue] = useState<string>('');
  const [checkInNote, setCheckInNote] = useState('');
  const checkIn = useCheckIn();

  const progress = computeKRProgress(keyResult.currentValue, keyResult.targetValue);
  const config = statusConfig[keyResult.status];
  const StatusIcon = config.icon;

  const handleCheckIn = () => {
    const value = parseFloat(checkInValue);
    if (isNaN(value)) return;

    checkIn.mutate(
      { keyResultId: keyResult.id, dto: { value, note: checkInNote || undefined } },
      {
        onSuccess: () => {
          setIsCheckingIn(false);
          setCheckInValue('');
          setCheckInNote('');
        },
      },
    );
  };

  return (
    <div className={cn('rounded-lg border p-3 space-y-2', config.bgColor)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <StatusIcon className={cn('h-4 w-4 mt-0.5 shrink-0', config.color)} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{keyResult.title}</p>
            {keyResult.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{keyResult.description}</p>
            )}
          </div>
        </div>
        <Badge variant="outline" className={cn('text-xs shrink-0', config.color)}>
          {KR_STATUS_LABELS[keyResult.status]}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            {formatValue(keyResult.currentValue, keyResult.metricType, keyResult.unit)} /{' '}
            {formatValue(keyResult.targetValue, keyResult.metricType, keyResult.unit)}
          </span>
          <span className="font-medium">{progress}%</span>
        </div>
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', progressBarColor[keyResult.status])}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Due date */}
      {keyResult.dueDate && (
        <p className="text-xs text-gray-500">
          Han: {new Date(keyResult.dueDate).toLocaleDateString('vi-VN')}
        </p>
      )}

      {/* Check-in form */}
      {showCheckIn && (
        <>
          {!isCheckingIn ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                setIsCheckingIn(true);
                setCheckInValue(String(keyResult.currentValue));
              }}
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              Cap nhat tien do
            </Button>
          ) : (
            <div className="space-y-2 pt-1 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={checkInValue}
                  onChange={(e) => setCheckInValue(e.target.value)}
                  className="h-7 text-xs w-32"
                  placeholder="Gia tri moi"
                />
                {keyResult.unit && (
                  <span className="text-xs text-gray-500">{keyResult.unit}</span>
                )}
              </div>
              <Textarea
                value={checkInNote}
                onChange={(e) => setCheckInNote(e.target.value)}
                placeholder="Ghi chu (tuy chon)..."
                className="text-xs min-h-[48px] resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleCheckIn}
                  disabled={checkIn.isPending || !checkInValue}
                >
                  {checkIn.isPending ? 'Dang luu...' : 'Luu'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setIsCheckingIn(false)}
                >
                  Huy
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
