'use client';

import { User, Clock, AlertTriangle, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatDate } from '@/lib/utils/format';
import type { OrderAssignment, OrderProjectSLA } from '@/lib/types/order-project.types';
import { DEPARTMENT_LABELS, STAGE_LABELS } from './order-project-timeline';

// ─── Role → Vietnamese label ──────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  CEO: 'Tổng giám đốc',
  COO: 'Giám đốc điều hành',
  CFO: 'Giám đốc tài chính',
  DIRECTOR_OPERATIONS: 'Giám đốc vận hành',
  SALES_DIRECTOR: 'Giám đốc kinh doanh',
  SALES_LEADER: 'Trưởng nhóm kinh doanh',
  SALE: 'Nhân viên kinh doanh',
  MARKETING_STAFF: 'Marketing',
  CSKH: 'CSKH',
  CHIEF_ACCOUNTANT: 'Kế toán trưởng',
  ACCOUNTANT: 'Kế toán',
  ACCOUNTANT_AR: 'Kế toán công nợ',
  ACCOUNTANT_COST: 'Kế toán chi phí',
  HR_MANAGER: 'Trưởng phòng HR',
  LOGISTICS_MANAGER: 'Quản lý vận tải',
  XNK_MANAGER: 'Trưởng phòng XNK',
  XNK_STAFF: 'Nhân viên XNK',
  WAREHOUSE_MANAGER: 'Quản lý kho',
  WAREHOUSE_CN_AGENT: 'NV kho TQ',
  WAREHOUSE_VN_MANAGER: 'Quản lý kho VN',
  WAREHOUSE_VN_STAFF: 'NV kho VN',
  DRIVER: 'Tài xế',
};

// ─── SLA helpers ─────────────────────────────────────────────────────────────

function slaBarClass(percent: number, isOverdue: boolean): string {
  if (isOverdue) return '[&>div]:bg-red-500';
  if (percent >= 90) return '[&>div]:bg-red-500';
  if (percent >= 70) return '[&>div]:bg-amber-400';
  return '[&>div]:bg-emerald-500';
}

function formatRemainingTime(remainingMs: number | null, isOverdue: boolean): string {
  if (remainingMs == null) return 'Không có SLA';

  const absMs = Math.abs(remainingMs);
  const totalMinutes = Math.floor(absMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let timeStr: string;
  if (hours > 0) {
    timeStr = minutes > 0 ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
  } else {
    timeStr = `${minutes} phút`;
  }

  if (isOverdue) return `Quá hạn ${timeStr}`;
  return `Còn lại ${timeStr}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface OrderAssignmentCardProps {
  assignment: OrderAssignment | undefined;
  sla: OrderProjectSLA;
}

export function OrderAssignmentCard({ assignment, sla }: OrderAssignmentCardProps) {
  if (!assignment) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Người phụ trách hiện tại</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <User className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Không có người phụ trách</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const clampedPercent = Math.min(Math.max(sla.percentElapsed, 0), 100);
  const stageName = STAGE_LABELS[assignment.stage] ?? assignment.stage;
  const deptName = DEPARTMENT_LABELS[assignment.departmentCode] ?? assignment.departmentCode;
  const deptBadgeClass = getDeptBadgeClass(assignment.departmentCode);

  return (
    <Card
      className={cn(
        'border',
        sla.isOverdue
          ? 'border-red-300 bg-red-50/30'
          : assignment.isOverdue
          ? 'border-amber-300 bg-amber-50/30'
          : '',
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Người phụ trách hiện tại</CardTitle>
          <Badge
            variant="outline"
            className={cn('text-xs font-medium', deptBadgeClass)}
          >
            {stageName}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Assignee row */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {assignment.assignee?.fullName ?? (
                <span className="text-muted-foreground">Chưa phân công</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABELS[assignment.assigneeRole] ?? assignment.assigneeRole}
            </p>
          </div>
        </div>

        {/* Department */}
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Badge
            variant="outline"
            className={cn('text-xs', deptBadgeClass)}
          >
            {deptName}
          </Badge>
        </div>

        {/* SLA progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tiến độ SLA</span>
            <span
              className={cn(
                'font-medium tabular-nums',
                sla.isOverdue
                  ? 'text-red-600'
                  : clampedPercent >= 90
                  ? 'text-red-600'
                  : clampedPercent >= 70
                  ? 'text-amber-600'
                  : 'text-emerald-600',
              )}
            >
              {clampedPercent.toFixed(0)}%
            </span>
          </div>

          <Progress
            value={clampedPercent}
            className={cn('h-2', slaBarClass(clampedPercent, sla.isOverdue))}
          />

          <div className="flex items-center gap-1.5 text-xs">
            {sla.isOverdue ? (
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <span
              className={cn(
                sla.isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground',
              )}
            >
              {formatRemainingTime(sla.remainingMs, sla.isOverdue)}
            </span>
          </div>
        </div>

        {/* Assigned at */}
        <div className="pt-1 border-t text-xs text-muted-foreground">
          Phân công lúc:{' '}
          <span className="text-foreground">
            {formatDate(assignment.assignedAt, 'dd/MM/yyyy HH:mm')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Internal helper (shared colour coding) ───────────────────────────────────

function getDeptBadgeClass(dept: string): string {
  const map: Record<string, string> = {
    SALES: 'bg-blue-100 text-blue-700 border-blue-200',
    FINANCE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    WAREHOUSE_CN: 'bg-amber-100 text-amber-700 border-amber-200',
    LOGISTICS: 'bg-violet-100 text-violet-700 border-violet-200',
    XNK: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    WAREHOUSE_VN: 'bg-rose-100 text-rose-700 border-rose-200',
    SYSTEM: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return map[dept] ?? 'bg-gray-100 text-gray-700 border-gray-200';
}
