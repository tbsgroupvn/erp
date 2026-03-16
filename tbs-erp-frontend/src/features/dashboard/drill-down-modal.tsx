'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useDrillDown } from '@/lib/hooks/use-dashboard';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type {
  DrillDownOrderRow,
  DrillDownARRow,
  DrillDownContainerRow,
  DrillDownCustomerRow,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DrillDownModalProps {
  metric: string;
  title: string;
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Status badge colour helpers
// ---------------------------------------------------------------------------

const ORDER_STATUS_COLOURS: Record<string, string> = {
  COMPLETED:      'bg-green-100 text-green-700',
  DELIVERING:     'bg-blue-100 text-blue-700',
  IN_TRANSIT:     'bg-violet-100 text-violet-700',
  AT_CUSTOMS:     'bg-amber-100 text-amber-700',
  WAREHOUSE_CN:   'bg-cyan-100 text-cyan-700',
  WAREHOUSE_VN:   'bg-indigo-100 text-indigo-700',
  PENDING_DEPOSIT:'bg-orange-100 text-orange-700',
  CANCELLED:      'bg-red-100 text-red-700',
};

function orderStatusColour(status: string): string {
  return ORDER_STATUS_COLOURS[status] ?? 'bg-muted text-muted-foreground';
}

const TIER_COLOURS: Record<string, string> = {
  PLATINUM: 'bg-violet-100 text-violet-700',
  GOLD:     'bg-amber-100 text-amber-700',
  SILVER:   'bg-slate-100 text-slate-700',
  BRONZE:   'bg-orange-100 text-orange-700',
};

function tierColour(tier: string): string {
  return TIER_COLOURS[tier] ?? 'bg-muted text-muted-foreground';
}

// ---------------------------------------------------------------------------
// Table renderers per metric
// ---------------------------------------------------------------------------

function OrdersTable({ rows }: { rows: DrillDownOrderRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mã đơn</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Trạng thái</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Khách hàng</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Số tiền</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ngày tạo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors">
              <td className="px-3 py-2">
                <Link
                  href={`/don-hang/${row.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {row.code}
                </Link>
              </td>
              <td className="px-3 py-2">
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  orderStatusColour(row.status),
                )}>
                  {row.status}
                </span>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{row.customerName}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                {formatCurrency(row.totalAmount)}
              </td>
              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                {formatDate(row.createdAt, 'dd/MM/yyyy')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ARTable({ rows }: { rows: DrillDownARRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mã AR</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Khách hàng</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Tổng tiền</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Đã thu</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Hạn thanh toán</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isOverdue = row.dueDate && new Date(row.dueDate) < new Date();
            return (
              <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2">
                  <Link
                    href="/tai-chinh/cong-no-phai-thu"
                    className="font-medium text-primary hover:underline"
                  >
                    {row.code}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{row.customerName}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {formatCurrency(row.totalAmount)}
                </td>
                <td className="px-3 py-2 text-right text-emerald-600 font-medium tabular-nums">
                  {formatCurrency(row.paidAmount)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={cn(
                    'text-sm',
                    isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground',
                  )}>
                    {row.dueDate ? formatDate(row.dueDate, 'dd/MM/yyyy') : '--'}
                    {isOverdue && <span className="ml-1 text-xs">(quá hạn)</span>}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ContainersTable({ rows }: { rows: DrillDownContainerRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mã container</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Trạng thái</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tuyến</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Số kiện</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">ETA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors">
              <td className="px-3 py-2">
                <Link
                  href={`/container`}
                  className="font-medium text-primary hover:underline"
                >
                  {row.code}
                </Link>
              </td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700">
                  {row.status}
                </span>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{row.route}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{row.packageCount}</td>
              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                {row.eta ? formatDate(row.eta, 'dd/MM/yyyy') : '--'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomersTable({ rows }: { rows: DrillDownCustomerRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mã KH</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tên khách hàng</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Hạng</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Số đơn</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Doanh thu</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors">
              <td className="px-3 py-2">
                <Link
                  href={`/khach-hang/${row.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {row.code}
                </Link>
              </td>
              <td className="px-3 py-2 font-medium">{row.name}</td>
              <td className="px-3 py-2">
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  tierColour(row.tier),
                )}>
                  {row.tier}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.totalOrders}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                {formatCurrency(row.totalRevenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="space-y-2">
      {/* Header skeleton */}
      <div className="flex gap-2 pb-2 border-b">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: 8 }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-2 py-1">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={colIdx} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column count per metric (for skeleton)
// ---------------------------------------------------------------------------

const METRIC_COL_COUNT: Record<string, number> = {
  total_orders:         5,
  ar_outstanding:       5,
  containers_in_transit: 5,
  active_customers:     5,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DrillDownModal({ metric, title, open, onClose }: DrillDownModalProps) {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isFetching } = useDrillDown(metric, page, limit);

  const totalPages = data ? Math.ceil(data.total / limit) : 1;
  const colCount = METRIC_COL_COUNT[metric] ?? 5;

  // Reset to page 1 when metric changes (modal re-opens)
  // This is handled naturally because `open` gates rendering in Dialog

  function renderTable() {
    if (!data || data.rows.length === 0) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Không có dữ liệu.
        </p>
      );
    }

    switch (metric) {
      case 'total_orders':
        return <OrdersTable rows={data.rows as DrillDownOrderRow[]} />;
      case 'ar_outstanding':
        return <ARTable rows={data.rows as DrillDownARRow[]} />;
      case 'containers_in_transit':
        return <ContainersTable rows={data.rows as DrillDownContainerRow[]} />;
      case 'active_customers':
        return <CustomersTable rows={data.rows as DrillDownCustomerRow[]} />;
      default:
        return (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loại metric chưa được hỗ trợ: {metric}
          </p>
        );
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl w-full max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-3">
            {title}
            {data && (
              <span className="text-sm font-normal text-muted-foreground">
                ({data.total} bản ghi)
              </span>
            )}
            {isFetching && !isLoading && (
              <span className="text-xs font-normal text-muted-foreground animate-pulse">
                Đang cập nhật...
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <TableSkeleton cols={colCount} />
          ) : (
            renderTable()
          )}
        </div>

        {/* Pagination footer */}
        {!isLoading && data && data.total > limit && (
          <div className="px-6 py-3 border-t shrink-0 flex items-center justify-between bg-background">
            <p className="text-sm text-muted-foreground">
              Trang {page} / {totalPages}
              <span className="ml-2 text-xs">({data.total} bản ghi)</span>
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 w-8 p-0"
                aria-label="Trang trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 w-8 p-0"
                aria-label="Trang sau"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
