'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/utils/format';
import type { ColumnDef } from '@tanstack/react-table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QCInspection {
  id: string;
  packageCode: string;
  orderId: string;
  status: string;
  note: string | null;
  inspectedAt: string | null;
}

interface QCInspectionsResponse {
  data: QCInspection[];
  meta?: { totalPages?: number };
}

// ---------------------------------------------------------------------------
// Status maps
// ---------------------------------------------------------------------------

const QC_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ kiểm',
  PASSED: 'Đạt',
  FAILED: 'Không đạt',
  REWORK: 'Làm lại',
};

const QC_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PASSED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  REWORK: 'bg-orange-100 text-orange-700',
};

const ALL_QC_STATUSES = ['PENDING', 'PASSED', 'FAILED', 'REWORK'] as const;

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

const columns: ColumnDef<QCInspection>[] = [
  {
    accessorKey: 'packageCode',
    header: 'Mã kiện',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.packageCode}</span>
    ),
  },
  {
    accessorKey: 'orderId',
    header: 'Đơn hàng',
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái QC',
    cell: ({ row }) => {
      const status = row.original.status || '';
      return (
        <StatusBadge
          label={QC_STATUS_LABELS[status] || status || '---'}
          colorClass={QC_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    accessorKey: 'note',
    header: 'Ghi chú',
    cell: ({ row }) => (
      <span className="max-w-[250px] truncate block">
        {row.original.note || '---'}
      </span>
    ),
  },
  {
    accessorKey: 'inspectedAt',
    header: 'Ngày kiểm tra',
    cell: ({ row }) => (
      <span>
        {row.original.inspectedAt ? formatDate(row.original.inspectedAt) : '---'}
      </span>
    ),
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function KiemTraChatLuongPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery<QCInspectionsResponse>({
    queryKey: ['qc-inspections', page, statusFilter],
    queryFn: () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      return apiClient.get('/qc/inspections', { params }).then((r) => r.data);
    },
  });

  return (
    <div>
      <PageHeader
        title="Kiểm tra chất lượng"
        description="Quản lý kiểm tra chất lượng kiện hàng"
        infoKey="kiem-tra-chat-luong"
      />

      {/* Status filter */}
      <div className="mb-4 flex items-center gap-2">
        <Label htmlFor="qc-status-filter" className="whitespace-nowrap">
          Trạng thái:
        </Label>
        <select
          id="qc-status-filter"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">Tất cả</option>
          {ALL_QC_STATUSES.map((s) => (
            <option key={s} value={s}>
              {QC_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        pageCount={data?.meta?.totalPages}
        page={page}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </div>
  );
}
