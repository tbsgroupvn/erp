'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { ChevronRight, ChevronLeft, Save, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { TriggerSelector } from './trigger-selector';
import { ConditionBuilder } from './condition-builder';
import { ActionBuilder } from './action-builder';
import { TRIGGER_CATALOG, ACTION_CATALOG } from '@/lib/types/automation.types';
import { RULE_TEMPLATES, type RuleTemplate } from './rule-templates';
import type {
  AutomationRule,
  CreateAutomationRuleDto,
  TriggerConfig,
  ConditionConfig,
  ActionConfig,
} from '@/lib/types/automation.types';

interface RuleFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateAutomationRuleDto) => void;
  onTest?: () => void;
  defaultValues?: AutomationRule;
  isSaving?: boolean;
  isTesting?: boolean;
}

interface FormValues {
  name: string;
  description: string;
  trigger: TriggerConfig;
  conditions: ConditionConfig[];
  actions: ActionConfig[];
}

const STEPS = [
  { idx: 0, label: 'Thông tin' },
  { idx: 1, label: 'Trigger' },
  { idx: 2, label: 'Điều kiện' },
  { idx: 3, label: 'Hành động' },
];

export function RuleForm({
  open,
  onClose,
  onSubmit,
  onTest,
  defaultValues,
  isSaving,
  isTesting,
}: RuleFormProps) {
  const [step, setStep] = React.useState(0);

  const { control, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<FormValues>({
      defaultValues: {
        name: defaultValues?.name ?? '',
        description: defaultValues?.description ?? '',
        trigger: defaultValues?.trigger ?? ({ type: undefined, params: {} } as unknown as TriggerConfig),
        conditions: defaultValues?.conditions ?? [],
        actions: defaultValues?.actions ?? [],
      },
    });

  // Reset form when defaultValues changes (edit mode)
  React.useEffect(() => {
    if (open) {
      reset({
        name: defaultValues?.name ?? '',
        description: defaultValues?.description ?? '',
        trigger: defaultValues?.trigger ?? ({ type: undefined, params: {} } as unknown as TriggerConfig),
        conditions: defaultValues?.conditions ?? [],
        actions: defaultValues?.actions ?? [],
      });
      setStep(0);
    }
  }, [open, defaultValues, reset]);

  const watchedValues = watch();

  function handleFormSubmit(data: FormValues) {
    onSubmit({
      name: data.name,
      description: data.description || undefined,
      trigger: data.trigger,
      conditions: data.conditions.length > 0 ? data.conditions : undefined,
      actions: data.actions,
    });
  }

  // Preview summary
  const triggerLabel =
    TRIGGER_CATALOG.find((t) => t.type === watchedValues.trigger?.type)?.label ??
    '...';
  const condCount = watchedValues.conditions?.length ?? 0;
  const actLabels = (watchedValues.actions ?? [])
    .map((a) => ACTION_CATALOG.find((ac) => ac.type === a.type)?.label ?? a.type)
    .join(', ');

  const isEditMode = !!defaultValues;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
        side="right"
      >
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>
            {isEditMode ? 'Sửa Automation Rule' : 'Tạo Automation Rule mới'}
          </SheetTitle>

          {/* Step indicators */}
          <div className="flex items-center gap-1 mt-2">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.idx}>
                <button
                  type="button"
                  onClick={() => setStep(s.idx)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    step === s.idx
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                      step === s.idx
                        ? 'bg-primary-foreground text-primary'
                        : 'bg-muted'
                    }`}
                  >
                    {s.idx + 1}
                  </span>
                  {s.label}
                </button>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                )}
              </React.Fragment>
            ))}
          </div>
        </SheetHeader>

        {/* Form body */}
        <form
          id="rule-form"
          onSubmit={handleSubmit(handleFormSubmit)}
          className="flex-1 overflow-y-auto px-6 py-5"
        >
          {/* Step 1 — Name + Templates */}
          {step === 0 && (
            <div className="space-y-4">
              {/* Template picker (chi hien khi tao moi) */}
              {!isEditMode && (
                <div>
                  <Label className="mb-1.5 block">Chon tu mau co san</Label>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto rounded-md border p-2">
                    {RULE_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        className="flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                        onClick={() => {
                          setValue('name', tpl.name);
                          setValue('description', tpl.description);
                          setValue('trigger', tpl.rule.trigger as TriggerConfig);
                          setValue('conditions', (tpl.rule.conditions ?? []) as ConditionConfig[]);
                          setValue('actions', tpl.rule.actions as ActionConfig[]);
                        }}
                      >
                        <span className="font-medium">{tpl.name}</span>
                        <span className="text-xs text-muted-foreground">{tpl.description}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Chon mau de tu dong dien thong tin, hoac tu nhap ben duoi.
                  </p>
                </div>
              )}

              <div>
                <Label className="mb-1.5 block">Ten rule *</Label>
                <Controller
                  name="name"
                  control={control}
                  rules={{ required: 'Bat buoc nhap ten' }}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder="VD: Thong bao khi tao don hang moi"
                      className={errors.name ? 'border-destructive' : ''}
                    />
                  )}
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div>
                <Label className="mb-1.5 block">Mo ta</Label>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <Textarea
                      {...field}
                      placeholder="Mo ta ngan ve muc dich cua rule nay..."
                      className="resize-none"
                      rows={3}
                    />
                  )}
                />
              </div>
            </div>
          )}

          {/* Step 2 — Trigger */}
          {step === 1 && (
            <Controller
              name="trigger"
              control={control}
              render={({ field }) => (
                <TriggerSelector
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          )}

          {/* Step 3 — Conditions */}
          {step === 2 && (
            <Controller
              name="conditions"
              control={control}
              render={({ field }) => (
                <ConditionBuilder
                  triggerType={watchedValues.trigger?.type}
                  conditions={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />
          )}

          {/* Step 4 — Actions */}
          {step === 3 && (
            <Controller
              name="actions"
              control={control}
              render={({ field }) => (
                <ActionBuilder
                  actions={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />
          )}
        </form>

        {/* Preview + Footer */}
        <div className="border-t">
          {/* Summary */}
          <div className="px-6 py-3 bg-muted/30 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Tóm tắt: </span>
            Khi{' '}
            <span className="font-medium text-blue-600">{triggerLabel}</span>
            {condCount > 0 && (
              <>
                , nếu{' '}
                <span className="font-medium text-amber-600">
                  {condCount} điều kiện
                </span>
              </>
            )}
            {actLabels && (
              <>
                , thì{' '}
                <span className="font-medium text-violet-600">{actLabels}</span>
              </>
            )}
          </div>

          <SheetFooter className="px-6 py-4 gap-2">
            {/* Prev/Next */}
            <div className="flex gap-2 mr-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={step === 0}
                onClick={() => setStep((s) => s - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Trước
              </Button>
              {step < STEPS.length - 1 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setStep((s) => s + 1)}
                >
                  Tiếp
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>

            {/* Test + Save */}
            {isEditMode && onTest && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onTest}
                disabled={isTesting}
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                {isTesting ? 'Đang test...' : 'Test'}
              </Button>
            )}
            <Button
              type="submit"
              form="rule-form"
              size="sm"
              disabled={isSaving}
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {isSaving ? 'Đang lưu...' : isEditMode ? 'Cập nhật' : 'Tạo rule'}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
