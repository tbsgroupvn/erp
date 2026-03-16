'use client';

import * as React from 'react';
import { Plus, Zap, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';
import { RuleCard } from '@/features/automation/rule-card';
import { RuleForm } from '@/features/automation/rule-form';
import { ExecutionLog } from '@/features/automation/execution-log';
import {
  useAutomationRules,
  useAutomationStats,
  useCreateAutomationRule,
  useUpdateAutomationRule,
  useDeleteAutomationRule,
  useTestAutomationRule,
  useToggleAutomationRule,
  useAutomationExecutions,
} from '@/lib/hooks/use-automation';
import type { AutomationRule, CreateAutomationRuleDto } from '@/lib/types/automation.types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

type TabKey = 'all' | 'active' | 'error';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'Tất cả', icon: Zap },
  { key: 'active', label: 'Đang chạy', icon: CheckCircle2 },
  { key: 'error', label: 'Lỗi', icon: AlertCircle },
];

export default function AutomationPage() {
  const [activeTab, setActiveTab] = React.useState<TabKey>('all');
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<AutomationRule | undefined>();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [logRuleId, setLogRuleId] = React.useState<string | null>(null);

  const rulesQuery = useAutomationRules();
  const statsQuery = useAutomationStats();
  const createRule = useCreateAutomationRule();
  const updateRule = useUpdateAutomationRule();
  const deleteRule = useDeleteAutomationRule();
  const testRule = useTestAutomationRule();
  const toggleRule = useToggleAutomationRule();
  const executions = useAutomationExecutions(logRuleId ?? '', 50);

  const rules = React.useMemo(() => rulesQuery.data ?? [], [rulesQuery.data]);
  const stats = statsQuery.data;

  const filteredRules = React.useMemo(() => {
    switch (activeTab) {
      case 'active':
        return rules.filter((r) => r.status === 'ACTIVE');
      case 'error':
        return rules.filter((r) => r.status === 'ERROR');
      default:
        return rules;
    }
  }, [rules, activeTab]);

  function handleOpenCreate() {
    setEditingRule(undefined);
    setIsFormOpen(true);
  }

  function handleEdit(rule: AutomationRule) {
    setEditingRule(rule);
    setIsFormOpen(true);
  }

  function handleFormSubmit(dto: CreateAutomationRuleDto) {
    if (editingRule) {
      updateRule.mutate(
        { id: editingRule.id, dto },
        { onSuccess: () => setIsFormOpen(false) },
      );
    } else {
      createRule.mutate(dto, { onSuccess: () => setIsFormOpen(false) });
    }
  }

  function handleDelete() {
    if (!deletingId) return;
    deleteRule.mutate(deletingId, {
      onSuccess: () => setDeletingId(null),
    });
  }

  function handleTest(id: string) {
    testRule.mutate(id);
  }

  function handleToggle(id: string, active: boolean) {
    toggleRule.mutate({ id, active });
  }

  const tabCounts: Record<TabKey, number> = {
    all: stats?.total ?? 0,
    active: stats?.active ?? 0,
    error: stats?.error ?? 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation"
        description="Tạo và quản lý quy tắc tự động hóa workflow"
      >
        <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Tạo rule mới
        </Button>
      </PageHeader>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Tổng rules"
          value={stats?.total ?? 0}
          icon={Zap}
          isLoading={statsQuery.isLoading}
        />
        <StatCard
          label="Đang chạy"
          value={stats?.active ?? 0}
          icon={CheckCircle2}
          className="text-emerald-600"
          isLoading={statsQuery.isLoading}
        />
        <StatCard
          label="Tắt"
          value={stats?.inactive ?? 0}
          icon={XCircle}
          className="text-muted-foreground"
          isLoading={statsQuery.isLoading}
        />
        <StatCard
          label="Lỗi"
          value={stats?.error ?? 0}
          icon={AlertCircle}
          className="text-destructive"
          isLoading={statsQuery.isLoading}
        />
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = tabCounts[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Rule list */}
      {rulesQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Zap className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {activeTab === 'all'
              ? 'Chưa có automation rule nào'
              : activeTab === 'active'
              ? 'Không có rule đang chạy'
              : 'Không có rule lỗi'}
          </p>
          {activeTab === 'all' && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={handleOpenCreate}
            >
              <Plus className="h-3.5 w-3.5" />
              Tạo rule đầu tiên
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={handleEdit}
              onDelete={(id) => setDeletingId(id)}
              onToggle={handleToggle}
              onTest={(id) => {
                setLogRuleId(id);
                handleTest(id);
              }}
              isTestPending={testRule.isPending}
              isTogglePending={toggleRule.isPending}
            />
          ))}
        </div>
      )}

      {/* Execution log dialog */}
      {logRuleId && (
        <Dialog
          open={!!logRuleId}
          onOpenChange={(v) => !v && setLogRuleId(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Lịch sử thực thi</DialogTitle>
              <DialogDescription>
                {rules.find((r) => r.id === logRuleId)?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
              <ExecutionLog
                executions={executions.data ?? []}
                isLoading={executions.isLoading}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirm */}
      <Dialog
        open={!!deletingId}
        onOpenChange={(v) => !v && setDeletingId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
            <DialogDescription>
              Bạn chắc chắn muốn xóa automation rule này? Hành động không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingId(null)}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteRule.isPending}
            >
              {deleteRule.isPending ? 'Đang xóa...' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Form Sheet */}
      <RuleForm
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        onTest={editingRule ? () => handleTest(editingRule.id) : undefined}
        defaultValues={editingRule}
        isSaving={createRule.isPending || updateRule.isPending}
        isTesting={testRule.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card component
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  className?: string;
  isLoading?: boolean;
}

function StatCard({
  label,
  value,
  icon: Icon,
  className,
  isLoading,
}: StatCardProps) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
        <Icon className={cn('h-4 w-4', className)} />
        {label}
      </div>
      {isLoading ? (
        <Skeleton className="h-7 w-12" />
      ) : (
        <p className={cn('text-2xl font-semibold', className)}>{value}</p>
      )}
    </div>
  );
}
