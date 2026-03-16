'use client';

import * as React from 'react';
import { Plus, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ACTION_CATALOG,
  type ActionConfig,
  type ActionType,
} from '@/lib/types/automation.types';

interface ActionBuilderProps {
  actions: ActionConfig[];
  onChange: (actions: ActionConfig[]) => void;
}

function emptyAction(): ActionConfig {
  return { type: 'SEND_NOTIFICATION', params: {} };
}

export function ActionBuilder({ actions, onChange }: ActionBuilderProps) {
  const [dragging, setDragging] = React.useState<number | null>(null);

  function addAction() {
    onChange([...actions, emptyAction()]);
  }

  function removeAction(idx: number) {
    onChange(actions.filter((_, i) => i !== idx));
  }

  function updateActionType(idx: number, type: ActionType) {
    onChange(
      actions.map((a, i) => (i === idx ? { type, params: {} } : a)),
    );
  }

  function updateActionParam(
    idx: number,
    key: string,
    val: string | number,
  ) {
    onChange(
      actions.map((a, i) =>
        i === idx ? { ...a, params: { ...a.params, [key]: val } } : a,
      ),
    );
  }

  // Simple drag-and-drop reorder
  function handleDragStart(idx: number) {
    setDragging(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragging === null || dragging === idx) return;
    const reordered = [...actions];
    const [item] = reordered.splice(dragging, 1);
    reordered.splice(idx, 0, item);
    onChange(reordered);
    setDragging(idx);
  }

  function handleDragEnd() {
    setDragging(null);
  }

  return (
    <div className="space-y-3">
      {actions.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">
          Chưa có hành động nào. Thêm ít nhất một hành động.
        </p>
      )}

      {actions.map((action, idx) => (
        <div
          key={idx}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDragEnd={handleDragEnd}
          className={`rounded-lg border bg-card p-3 space-y-3 transition-opacity ${
            dragging === idx ? 'opacity-50' : 'opacity-100'
          }`}
        >
          {/* Header row */}
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
              {idx + 1}
            </span>
            <Select
              value={action.type}
              onValueChange={(v) => updateActionType(idx, v as ActionType)}
            >
              <SelectTrigger className="h-8 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_CATALOG.map((a) => (
                  <SelectItem key={a.type} value={a.type} className="text-xs">
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeAction(idx)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Params */}
          <ActionParams
            action={action}
            onChange={(key, val) => updateActionParam(idx, key, val)}
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs"
        onClick={addAction}
      >
        <Plus className="h-3.5 w-3.5" />
        Thêm hành động
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dynamic param inputs per action type
// ---------------------------------------------------------------------------

interface ActionParamsProps {
  action: ActionConfig;
  onChange: (key: string, val: string | number) => void;
}

function ActionParams({ action, onChange }: ActionParamsProps) {
  const p = action.params;

  switch (action.type) {
    case 'SEND_NOTIFICATION':
      return (
        <div className="space-y-2">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              ID người nhận
            </Label>
            <Input
              className="h-7 text-xs"
              placeholder="userId..."
              value={p.userId ?? ''}
              onChange={(e) => onChange('userId', e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Nội dung (hỗ trợ {`{{order.code}}`})
            </Label>
            <Textarea
              className="min-h-[60px] resize-none text-xs"
              placeholder="Đơn hàng {{order.code}} vừa được tạo..."
              value={p.message ?? ''}
              onChange={(e) => onChange('message', e.target.value)}
            />
          </div>
        </div>
      );

    case 'CREATE_TASK':
      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <Label className="mb-1 block text-xs text-muted-foreground">
              Tiêu đề (hỗ trợ {`{{order.code}}`})
            </Label>
            <Input
              className="h-7 text-xs"
              placeholder="Kiểm tra đơn {{order.code}}..."
              value={p.title ?? ''}
              onChange={(e) => onChange('title', e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Giao cho (userId)
            </Label>
            <Input
              className="h-7 text-xs"
              placeholder="userId..."
              value={p.assigneeId ?? ''}
              onChange={(e) => onChange('assigneeId', e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Ưu tiên
            </Label>
            <Select
              value={p.priority ?? 'MEDIUM'}
              onValueChange={(v) => onChange('priority', v)}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW" className="text-xs">Thấp</SelectItem>
                <SelectItem value="MEDIUM" className="text-xs">Trung bình</SelectItem>
                <SelectItem value="HIGH" className="text-xs">Cao</SelectItem>
                <SelectItem value="URGENT" className="text-xs">Khẩn cấp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Hạn (ngày kể từ hôm nay)
            </Label>
            <Input
              className="h-7 text-xs"
              type="number"
              min={1}
              placeholder="3"
              value={p.dueInDays ?? ''}
              onChange={(e) => onChange('dueInDays', parseInt(e.target.value) || '')}
            />
          </div>
        </div>
      );

    case 'SEND_EMAIL':
      return (
        <div className="space-y-2">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Gửi tới (email)
            </Label>
            <Input
              className="h-7 text-xs"
              type="email"
              placeholder="example@company.com"
              value={p.to ?? ''}
              onChange={(e) => onChange('to', e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Tiêu đề email
            </Label>
            <Input
              className="h-7 text-xs"
              placeholder="Thông báo từ TBS ERP"
              value={p.subject ?? ''}
              onChange={(e) => onChange('subject', e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Nội dung
            </Label>
            <Textarea
              className="min-h-[60px] resize-none text-xs"
              placeholder="Nội dung email..."
              value={p.body ?? ''}
              onChange={(e) => onChange('body', e.target.value)}
            />
          </div>
        </div>
      );

    case 'WEBHOOK_CALL':
      return (
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <Label className="mb-1 block text-xs text-muted-foreground">
              URL
            </Label>
            <Input
              className="h-7 text-xs"
              placeholder="https://hooks.example.com/..."
              value={p.url ?? ''}
              onChange={(e) => onChange('url', e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Method
            </Label>
            <Select
              value={p.method ?? 'POST'}
              onValueChange={(v) => onChange('method', v)}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POST" className="text-xs">POST</SelectItem>
                <SelectItem value="GET" className="text-xs">GET</SelectItem>
                <SelectItem value="PUT" className="text-xs">PUT</SelectItem>
                <SelectItem value="PATCH" className="text-xs">PATCH</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case 'UPDATE_FIELD':
      return (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Entity
            </Label>
            <Input
              className="h-7 text-xs"
              placeholder="order"
              value={p.entityType ?? ''}
              onChange={(e) => onChange('entityType', e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Trường
            </Label>
            <Input
              className="h-7 text-xs"
              placeholder="status"
              value={p.field ?? ''}
              onChange={(e) => onChange('field', e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Giá trị
            </Label>
            <Input
              className="h-7 text-xs"
              placeholder="COMPLETED"
              value={p.value ?? ''}
              onChange={(e) => onChange('value', e.target.value)}
            />
          </div>
        </div>
      );

    case 'ASSIGN_USER':
      return (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Entity
            </Label>
            <Input
              className="h-7 text-xs"
              placeholder="task / order"
              value={p.entityType ?? ''}
              onChange={(e) => onChange('entityType', e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Gán cho (userId)
            </Label>
            <Input
              className="h-7 text-xs"
              placeholder="userId..."
              value={p.userId ?? ''}
              onChange={(e) => onChange('userId', e.target.value)}
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}
