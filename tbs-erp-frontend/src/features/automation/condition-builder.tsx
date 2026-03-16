'use client';

import * as React from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TRIGGER_CATALOG,
  OPERATOR_LABELS,
  type ConditionConfig,
  type ConditionOperator,
  type TriggerType,
} from '@/lib/types/automation.types';

interface ConditionBuilderProps {
  triggerType?: TriggerType;
  conditions: ConditionConfig[];
  onChange: (conditions: ConditionConfig[]) => void;
}

const ALL_OPERATORS: ConditionOperator[] = [
  'eq',
  'neq',
  'gt',
  'lt',
  'contains',
  'not_contains',
];

function emptyCondition(): ConditionConfig {
  return { field: '', operator: 'eq', value: '' };
}

export function ConditionBuilder({
  triggerType,
  conditions,
  onChange,
}: ConditionBuilderProps) {
  const triggerMeta = TRIGGER_CATALOG.find((t) => t.type === triggerType);
  const availableFields = triggerMeta?.fields ?? [];

  function addCondition() {
    onChange([...conditions, emptyCondition()]);
  }

  function removeCondition(idx: number) {
    onChange(conditions.filter((_, i) => i !== idx));
  }

  function updateCondition(idx: number, patch: Partial<ConditionConfig>) {
    onChange(
      conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    );
  }

  return (
    <div className="space-y-3">
      {conditions.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">
          Chưa có điều kiện — automation rule sẽ chạy mọi lần trigger kích hoạt.
        </p>
      )}

      {conditions.map((cond, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2"
        >
          {/* AND badge */}
          {idx > 0 && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
              VÀ
            </span>
          )}

          {/* Field */}
          {availableFields.length > 0 ? (
            <Select
              value={cond.field}
              onValueChange={(v) => updateCondition(idx, { field: v })}
            >
              <SelectTrigger className="h-8 w-44 min-w-0 text-xs">
                <SelectValue placeholder="Chọn trường..." />
              </SelectTrigger>
              <SelectContent>
                {availableFields.map((f) => (
                  <SelectItem key={f.key} value={f.key} className="text-xs">
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="h-8 w-44 min-w-0 text-xs"
              placeholder="Trường dữ liệu..."
              value={cond.field}
              onChange={(e) => updateCondition(idx, { field: e.target.value })}
            />
          )}

          {/* Operator */}
          <Select
            value={cond.operator}
            onValueChange={(v) =>
              updateCondition(idx, { operator: v as ConditionOperator })
            }
          >
            <SelectTrigger className="h-8 w-32 min-w-0 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_OPERATORS.map((op) => (
                <SelectItem key={op} value={op} className="text-xs">
                  {OPERATOR_LABELS[op]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Value */}
          {(() => {
            const fieldMeta = availableFields.find((f) => f.key === cond.field);
            if (fieldMeta?.type === 'select' && fieldMeta.options) {
              return (
                <Select
                  value={String(cond.value)}
                  onValueChange={(v) => updateCondition(idx, { value: v })}
                >
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue placeholder="Chọn giá trị..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldMeta.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            }
            return (
              <Input
                className="h-8 flex-1 text-xs"
                placeholder={fieldMeta?.type === 'number' ? '0' : 'Giá trị...'}
                type={fieldMeta?.type === 'number' ? 'number' : 'text'}
                value={cond.value}
                onChange={(e) => updateCondition(idx, { value: e.target.value })}
              />
            );
          })()}

          {/* Remove */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => removeCondition(idx)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs"
        onClick={addCondition}
      >
        <Plus className="h-3.5 w-3.5" />
        Thêm điều kiện
      </Button>
    </div>
  );
}
