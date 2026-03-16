'use client';

import { useState, useCallback } from 'react';
import { Plus, Search, AlertTriangle, CheckSquare, Square, UserCheck, Mail, ListTodo } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { customerColumns } from '@/features/customers/customer-table-columns';
import { useCustomers, useChurnRiskList } from '@/lib/hooks/use-customers';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { CustomerTier, Branch } from '@/lib/types/enums';
import type { CustomerQueryParams } from '@/lib/types';
import type { ChurnRiskEntry } from '@/lib/types/customer.types';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';
import { ErrorState } from '@/components/shared/error-state';

// ---------------------------------------------------------------------------
// Churn risk badge
// ---------------------------------------------------------------------------

const RISK_BADGE: Record<ChurnRiskEntry['churnRisk'], { label: string; className: string }> = {
  LOW:      { label: 'Thấp',       className: 'bg-green-100 text-green-700' },
  MEDIUM:   { label: 'Trung bình', className: 'bg-yellow-100 text-yellow-700' },
  HIGH:     { label: 'Cao',        className: 'bg-orange-100 text-orange-700' },
  CRITICAL: { label: 'Nguy hiểm', className: 'bg-red-100 text-red-700' },
};

// ---------------------------------------------------------------------------
// Churn risk tab
// ---------------------------------------------------------------------------

function ChurnRiskTab() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const { data, isLoading } = useChurnRiskList(page, limit);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const entries = (data?.data ?? []).filter(
    (e) => e.churnRisk === 'HIGH' || e.churnRisk === 'CRITICAL',
  );

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === entries.length
        ? new Set()
        : new Set(entries.map((e) => e.customerId)),
    );
  }, [entries]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleBulkAction = useCallback(
    (action: 'assign' | 'email' | 'task') => {
      if (selected.size === 0) {
        toast.warning('Chưa chọn khách hàng nào');
        return;
      }
      const count = selected.size;
      const labels: Record<typeof action, string> = {
        assign: `Giao ${count} KH cho Sale`,
        email: `Gửi email khuyến mãi tới ${count} KH`,
        task: `Tạo task chăm sóc cho ${count} KH`,
      };
      toast.info(labels[action] + ' — tính năng đang phát triển');
    },
    [selected],
  );

  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk action toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">
          {selected.size > 0
            ? `Đã chọn ${selected.size} khách hàng`
            : 'Chọn khách hàng để thực hiện hành động hàng loạt'}
        </span>
        <div className="flex gap-2 ml-auto flex-wrap">
          <button
            type="button"
            onClick={() => handleBulkAction('assign')}
            disabled={selected.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
          >
            <UserCheck className="h-4 w-4" />
            Giao cho Sale
          </button>
          <button
            type="button"
            onClick={() => handleBulkAction('email')}
            disabled={selected.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
          >
            <Mail className="h-4 w-4" />
            Gửi email khuyến mãi
          </button>
          <button
            type="button"
            onClick={() => handleBulkAction('task')}
            disabled={selected.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <ListTodo className="h-4 w-4" />
            Tạo task chăm sóc
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-8 w-8 opacity-30" />
          <p>Không có khách hàng có nguy cơ rời bỏ cao</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 w-10">
                  <button type="button" onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                    {selected.size === entries.length && entries.length > 0 ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-2.5 text-left font-medium">Mã KH</th>
                <th className="px-4 py-2.5 text-left font-medium">Tên khách hàng</th>
                <th className="px-4 py-2.5 text-center font-medium">Nguy cơ</th>
                <th className="px-4 py-2.5 text-right font-medium">Ngày mua cuối</th>
                <th className="px-4 py-2.5 text-right font-medium">CLV</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.customerId}
                  className={cn(
                    'border-b last:border-0 hover:bg-muted/30 transition-colors',
                    selected.has(entry.customerId) && 'bg-primary/5',
                  )}
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleOne(entry.customerId)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {selected.has(entry.customerId) ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      href={`/khach-hang/${entry.customerId}`}
                      className="text-primary hover:underline"
                    >
                      {entry.customerCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">{entry.customerName}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        RISK_BADGE[entry.churnRisk].className,
                      )}
                    >
                      {RISK_BADGE[entry.churnRisk].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {entry.daysSinceLastOrder != null
                      ? `${entry.daysSinceLastOrder} ngày trước`
                      : 'Chưa mua'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatCurrency(entry.clv)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {(data?.meta?.totalPages ?? 1) > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-40 hover:bg-muted transition-colors"
          >
            Trước
          </button>
          <span className="px-3 py-1.5 text-sm text-muted-foreground">
            {page} / {data?.meta?.totalPages}
          </span>
          <button
            type="button"
            disabled={page === data?.meta?.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-40 hover:bg-muted transition-colors"
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function KhachHangPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'churn'>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 500);
  const [tier, setTier] = useState<CustomerTier | undefined>();
  const [branch, setBranch] = useState<Branch | undefined>();
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const params: CustomerQueryParams = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    tier,
    branch,
    isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
  };
  const { data, isLoading, error, refetch } = useCustomers(params);

  if (error) {
    return <ErrorState error={error as Error} onRetry={() => void refetch()} />;
  }

  return (
    <div>
      <PageHeader title="Khách hàng" description="Quản lý khách hàng" infoKey="khach-hang">
        <Link
          href="/khach-hang/tao-moi"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Thêm khách hàng
        </Link>
      </PageHeader>

      {/* Top-level tabs */}
      <div className="flex gap-1 rounded-lg border bg-background p-1 w-fit mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors',
            activeTab === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          Tất cả khách hàng
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('churn')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            activeTab === 'churn'
              ? 'bg-destructive text-destructive-foreground'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Nguy cơ rời bỏ
        </button>
      </div>

      {activeTab === 'churn' ? (
        <ChurnRiskTab />
      ) : (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <label htmlFor="customer-search" className="sr-only">Tìm kiếm khách hàng</label>
            <input
              id="customer-search"
              type="text"
              placeholder="Tìm theo tên, SĐT, mã KH..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={tier || ''}
              onChange={(e) => { setTier(e.target.value as CustomerTier || undefined); setPage(1); }}
              className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Tất cả hạng KH</option>
              <option value={CustomerTier.NEW}>Mới</option>
              <option value={CustomerTier.REGULAR}>Thường</option>
              <option value={CustomerTier.VIP}>VIP</option>
              <option value={CustomerTier.STRATEGIC}>Chiến lược</option>
            </select>

            <select
              value={branch || ''}
              onChange={(e) => { setBranch(e.target.value as Branch || undefined); setPage(1); }}
              className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Tất cả chi nhánh</option>
              <option value={Branch.HN}>Hà Nội</option>
              <option value={Branch.HCM}>Hồ Chí Minh</option>
            </select>

            <div className="flex items-center gap-2 rounded-md border bg-background">
              {(['all', 'active', 'inactive'] as const).map((f, i) => (
                <button
                  key={f}
                  onClick={() => { setActiveFilter(f); setPage(1); }}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium transition-colors',
                    i === 0 && 'rounded-l-md',
                    i === 2 && 'rounded-r-md',
                    activeFilter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f === 'all' ? 'Tất cả' : f === 'active' ? 'Hoạt động' : 'Ngừng'}
                </button>
              ))}
            </div>

            {(tier || branch || activeFilter !== 'all') && (
              <button
                onClick={() => {
                  setTier(undefined);
                  setBranch(undefined);
                  setActiveFilter('all');
                  setPage(1);
                }}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>

          <DataTable
            columns={customerColumns}
            data={data?.data ?? []}
            pageCount={data?.meta?.totalPages}
            page={page}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}
