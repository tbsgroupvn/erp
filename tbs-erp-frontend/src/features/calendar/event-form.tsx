'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { useCreateEvent, useUpdateEvent, useMeetingRooms } from '@/lib/hooks/use-calendar';
import type { CalendarEvent, EventVisibility, CreateEventPayload, UpdateEventPayload } from '@/lib/types/calendar.types';
import { cn } from '@/lib/utils/cn';

// ─── Validation schema ────────────────────────────────────────────────────

const eventSchema = z
  .object({
    title: z.string().min(1, 'Tiêu đề không được để trống'),
    description: z.string().optional(),
    location: z.string().optional(),
    color: z.string().default('#3b82f6'),
    allDay: z.boolean().default(false),
    startAt: z.string().min(1, 'Vui lòng chọn thời gian bắt đầu'),
    endAt: z.string().min(1, 'Vui lòng chọn thời gian kết thúc'),
    visibility: z.enum(['PUBLIC', 'TEAM', 'PRIVATE']).default('PUBLIC'),
    roomId: z.string().optional(),
    reminderMinutes: z.array(z.number()).default([]),
  })
  .refine(
    (data) => {
      if (!data.startAt || !data.endAt) return true;
      return new Date(data.endAt) > new Date(data.startAt);
    },
    { message: 'Thời gian kết thúc phải sau thời gian bắt đầu', path: ['endAt'] },
  );

type EventFormValues = z.infer<typeof eventSchema>;

// ─── Preset colors ─────────────────────────────────────────────────────────

const PRESET_COLORS = [
  { hex: '#3b82f6', label: 'Xanh dương' },
  { hex: '#22c55e', label: 'Xanh lá' },
  { hex: '#f59e0b', label: 'Vàng' },
  { hex: '#ef4444', label: 'Đỏ' },
  { hex: '#a855f7', label: 'Tím' },
  { hex: '#ec4899', label: 'Hồng' },
];

const REMINDER_OPTIONS = [
  { value: 5, label: '5 phút trước' },
  { value: 15, label: '15 phút trước' },
  { value: 30, label: '30 phút trước' },
  { value: 60, label: '1 giờ trước' },
  { value: 1440, label: '1 ngày trước' },
];

const VISIBILITY_LABELS: Record<EventVisibility, string> = {
  PUBLIC: 'Công khai (mọi người)',
  TEAM: 'Team/Phòng ban',
  PRIVATE: 'Riêng tư',
};

// ─── Helper: format datetime-local value ──────────────────────────────────

function toLocalDatetimeValue(isoStr: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeValue(localStr: string): string {
  if (!localStr) return '';
  return new Date(localStr).toISOString();
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface EventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass existing event to switch to edit mode */
  event?: CalendarEvent;
  /** Pre-fill start date (e.g. from clicking on a day) */
  defaultDate?: Date;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function EventForm({ open, onOpenChange, event, defaultDate }: EventFormProps) {
  const isEdit = !!event;
  const createMutation = useCreateEvent();
  const updateMutation = useUpdateEvent();
  const { data: rooms = [] } = useMeetingRooms();

  const [reminderMinutes, setReminderMinutes] = useState<number[]>([]);

  const defaultStart = defaultDate
    ? (() => {
        const d = new Date(defaultDate);
        d.setHours(9, 0, 0, 0);
        return toLocalDatetimeValue(d.toISOString());
      })()
    : '';

  const defaultEnd = defaultDate
    ? (() => {
        const d = new Date(defaultDate);
        d.setHours(10, 0, 0, 0);
        return toLocalDatetimeValue(d.toISOString());
      })()
    : '';

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      description: '',
      location: '',
      color: '#3b82f6',
      allDay: false,
      startAt: defaultStart,
      endAt: defaultEnd,
      visibility: 'PUBLIC',
      roomId: '',
      reminderMinutes: [],
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (event) {
      form.reset({
        title: event.title,
        description: event.description ?? '',
        location: event.location ?? '',
        color: event.color,
        allDay: event.allDay,
        startAt: toLocalDatetimeValue(event.startAt),
        endAt: toLocalDatetimeValue(event.endAt),
        visibility: event.visibility,
        roomId: event.roomId ?? '',
        reminderMinutes: [],
      });
      setReminderMinutes(event.reminders.map((r) => r.minutesBefore));
    } else {
      form.reset({
        title: '',
        description: '',
        location: '',
        color: '#3b82f6',
        allDay: false,
        startAt: defaultStart,
        endAt: defaultEnd,
        visibility: 'PUBLIC',
        roomId: '',
        reminderMinutes: [],
      });
      setReminderMinutes([]);
    }
  }, [event, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleReminder = (minutes: number) => {
    setReminderMinutes((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes],
    );
  };

  const onSubmit = async (values: EventFormValues) => {
    const startIso = fromLocalDatetimeValue(values.startAt);
    const endIso = fromLocalDatetimeValue(values.endAt);

    if (isEdit && event) {
      const payload: UpdateEventPayload = {
        title: values.title,
        description: values.description || undefined,
        location: values.location || undefined,
        color: values.color,
        allDay: values.allDay,
        startAt: startIso,
        endAt: endIso,
        visibility: values.visibility,
        roomId: values.roomId || undefined,
      };
      await updateMutation.mutateAsync({ id: event.id, data: payload });
    } else {
      const payload: CreateEventPayload = {
        title: values.title,
        description: values.description || undefined,
        location: values.location || undefined,
        color: values.color,
        allDay: values.allDay,
        startAt: startIso,
        endAt: endIso,
        visibility: values.visibility,
        roomId: values.roomId || undefined,
        reminderMinutes: reminderMinutes.length > 0 ? reminderMinutes : undefined,
      };
      await createMutation.mutateAsync(payload);
    }

    onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const allDay = form.watch('allDay');
  const selectedColor = form.watch('color');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện mới'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">
              Tiêu đề <span className="text-destructive">*</span>
            </Label>
            <Input id="title" placeholder="Nhập tiêu đề sự kiện..." {...form.register('title')} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* Color picker */}
          <div className="space-y-1.5">
            <Label>Màu sự kiện</Label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.label}
                  onClick={() => form.setValue('color', c.hex)}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                    selectedColor === c.hex ? 'border-foreground scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* All day toggle */}
          <div className="flex items-center gap-2">
            <input
              id="allDay"
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              {...form.register('allDay')}
            />
            <Label htmlFor="allDay" className="cursor-pointer">
              Sự kiện cả ngày
            </Label>
          </div>

          {/* Start / End */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startAt">
                Bắt đầu <span className="text-destructive">*</span>
              </Label>
              {allDay ? (
                <Input
                  id="startAt"
                  type="date"
                  {...form.register('startAt')}
                />
              ) : (
                <Input
                  id="startAt"
                  type="datetime-local"
                  {...form.register('startAt')}
                />
              )}
              {form.formState.errors.startAt && (
                <p className="text-xs text-destructive">{form.formState.errors.startAt.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endAt">
                Kết thúc <span className="text-destructive">*</span>
              </Label>
              {allDay ? (
                <Input
                  id="endAt"
                  type="date"
                  {...form.register('endAt')}
                />
              ) : (
                <Input
                  id="endAt"
                  type="datetime-local"
                  {...form.register('endAt')}
                />
              )}
              {form.formState.errors.endAt && (
                <p className="text-xs text-destructive">{form.formState.errors.endAt.message}</p>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="location">Địa điểm</Label>
            <Input
              id="location"
              placeholder="Nhập địa điểm (tùy chọn)..."
              {...form.register('location')}
            />
          </div>

          {/* Meeting room */}
          {rooms.length > 0 && (
            <div className="space-y-1.5">
              <Label>Phòng họp</Label>
              <Select
                value={form.watch('roomId') || '__none__'}
                onValueChange={(v) => form.setValue('roomId', v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phòng họp (tùy chọn)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Không chọn phòng</SelectItem>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                      {r.location ? ` — ${r.location}` : ''}
                      {` (${r.capacity} người)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Visibility */}
          <div className="space-y-1.5">
            <Label>Quyền xem</Label>
            <Select
              value={form.watch('visibility')}
              onValueChange={(v) => form.setValue('visibility', v as EventVisibility)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(VISIBILITY_LABELS) as EventVisibility[]).map((v) => (
                  <SelectItem key={v} value={v}>
                    {VISIBILITY_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Mô tả sự kiện (tùy chọn)..."
              {...form.register('description')}
            />
          </div>

          {/* Reminders (only for new events) */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>Nhắc nhở trước</Label>
              <div className="flex flex-wrap gap-2">
                {REMINDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleReminder(opt.value)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      reminderMinutes.includes(opt.value)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:bg-accent',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo sự kiện'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
