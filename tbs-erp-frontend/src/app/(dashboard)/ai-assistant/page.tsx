'use client';

import * as React from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { ChatWindow } from '@/features/ai-assistant/chat-window';

// Video imports
import { Video, Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { JitsiMeet } from '@/features/video/jitsi-meet';
import { RoomList } from '@/features/video/room-list';
import { ScheduleMeetingDialog } from '@/features/video/schedule-meeting-dialog';
import { useCreateRoom, useGetRoomToken } from '@/lib/hooks/use-video';
import type { RoomToken } from '@/lib/types/video.types';

// Automation imports
import { Plus as PlusIcon, Zap as ZapIcon, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
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

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'default', label: 'AI Assistant' },
  { key: 'video', label: 'Video hop' },
  { key: 'automation', label: 'Automation' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// ---------------------------------------------------------------------------
// Video content
// ---------------------------------------------------------------------------

function VideoContent() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [activeToken, setActiveToken] = React.useState<RoomToken | null>(null);
  const createRoom = useCreateRoom();
  const getToken = useGetRoomToken();

  const handleInstantMeeting = async () => {
    try {
      const room = await createRoom.mutateAsync({ title: 'Cuoc hop nhanh' });
      const token = await getToken.mutateAsync(room.id);
      setActiveToken(token);
    } catch {
      // error handled in hooks
    }
  };

  const handleDialogCreated = async (roomId: string) => {
    try {
      const token = await getToken.mutateAsync(roomId);
      setActiveToken(token);
    } catch {
      // skip auto-join if scheduled for later
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Video className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Cuoc hop video</h1>
            <p className="text-xs text-muted-foreground">
              Tao va tham gia cuoc hop qua Jitsi Meet
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleInstantMeeting}
            disabled={createRoom.isPending || getToken.isPending}
          >
            <Zap className="h-4 w-4 mr-1.5" />
            {createRoom.isPending || getToken.isPending ? 'Dang tao...' : 'Bat dau ngay'}
          </Button>

          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Tao cuoc hop
          </Button>
        </div>
      </div>

      {/* Active full-page embed */}
      {activeToken && (
        <div className="rounded-xl overflow-hidden border shadow-md" style={{ height: 600 }}>
          <JitsiMeet
            roomName={activeToken.roomName}
            domain={activeToken.domain}
            token={activeToken.token}
            displayName={activeToken.displayName}
            onLeave={() => setActiveToken(null)}
          />
        </div>
      )}

      {/* Cuoc hop dang dien ra */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Đang diễn ra
        </h2>
        <RoomList filterStatus="ACTIVE" />
      </section>

      {/* Cuoc hop sap toi */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Sắp diễn ra
        </h2>
        <RoomList filterStatus="SCHEDULED" />
      </section>

      {/* Dialog tao cuoc hop */}
      <ScheduleMeetingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleDialogCreated}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card (used by AutomationContent)
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  className?: string;
  isLoading?: boolean;
}

function StatCard({ label, value, icon: Icon, className, isLoading }: StatCardProps) {
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

// ---------------------------------------------------------------------------
// Automation content
// ---------------------------------------------------------------------------

type AutoTabKey = 'all' | 'active' | 'error';

const AUTO_TABS: { key: AutoTabKey; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'Tat ca', icon: ZapIcon },
  { key: 'active', label: 'Đang chạy', icon: CheckCircle2 },
  { key: 'error', label: 'Loi', icon: AlertCircle },
];

function AutomationContent() {
  const [activeTab, setActiveTab] = React.useState<AutoTabKey>('all');
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
    deleteRule.mutate(deletingId, { onSuccess: () => setDeletingId(null) });
  }

  function handleTest(id: string) {
    testRule.mutate(id);
  }

  function handleToggle(id: string, active: boolean) {
    toggleRule.mutate({ id, active });
  }

  const tabCounts: Record<AutoTabKey, number> = {
    all: stats?.total ?? 0,
    active: stats?.active ?? 0,
    error: stats?.error ?? 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation"
        description="Tao va quan ly quy tac tu dong hoa workflow"
        infoKey="ai-assistant"
      >
        <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
          <PlusIcon className="h-4 w-4" />
          Tao rule moi
        </Button>
      </PageHeader>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Tong rules" value={stats?.total ?? 0} icon={ZapIcon} isLoading={statsQuery.isLoading} />
        <StatCard label="Đang chạy" value={stats?.active ?? 0} icon={CheckCircle2} className="text-emerald-600" isLoading={statsQuery.isLoading} />
        <StatCard label="Tat" value={stats?.inactive ?? 0} icon={XCircle} className="text-muted-foreground" isLoading={statsQuery.isLoading} />
        <StatCard label="Loi" value={stats?.error ?? 0} icon={AlertCircle} className="text-destructive" isLoading={statsQuery.isLoading} />
      </div>

      {/* Inner tabs */}
      <div className="border-b">
        <nav className="-mb-px flex gap-1">
          {AUTO_TABS.map((tab) => {
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
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
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
          <ZapIcon className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {activeTab === 'all' ? 'Chua co automation rule nao' : activeTab === 'active' ? 'Khong co rule dang chay' : 'Khong co rule loi'}
          </p>
          {activeTab === 'all' && (
            <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={handleOpenCreate}>
              <PlusIcon className="h-3.5 w-3.5" />
              Tao rule dau tien
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
              onTest={(id) => { setLogRuleId(id); handleTest(id); }}
              isTestPending={testRule.isPending}
              isTogglePending={toggleRule.isPending}
            />
          ))}
        </div>
      )}

      {/* Execution log dialog */}
      {logRuleId && (
        <Dialog open={!!logRuleId} onOpenChange={(v) => !v && setLogRuleId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Lich su thuc thi</DialogTitle>
              <DialogDescription>
                {rules.find((r) => r.id === logRuleId)?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
              <ExecutionLog executions={executions.data ?? []} isLoading={executions.isLoading} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirm */}
      <Dialog open={!!deletingId} onOpenChange={(v) => !v && setDeletingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xac nhan xoa</DialogTitle>
            <DialogDescription>
              Ban chac chan muon xoa automation rule nay? Hanh dong khong the hoan tac.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>Huy</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteRule.isPending}>
              {deleteRule.isPending ? 'Dang xoa...' : 'Xoa'}
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
// Inner component (reads searchParams — must be inside Suspense)
// ---------------------------------------------------------------------------

function CongCuInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get('tab') as TabKey) || 'default';

  const setTab = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'default') params.delete('tab');
    else params.set('tab', tab);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'default' && (
        <div className="flex h-[calc(100vh-64px-120px)] flex-col">
          <ChatWindow />
        </div>
      )}
      {activeTab === 'video' && <VideoContent />}
      {activeTab === 'automation' && <AutomationContent />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function CongCuPage() {
  return (
    <React.Suspense>
      <CongCuInner />
    </React.Suspense>
  );
}
