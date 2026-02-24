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

interface LeaveRequest {
  id: string;
  employeeName: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  days: number;
  status: string;
}

interface LeaveRequestsResponse {
  data: LeaveRequest[];
  meta?: { totalPages?: number };
}

// ---------------------------------------------------------------------------
// Status maps
// ---------------------------------------------------------------------------

const LEAVE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Cho duyet',
  APPROVED: 'Da duyet',
  REJECTED: 'Tu choi',
  CANCELLED: 'Da huy',
};

const LEAVE_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
};

const ALL_LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;

// ---------------------------------------------------------------------------
// Leave type labels
// ---------------------------------------------------------------------------

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'Phep nam',
  SICK: 'Nghi om',
  PERSONAL: 'Viec rieng',
  MATERNITY: 'Thai san',
  OTHER: 'Khac',
};

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

const columns: ColumnDef<LeaveRequest>[] = [
  {
    accessorKey: 'employeeName',
    header: 'Nhan vien',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.employeeName}</span>
    ),
  },
  {
    accessorKey: 'leaveType',
    header: 'Loai nghi',
    cell: ({ row }) => (
      <span>{LEAVE_TYPE_LABELS[row.original.leaveType] || row.original.leaveType}</span>
    ),
  },
  {
    accessorKey: 'fromDate',
    header: 'Tu ngay',
    cell: ({ row }) => (
      <span>
        {row.original.fromDate ? formatDate(row.original.fromDate, 'dd/MM/yyyy') : '---'}
      </span>
    ),
  },
  {
    accessorKey: 'toDate',
    header: 'Den ngay',
    cell: ({ row }) => (
      <span>
        {row.original.toDate ? formatDate(row.original.toDate, 'dd/MM/yyyy') : '---'}
      </span>
    ),
  },
  {
    accessorKey: 'days',
    header: 'So ngay',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.days}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Trang thai',
    cell: ({ row }) => {
      const status = row.original.status || '';
      return (
        <StatusBadge
          label={LEAVE_STATUS_LABELS[status] || status || '---'}
          colorClass={LEAVE_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function NghiPhepPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery<LeaveRequestsResponse>({
    queryKey: ['leave-requests', page, statusFilter],
    queryFn: () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      return apiClient
        .get('/attendance/leave-requests', { params })
        .then((r) => r.data);
    },
  });

  return (
    <div>
      <PageHeader
        title="Quan ly nghi phep"
        description="Theo doi yeu cau nghi phep cua nhan vien"
      />

      {/* Status filter */}
      <div className="mb-4 flex items-center gap-2">
        <Label htmlFor="leave-status-filter" className="whitespace-nowrap">
          Trang thai:
        </Label>
        <select
          id="leave-status-filter"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">Tat ca</option>
          {ALL_LEAVE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAVE_STATUS_LABELS[s]}
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
