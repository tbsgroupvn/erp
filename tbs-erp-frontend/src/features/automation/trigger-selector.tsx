'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TRIGGER_CATALOG,
  TRIGGER_CATEGORY_LABELS,
  type TriggerConfig,
  type TriggerType,
  type TriggerMeta,
} from '@/lib/types/automation.types';

interface TriggerSelectorProps {
  value?: TriggerConfig;
  onChange: (config: TriggerConfig) => void;
}

const CATEGORY_ORDER: TriggerMeta['category'][] = [
  'order',
  'finance',
  'complaint',
  'task',
  'approval',
  'schedule',
];

export function TriggerSelector({ value, onChange }: TriggerSelectorProps) {
  const selectedMeta = TRIGGER_CATALOG.find((t) => t.type === value?.type);

  function handleTypeChange(type: string) {
    onChange({ type: type as TriggerType, params: {} });
  }

  function handleParamChange(key: string, val: string) {
    onChange({
      type: value!.type,
      params: { ...(value?.params ?? {}), [key]: val },
    });
  }

  // Group by category
  const grouped = CATEGORY_ORDER.reduce<
    Record<TriggerMeta['category'], TriggerMeta[]>
  >(
    (acc, cat) => {
      acc[cat] = TRIGGER_CATALOG.filter((t) => t.category === cat);
      return acc;
    },
    {} as Record<TriggerMeta['category'], TriggerMeta[]>,
  );

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1.5 block text-sm font-medium">Loại trigger</Label>
        <Select value={value?.type ?? ''} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Chọn sự kiện kích hoạt..." />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_ORDER.map((cat) => (
              <SelectGroup key={cat}>
                <SelectLabel className="text-xs text-muted-foreground">
                  {TRIGGER_CATEGORY_LABELS[cat]}
                </SelectLabel>
                {grouped[cat].map((trigger) => (
                  <SelectItem key={trigger.type} value={trigger.type}>
                    <span className="flex flex-col">
                      <span>{trigger.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {trigger.description}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Trigger-specific params */}
      {selectedMeta && value?.type === 'ORDER_STATUS_CHANGED' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1.5 block text-sm">Trạng thái từ</Label>
            <Input
              placeholder="VD: PENDING"
              value={value?.params?.statusFrom ?? ''}
              onChange={(e) => handleParamChange('statusFrom', e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Trạng thái đến</Label>
            <Input
              placeholder="VD: COMPLETED"
              value={value?.params?.statusTo ?? ''}
              onChange={(e) => handleParamChange('statusTo', e.target.value)}
            />
          </div>
        </div>
      )}

      {value?.type === 'SCHEDULE_DAILY' && (
        <div>
          <Label className="mb-1.5 block text-sm">Giờ chạy (HH:MM)</Label>
          <Input
            type="time"
            placeholder="08:00"
            value={value?.params?.scheduleTime ?? ''}
            onChange={(e) => handleParamChange('scheduleTime', e.target.value)}
          />
        </div>
      )}

      {value?.type === 'SCHEDULE_WEEKLY' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1.5 block text-sm">Thứ trong tuần (1=CN, 7=T7)</Label>
            <Select
              value={String(value?.params?.scheduleDay ?? '')}
              onValueChange={(v) => handleParamChange('scheduleDay', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn ngày..." />
              </SelectTrigger>
              <SelectContent>
                {[
                  { v: '1', l: 'Chủ nhật' },
                  { v: '2', l: 'Thứ 2' },
                  { v: '3', l: 'Thứ 3' },
                  { v: '4', l: 'Thứ 4' },
                  { v: '5', l: 'Thứ 5' },
                  { v: '6', l: 'Thứ 6' },
                  { v: '7', l: 'Thứ 7' },
                ].map(({ v, l }) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Giờ chạy (HH:MM)</Label>
            <Input
              type="time"
              value={value?.params?.scheduleTime ?? ''}
              onChange={(e) => handleParamChange('scheduleTime', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Description hint */}
      {selectedMeta && (
        <p className="text-xs text-muted-foreground">
          {selectedMeta.description}
        </p>
      )}
    </div>
  );
}
