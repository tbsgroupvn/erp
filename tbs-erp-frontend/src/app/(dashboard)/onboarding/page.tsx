'use client';

import { useState, useMemo } from 'react';
import { Plus, ChevronDown, ChevronRight, CheckCircle2, Circle, Loader2, CheckCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';
import {
  useOnboardingList,
  useCreateChecklist,
  useToggleChecklistItem,
  useMarkChecklistComplete,
} from '@/lib/hooks/use-onboarding';
import { useEmployees } from '@/lib/hooks/use-employees';
import type { OnboardingChecklist, ChecklistType, ChecklistItem } from '@/lib/api/onboarding.api';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ChecklistType, string> = {
  ONBOARDING: 'Onboarding',
  OFFBOARDING: 'Offboarding',
};

const TYPE_BADGE: Record<ChecklistType, string> = {
  ONBOARDING: 'bg-green-100 text-green-700 border-green-200',
  OFFBOARDING: 'bg-orange-100 text-orange-700 border-orange-200',
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ items }: { items: ChecklistItem[] }) {
  const total = items.length;
  const done = items.filter((i) => i.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {done}/{total} mục hoàn thành
        </span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className={cn(
            'h-1.5 rounded-full transition-all',
            pct === 100 ? 'bg-green-500' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Checklist Row ────────────────────────────────────────────────────────────

interface ChecklistRowProps {
  checklist: OnboardingChecklist;
}

function ChecklistRow({ checklist }: ChecklistRowProps) {
  const [expanded, setExpanded] = useState(false);
  const toggleItem = useToggleChecklistItem();
  const markComplete = useMarkChecklistComplete();

  const items = checklist.items as ChecklistItem[];
  const isCompleted = !!checklist.completedAt;
  const allDone = items.every((i) => i.completed);

  return (
    <Card className={cn('transition-shadow', isCompleted && 'opacity-80')}>
      {/* Header row */}
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Expand toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-0.5 rounded p-0.5 hover:bg-muted transition-colors"
            aria-label={expanded ? 'Thu gọn' : 'Xem chi tiết'}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {/* Main info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">
                {checklist.employee.fullName}
              </span>
              <span className="text-xs text-muted-foreground">
                {checklist.employee.code}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                  TYPE_BADGE[checklist.type as ChecklistType],
                )}
              >
                {TYPE_LABELS[checklist.type as ChecklistType] ?? checklist.type}
              </span>
              {isCompleted && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Hoàn thành
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {checklist.employee.positionTitle} &bull; {checklist.employee.departmentCode}
            </p>

            <ProgressBar items={items} />

            <p className="text-xs text-muted-foreground">
              Tạo ngày: {formatDate(checklist.createdAt)}
              {isCompleted && checklist.completedAt && (
                <> &bull; Hoàn thành: {formatDate(checklist.completedAt)}</>
              )}
            </p>
          </div>

          {/* Mark complete button */}
          {!isCompleted && allDone && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-green-600 border-green-300 hover:bg-green-50"
              onClick={() => markComplete.mutate(checklist.id)}
              disabled={markComplete.isPending}
            >
              {markComplete.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
              )}
              Đánh dấu hoàn thành
            </Button>
          )}
        </div>
      </CardContent>

      {/* Expandable checklist items */}
      {expanded && (
        <div className="border-t border-border/60 px-4 pb-4 pt-3">
          <ul className="space-y-2">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <button
                  disabled={isCompleted || toggleItem.isPending}
                  onClick={() =>
                    toggleItem.mutate({ id: checklist.id, itemIndex: idx })
                  }
                  className={cn(
                    'mt-0.5 shrink-0 rounded transition-colors',
                    isCompleted
                      ? 'cursor-default'
                      : 'hover:opacity-80',
                  )}
                  aria-label={item.completed ? 'Bỏ đánh dấu' : 'Đánh dấu hoàn thành'}
                >
                  {item.completed ? (
                    <CheckCircle2 className="h-4.5 w-4.5 text-green-500 h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/50" />
                  )}
                </button>
                <div className="flex-1">
                  <span
                    className={cn(
                      'text-sm',
                      item.completed && 'line-through text-muted-foreground',
                    )}
                  >
                    {item.task}
                  </span>
                  {item.completed && item.completedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(item.completedAt)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
}

function CreateDialog({ open, onClose }: CreateDialogProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [type, setType] = useState<ChecklistType>('ONBOARDING');
  const create = useCreateChecklist();
  const { data: empData } = useEmployees({ limit: 500, status: 'ACTIVE' } as any);
  const employees = empData?.data ?? [];

  const handleSubmit = () => {
    if (!employeeId) return;
    create.mutate(
      { employeeId, type },
      {
        onSuccess: () => {
          setEmployeeId('');
          setType('ONBOARDING');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo checklist mới</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="employee">Nhân viên</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger id="employee">
                <SelectValue placeholder="Chọn nhân viên..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.fullName} ({e.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type">Loại checklist</Label>
            <Select value={type} onValueChange={(v) => setType(v as ChecklistType)}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ONBOARDING">Onboarding (nhận việc)</SelectItem>
                <SelectItem value="OFFBOARDING">Offboarding (nghỉ việc)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!employeeId || create.isPending}
          >
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tạo checklist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const completedParam =
    statusFilter === 'completed'
      ? true
      : statusFilter === 'in_progress'
        ? false
        : undefined;

  const { data, isLoading } = useOnboardingList({
    type: typeFilter !== 'all' ? (typeFilter as ChecklistType) : undefined,
    completed: completedParam,
    page,
    limit: 20,
  });

  const checklists: OnboardingChecklist[] = (data?.data ?? []) as OnboardingChecklist[];

  // Summary stats
  const stats = useMemo(() => {
    const all = checklists;
    return {
      total: data?.meta?.total ?? 0,
      onboarding: all.filter((c) => c.type === 'ONBOARDING').length,
      offboarding: all.filter((c) => c.type === 'OFFBOARDING').length,
      completed: all.filter((c) => c.completedAt).length,
    };
  }, [checklists, data?.meta?.total]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding / Offboarding"
        description="Quản lý checklist nhận việc và nghỉ việc nhân viên"
        infoKey="onboarding"
      >
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Tạo checklist
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onboarding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.onboarding}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offboarding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.offboarding}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đã hoàn thành</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Loại checklist" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả loại</SelectItem>
            <SelectItem value="ONBOARDING">Onboarding</SelectItem>
            <SelectItem value="OFFBOARDING">Offboarding</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="in_progress">Đang thực hiện</SelectItem>
            <SelectItem value="completed">Hoàn thành</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Checklist list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : checklists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Chưa có checklist nào</p>
            <Button
              className="mt-4"
              size="sm"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Tạo checklist đầu tiên
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {checklists.map((checklist) => (
            <ChecklistRow key={checklist.id} checklist={checklist} />
          ))}
        </div>
      )}

      <CreateDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
