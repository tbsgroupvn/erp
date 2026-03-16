'use client';

import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { complaintColumns } from '@/features/complaints/complaint-table-columns';
import { useComplaints, useComplaintStatistics } from '@/lib/hooks/use-complaints';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { ComplaintStatus, ComplaintSeverity, ComplaintType } from '@/lib/types';
import { COMPLAINT_STATUS_LABELS, COMPLAINT_SEVERITY_LABELS, COMPLAINT_TYPE_LABELS } from '@/lib/utils/constants';
import type { ComplaintQueryParams } from '@/lib/types';

export default function KhieuNaiPage() {
  const [filters, setFilters] = useState<ComplaintQueryParams>({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  // Debounce search to avoid excessive API calls
  const debouncedSearch = useDebouncedValue(search, 500);

  const { data, isLoading } = useComplaints({
    ...filters,
    search: debouncedSearch || undefined,
    page,
    limit: 20,
  });
  const { data: stats } = useComplaintStatistics();

  const statistics = stats as any;

  return (
    <div>
      <PageHeader title="Khiếu nại" description="Quản lý khiếu nại" infoKey="khieu-nai">
        <Link
          href="/khieu-nai/tao-moi"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tạo khiếu nại
        </Link>
      </PageHeader>

      {/* Stats Cards */}
      {statistics && (
        <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Tổng</p>
            <p className="text-2xl font-bold">{statistics.total ?? 0}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Đang mở</p>
            <p className="text-2xl font-bold text-blue-600">{statistics.byStatus?.OPEN ?? 0}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Đang xử lý</p>
            <p className="text-2xl font-bold text-yellow-600">{statistics.byStatus?.INVESTIGATING ?? 0}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Đã giải quyết</p>
            <p className="text-2xl font-bold text-green-600">{statistics.byStatus?.RESOLVED ?? 0}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm theo mã, tên khách hàng, nội dung..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filters.status || ''}
            onChange={(e) => {
              const val = e.target.value ? (e.target.value as ComplaintStatus) : undefined;
              setFilters((prev) => ({ ...prev, status: val }));
              setPage(1);
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(COMPLAINT_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={filters.severity || ''}
            onChange={(e) => {
              const val = e.target.value ? (e.target.value as ComplaintSeverity) : undefined;
              setFilters((prev) => ({ ...prev, severity: val }));
              setPage(1);
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Tất cả mức độ</option>
            {Object.entries(COMPLAINT_SEVERITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={filters.type || ''}
            onChange={(e) => {
              const val = e.target.value ? (e.target.value as ComplaintType) : undefined;
              setFilters((prev) => ({ ...prev, type: val }));
              setPage(1);
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Tất cả loại</option>
            {Object.entries(COMPLAINT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <DataTable
          columns={complaintColumns}
          data={data?.data ?? []}
          pageCount={data?.meta?.totalPages}
          page={page}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
