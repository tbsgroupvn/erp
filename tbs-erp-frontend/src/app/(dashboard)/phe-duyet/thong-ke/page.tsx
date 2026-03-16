'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListChecks,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverviewData {
  totalApprovals: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  approvalRate: number;
  avgDurationMs: number;
  slaBreachRate: number;
}

interface TypeBreakdownItem {
  type: string;
  total: number;
  approvedCount: number;
  rejectedCount: number;
  avgDurationMs: number;
}

interface BottleneckItem {
  role: string;
  count: number;
  avgDurationMs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDefaultDates(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const dateTo = now.toISOString().slice(0, 10);
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  const dateFrom = from.toISOString().slice(0, 10);
  return { dateFrom, dateTo };
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) return `${hours} giờ`;
  const days = Math.round(ms / 86_400_000);
  return `${days} ngày`;
}

const APPROVAL_TYPE_LABELS: Record<string, string> = {
  DISCOUNT: 'Giảm giá',
  PAYMENT: 'Thanh toán',
  CANCEL_ORDER: 'Hủy đơn',
  EXPENSE: 'Chi phí',
  PURCHASE_REQUEST: 'Yêu cầu mua hàng',
  LEAVE_REQUEST: 'Nghỉ phép',
  CONTRACT: 'Hợp đồng',
  INVOICE: 'Hóa đơn',
  QUOTATION: 'Báo giá',
  CREDIT_LIMIT: 'Hạn mức tín dụng',
  GRACE_PERIOD: 'Gia hạn công nợ',
  WALLET_TOPUP: 'Nạp ví',
};

const ROLE_LABELS: Record<string, string> = {
  CEO: 'CEO',
  COO: 'COO',
  CFO: 'CFO',
  DIRECTOR_OPERATIONS: 'GĐ Vận hành',
  SALES_DIRECTOR: 'GĐ Kinh doanh',
  SALES_LEADER: 'Trưởng nhóm KD',
  SALE: 'Sale',
  MARKETING_STAFF: 'Marketing',
  CSKH: 'CSKH',
  CHIEF_ACCOUNTANT: 'Kế toán trưởng',
  ACCOUNTANT: 'Kế toán',
  ACCOUNTANT_AR: 'Kế toán công nợ',
  ACCOUNTANT_COST: 'Kế toán chi phí',
  HR_MANAGER: 'Trưởng phòng HR',
  LOGISTICS_MANAGER: 'Trưởng phòng Logistics',
  XNK_MANAGER: 'Trưởng phòng XNK',
  XNK_STAFF: 'Nhân viên XNK',
  WAREHOUSE_MANAGER: 'Quản lý kho',
  WAREHOUSE_CN_AGENT: 'Nhân viên kho TQ',
  WAREHOUSE_VN_MANAGER: 'Quản lý kho VN',
  WAREHOUSE_VN_STAFF: 'Nhân viên kho VN',
  DRIVER: 'Tài xế',
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

function typeLabel(type: string): string {
  return APPROVAL_TYPE_LABELS[type] ?? type;
}

// ---------------------------------------------------------------------------
// API fetchers
// ---------------------------------------------------------------------------

function fetchOverview(dateFrom: string, dateTo: string) {
  return apiClient
    .get<{ data: OverviewData }>('/approvals/analytics/overview', {
      params: { dateFrom, dateTo },
    })
    .then((r) => r.data.data);
}

function fetchTypeBreakdown(dateFrom: string, dateTo: string) {
  return apiClient
    .get<{ data: TypeBreakdownItem[] }>('/approvals/analytics/type-breakdown', {
      params: { dateFrom, dateTo },
    })
    .then((r) => r.data.data);
}

function fetchBottlenecks(dateFrom: string, dateTo: string) {
  return apiClient
    .get<{ data: BottleneckItem[] }>('/approvals/analytics/bottlenecks', {
      params: { dateFrom, dateTo },
    })
    .then((r) => r.data.data);
}

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <div className="h-4 rounded bg-muted animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Inline bar (visual percentage fill for type breakdown)
// ---------------------------------------------------------------------------

function InlineBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/60 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-6 text-right">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PheDuyetThongKePage() {
  const defaults = getDefaultDates();
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);

  // Committed dates — only update when user clicks "Xem"
  const [committed, setCommitted] = useState(defaults);

  const overviewQuery = useQuery({
    queryKey: ['approval-analytics-overview', committed.dateFrom, committed.dateTo],
    queryFn: () => fetchOverview(committed.dateFrom, committed.dateTo),
  });

  const typeQuery = useQuery({
    queryKey: ['approval-analytics-type', committed.dateFrom, committed.dateTo],
    queryFn: () => fetchTypeBreakdown(committed.dateFrom, committed.dateTo),
  });

  const bottleneckQuery = useQuery({
    queryKey: ['approval-analytics-bottlenecks', committed.dateFrom, committed.dateTo],
    queryFn: () => fetchBottlenecks(committed.dateFrom, committed.dateTo),
  });

  const overview = overviewQuery.data;
  const typeBreakdown = typeQuery.data ?? [];
  const bottlenecks = [...(bottleneckQuery.data ?? [])].sort((a, b) => b.count - a.count);

  const maxTotal = typeBreakdown.reduce((m, t) => Math.max(m, t.total), 0);

  const approvalRateValue = overview?.approvalRate ?? 0;
  const slaBreachValue = overview?.slaBreachRate ?? 0;

  function handleView() {
    setCommitted({ dateFrom, dateTo });
  }

  const isLoading =
    overviewQuery.isLoading || typeQuery.isLoading || bottleneckQuery.isLoading;

  return (
    <div>
      <PageHeader
        title="Thống kê phê duyệt"
        description="Phân tích hiệu suất phê duyệt theo khoảng thời gian"
      />

      {/* ------------------------------------------------------------------ */}
      {/* Date filter                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="dateFrom">Từ ngày</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dateTo">Đến ngày</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-44"
              />
            </div>
            <Button onClick={handleView} disabled={isLoading}>
              {isLoading ? 'Đang tải...' : 'Xem'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Stats cards                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          title="Tổng phê duyệt"
          value={overview ? overview.totalApprovals : '—'}
          icon={ListChecks}
          variant="blue"
          description={
            overview
              ? `${overview.approvedCount} duyệt · ${overview.rejectedCount} từ chối · ${overview.pendingCount} chờ`
              : undefined
          }
        />

        <StatCard
          title="Tỷ lệ duyệt"
          value={overview ? `${approvalRateValue.toFixed(1)}%` : '—'}
          icon={CheckCircle2}
          variant="emerald"
          description={
            overview
              ? approvalRateValue >= 80
                ? 'Tốt'
                : approvalRateValue >= 60
                ? 'Trung bình'
                : 'Cần cải thiện'
              : undefined
          }
        />

        <StatCard
          title="Thời gian TB"
          value={overview ? formatDuration(overview.avgDurationMs) : '—'}
          icon={Clock}
          variant="amber"
          description="Thời gian xử lý trung bình mỗi yêu cầu"
        />

        <StatCard
          title="Vi phạm SLA"
          value={overview ? `${slaBreachValue.toFixed(1)}%` : '—'}
          icon={AlertTriangle}
          variant="rose"
          description={
            overview
              ? slaBreachValue <= 5
                ? 'Trong ngưỡng'
                : slaBreachValue <= 15
                ? 'Cần chú ý'
                : 'Vượt ngưỡng'
              : undefined
          }
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Two-column section: Type breakdown + Bottlenecks                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Type breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Phân tích theo loại</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Loại</th>
                    <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Tổng</th>
                    <th className="py-2.5 px-4 font-medium text-muted-foreground min-w-[120px]">Đã duyệt</th>
                    <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Từ chối</th>
                    <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">TG TB</th>
                  </tr>
                </thead>
                <tbody>
                  {typeQuery.isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                  ) : typeBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-muted-foreground">
                        Không có dữ liệu
                      </td>
                    </tr>
                  ) : (
                    typeBreakdown.map((item) => (
                      <tr
                        key={item.type}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-4 font-medium">{typeLabel(item.type)}</td>
                        <td className="py-3 px-4 text-right tabular-nums">{item.total}</td>
                        <td className="py-3 px-4">
                          <InlineBar value={item.approvedCount} max={maxTotal} />
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-rose-600">
                          {item.rejectedCount > 0 ? item.rejectedCount : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                          {formatDuration(item.avgDurationMs)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Bottleneck analysis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Phân tích điểm nghẽn</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Vai trò</th>
                    <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Số lần chậm</th>
                    <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">TG xử lý TB</th>
                  </tr>
                </thead>
                <tbody>
                  {bottleneckQuery.isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={3} />)
                  ) : bottlenecks.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-10 text-center text-muted-foreground">
                        Không có dữ liệu
                      </td>
                    </tr>
                  ) : (
                    bottlenecks.map((item, idx) => {
                      const isTop = idx === 0 && item.count > 0;
                      return (
                        <tr
                          key={item.role}
                          className={cn(
                            'border-b last:border-0 hover:bg-muted/30 transition-colors',
                            isTop && 'bg-rose-50/50 dark:bg-rose-950/20',
                          )}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {isTop && (
                                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold">
                                  !
                                </span>
                              )}
                              <span className={cn('font-medium', isTop && 'text-rose-700 dark:text-rose-400')}>
                                {roleLabel(item.role)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            <span
                              className={cn(
                                'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold',
                                item.count >= 10
                                  ? 'bg-rose-100 text-rose-700'
                                  : item.count >= 5
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {item.count}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                            {formatDuration(item.avgDurationMs)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
