'use client';

import { ArrowRight, User, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/format';
import type { OrderHandoff, OrderAssignment } from '@/lib/types/order-project.types';

// ─── Label maps ──────────────────────────────────────────────────────────────

export const DEPARTMENT_LABELS: Record<string, string> = {
  SALES: 'Kinh doanh',
  FINANCE: 'Kế toán',
  WAREHOUSE_CN: 'Kho TQ',
  LOGISTICS: 'Vận tải',
  XNK: 'XNK',
  WAREHOUSE_VN: 'Kho VN',
  SYSTEM: 'Hệ thống',
};

export const STAGE_LABELS: Record<string, string> = {
  CONSULTING: 'Tiếp nhận',
  QUOTATION: 'Báo giá',
  PENDING_DEPOSIT: 'Chờ cọc',
  SOURCING: 'Mua hàng',
  WAREHOUSE_CN: 'Nhập kho TQ',
  PACKING: 'Đóng gói',
  CONSOLIDATION: 'Ghép cont',
  IN_TRANSIT: 'Vận chuyển',
  CUSTOMS: 'Thông quan',
  WAREHOUSE_VN: 'Nhập kho VN',
  DELIVERING: 'Giao hàng',
  SETTLEMENT: 'Quyết toán',
  COMPLETED: 'Hoàn thành',
};

// ─── Department colour coding ─────────────────────────────────────────────────

const DEPT_BADGE_CLASS: Record<string, string> = {
  SALES: 'bg-blue-100 text-blue-700 border-blue-200',
  FINANCE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  WAREHOUSE_CN: 'bg-amber-100 text-amber-700 border-amber-200',
  LOGISTICS: 'bg-violet-100 text-violet-700 border-violet-200',
  XNK: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  WAREHOUSE_VN: 'bg-rose-100 text-rose-700 border-rose-200',
  SYSTEM: 'bg-slate-100 text-slate-600 border-slate-200',
};

function getDeptBadgeClass(dept: string): string {
  return DEPT_BADGE_CLASS[dept] ?? 'bg-gray-100 text-gray-700 border-gray-200';
}

// ─── Unified timeline entry type ──────────────────────────────────────────────

type TimelineKind = 'handoff' | 'assignment';

interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  timestamp: string;
  stage: string;
  department: string;
  // handoff-specific
  handoffType?: OrderHandoff['handoffType'];
  fromDepartment?: string;
  fromStage?: string;
  durationMinutes?: number | null;
  note?: string | null;
  // assignment-specific
  assigneeName?: string | null;
  assigneeRole?: string;
  status?: OrderAssignment['status'];
  isOverdue?: boolean;
}

function buildTimeline(
  handoffs: OrderHandoff[],
  assignments: OrderAssignment[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...handoffs.map<TimelineEntry>((h) => ({
      id: h.id,
      kind: 'handoff',
      timestamp: h.createdAt,
      stage: h.toStage,
      department: h.toDepartment,
      handoffType: h.handoffType,
      fromDepartment: h.fromDepartment,
      fromStage: h.fromStage,
      durationMinutes: h.durationMinutes,
      note: h.note,
    })),
    ...assignments.map<TimelineEntry>((a) => ({
      id: a.id,
      kind: 'assignment',
      timestamp: a.assignedAt,
      stage: a.stage,
      department: a.departmentCode,
      assigneeName: a.assignee?.fullName ?? null,
      assigneeRole: a.assigneeRole,
      status: a.status,
      isOverdue: a.isOverdue,
    })),
  ];

  entries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return entries;
}

// ─── Duration helper ─────────────────────────────────────────────────────────

function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '';
  if (minutes < 60) return `${minutes} phút`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
}

// ─── Handoff type helpers ─────────────────────────────────────────────────────

function HandoffIcon({ type }: { type: OrderHandoff['handoffType'] }) {
  if (type === 'STAGE_TRANSITION') {
    return <ArrowRight className="h-3.5 w-3.5" />;
  }
  if (type === 'REASSIGNMENT') {
    return <User className="h-3.5 w-3.5" />;
  }
  // ESCALATION
  return <AlertTriangle className="h-3.5 w-3.5" />;
}

function handoffTypeLabel(type: OrderHandoff['handoffType']): string {
  if (type === 'STAGE_TRANSITION') return 'Chuyển giai đoạn';
  if (type === 'REASSIGNMENT') return 'Phân công lại';
  return 'Leo thang';
}

// ─── Dot colour by assignment status / overdue flag ──────────────────────────

function dotClass(entry: TimelineEntry): string {
  if (entry.kind === 'assignment') {
    if (entry.isOverdue) return 'bg-red-500 border-red-300';
    if (entry.status === 'COMPLETED') return 'bg-emerald-500 border-emerald-300';
    if (entry.status === 'ESCALATED') return 'bg-red-500 border-red-300';
    if (entry.status === 'ACTIVE') return 'bg-amber-400 border-amber-200';
    return 'bg-slate-400 border-slate-200';
  }
  // handoff
  if (entry.handoffType === 'ESCALATION') return 'bg-red-500 border-red-300';
  return 'bg-primary border-primary/30';
}

// ─── Component ───────────────────────────────────────────────────────────────

interface OrderProjectTimelineProps {
  handoffs: OrderHandoff[];
  assignments: OrderAssignment[];
}

export function OrderProjectTimeline({
  handoffs,
  assignments,
}: OrderProjectTimelineProps) {
  const entries = buildTimeline(handoffs, assignments);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-8 text-center">
        <Clock className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Chưa có lịch sử bàn giao</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-base font-semibold mb-5">Lịch sử bàn giao</h3>

      {/* Timeline */}
      <div className="relative ml-3">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-5">
          {entries.map((entry) => (
            <div key={`${entry.kind}-${entry.id}`} className="relative flex gap-4 pl-8">
              {/* Dot */}
              <div
                className={cn(
                  'absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-background ring-2',
                  dotClass(entry),
                )}
              />

              <div className="flex-1 min-w-0">
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Stage badge */}
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs font-medium',
                        getDeptBadgeClass(entry.department),
                      )}
                    >
                      {STAGE_LABELS[entry.stage] ?? entry.stage}
                    </Badge>

                    {/* Handoff-specific info */}
                    {entry.kind === 'handoff' && entry.handoffType && (
                      <>
                        {/* From dept → To dept */}
                        {entry.fromDepartment &&
                          entry.fromDepartment !== entry.department && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <span>{DEPARTMENT_LABELS[entry.fromDepartment] ?? entry.fromDepartment}</span>
                              <ArrowRight className="h-3 w-3" />
                              <span>{DEPARTMENT_LABELS[entry.department] ?? entry.department}</span>
                            </span>
                          )}

                        {/* Type icon + label */}
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-muted text-muted-foreground">
                          <HandoffIcon type={entry.handoffType} />
                          {handoffTypeLabel(entry.handoffType)}
                        </span>
                      </>
                    )}

                    {/* Assignment-specific info */}
                    {entry.kind === 'assignment' && (
                      <>
                        {/* Dept badge */}
                        <Badge
                          variant="outline"
                          className="text-xs bg-muted/50 border-0"
                        >
                          {DEPARTMENT_LABELS[entry.department] ?? entry.department}
                        </Badge>

                        {/* Assignee */}
                        {entry.assigneeName && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            {entry.assigneeName}
                          </span>
                        )}

                        {/* Overdue / status indicator */}
                        {entry.isOverdue && (
                          <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs bg-red-100 text-red-700">
                            <AlertTriangle className="h-3 w-3" />
                            Quá hạn
                          </span>
                        )}
                        {!entry.isOverdue && entry.status === 'COMPLETED' && (
                          <span className="rounded-full px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700">
                            Hoàn thành
                          </span>
                        )}
                        {!entry.isOverdue && entry.status === 'ACTIVE' && (
                          <span className="rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700">
                            Đang xử lý
                          </span>
                        )}
                        {entry.status === 'ESCALATED' && (
                          <span className="rounded-full px-2 py-0.5 text-xs bg-red-100 text-red-700">
                            Leo thang
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatDate(entry.timestamp, 'dd/MM HH:mm')}
                  </span>
                </div>

                {/* Duration + note row */}
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                  {entry.durationMinutes != null && entry.durationMinutes > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Thời gian giữ: {formatDuration(entry.durationMinutes)}
                    </span>
                  )}
                  {entry.note && (
                    <span className="text-xs text-muted-foreground italic truncate max-w-xs">
                      {entry.note}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
