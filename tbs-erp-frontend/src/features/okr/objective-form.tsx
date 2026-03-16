'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useCreateObjective, useUpdateObjective, useParentCandidates } from '@/lib/hooks/use-okr';
import type { Objective, OKRPeriod, OKRLevel } from '@/lib/types/okr.types';
import {
  OKR_PERIOD_LABELS,
  OKR_LEVEL_LABELS,
} from '@/lib/types/okr.types';

const objectiveSchema = z.object({
  title: z.string().min(1, 'Nhập tiêu đề mục tiêu'),
  description: z.string().optional(),
  period: z.enum(['Q1', 'Q2', 'Q3', 'Q4', 'ANNUAL'] as const),
  year: z.coerce.number().min(2020).max(2099),
  level: z.enum(['COMPANY', 'DEPARTMENT', 'INDIVIDUAL'] as const),
  department: z.string().optional(),
  parentId: z.string().optional(),
});

type ObjectiveFormValues = z.infer<typeof objectiveSchema>;

interface ObjectiveFormProps {
  open: boolean;
  onClose: () => void;
  editingObjective?: Objective | null;
}

export function ObjectiveForm({ open, onClose, editingObjective }: ObjectiveFormProps) {
  const isEditing = !!editingObjective;
  const createObjective = useCreateObjective();
  const updateObjective = useUpdateObjective();

  const form = useForm<ObjectiveFormValues>({
    resolver: zodResolver(objectiveSchema),
    defaultValues: {
      title: '',
      description: '',
      period: 'Q1',
      year: new Date().getFullYear(),
      level: 'INDIVIDUAL',
      department: '',
      parentId: '',
    },
  });

  const watchedLevel = form.watch('level');
  const watchedPeriod = form.watch('period');
  const watchedYear = form.watch('year');

  const { data: parentCandidates = [] } = useParentCandidates(
    watchedLevel as OKRLevel,
    watchedPeriod as OKRPeriod,
    watchedYear,
  );

  // Load editing values
  useEffect(() => {
    if (editingObjective) {
      form.reset({
        title: editingObjective.title,
        description: editingObjective.description ?? '',
        period: editingObjective.period,
        year: editingObjective.year,
        level: editingObjective.level,
        department: editingObjective.department ?? '',
        parentId: editingObjective.parentId ?? '',
      });
    } else {
      form.reset({
        title: '',
        description: '',
        period: 'Q1',
        year: new Date().getFullYear(),
        level: 'INDIVIDUAL',
        department: '',
        parentId: '',
      });
    }
  }, [editingObjective, form]);

  const onSubmit = (values: ObjectiveFormValues) => {
    const payload = {
      ...values,
      parentId: values.parentId || undefined,
      department: values.department || undefined,
      description: values.description || undefined,
    };

    if (isEditing && editingObjective) {
      updateObjective.mutate(
        { id: editingObjective.id, dto: { title: payload.title, description: payload.description } },
        { onSuccess: onClose },
      );
    } else {
      createObjective.mutate(payload, { onSuccess: onClose });
    }
  };

  const isPending = createObjective.isPending || updateObjective.isPending;

  const showParentSelect =
    watchedLevel === 'DEPARTMENT' || watchedLevel === 'INDIVIDUAL';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Chỉnh sửa mục tiêu' : 'Tạo mục tiêu mới'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tiêu đề mục tiêu *</FormLabel>
                  <FormControl>
                    <Input placeholder="VD: Tăng doanh thu 30% trong Q2" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mô tả</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Mô tả chi tiết mục tiêu..."
                      rows={3}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Period + Year */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chu kỳ *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(OKR_PERIOD_LABELS) as OKRPeriod[]).map((p) => (
                          <SelectItem key={p} value={p}>
                            {OKR_PERIOD_LABELS[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Năm *</FormLabel>
                    <FormControl>
                      <Input type="number" min={2020} max={2099} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Level + Department */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cấp độ *</FormLabel>
                    <Select
                      onValueChange={(v) => {
                        field.onChange(v);
                        form.setValue('parentId', '');
                      }}
                      value={field.value}
                      disabled={isEditing}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(OKR_LEVEL_LABELS) as OKRLevel[]).map((l) => (
                          <SelectItem key={l} value={l}>
                            {OKR_LEVEL_LABELS[l]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phòng ban</FormLabel>
                    <FormControl>
                      <Input placeholder="VD: Kinh doanh, Logistics..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Parent OKR */}
            {showParentSelect && parentCandidates.length > 0 && (
              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mục tiêu cha</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn mục tiêu cha (tùy chọn)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Không có</SelectItem>
                        {parentCandidates.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title}
                            {p.department ? ` (${p.department})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Lưu thay đổi' : 'Tạo mục tiêu'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
