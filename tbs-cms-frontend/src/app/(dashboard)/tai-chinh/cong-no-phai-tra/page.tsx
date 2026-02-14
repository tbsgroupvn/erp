'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { usePayables } from '@/lib/hooks/use-finance';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { ColumnDef } from '@tanstack/react-table';
import type { AccountPayable } from '@/lib/types';

const AP_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Chưa trả',
  PARTIAL: 'Trả một phần',
  PAID: 'Đã trả',
  OVERDUE: 'Quá hạn',
  NETTED: 'Đã bù trừ',
};

const AP_STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  NETTED: 'bg-slate-100 text-slate-700',
};

const apColumns: ColumnDef<AccountPayable>[] = [
  {
    accessorKey: 'code',
    header: 'Mã',
    cell: ({ row }) => <span className="font-medium">{row.original.code}</span>,
  },
  {
    accessorKey: 'vendorName',
    header: 'Nhà cung cấp',
  },
  {
    accessorKey: 'amount',
    header: 'Số tiền',
    cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.amount)}</span>,
  },
  {
    accessorKey: 'paidAmount',
    header: 'Đã trả',
    cell: ({ row }) => <span>{formatCurrency(row.original.paidAmount)}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => (
      <StatusBadge
        label={AP_STATUS_LABELS[row.original.status] || row.original.status}
        colorClass={AP_STATUS_COLORS[row.original.status] || 'bg-gray-100 text-gray-700'}
      />
    ),
  },
  {
    accessorKey: 'dueDate',
    header: 'Hạn trả',
    cell: ({ row }) => <span>{formatDate(row.original.dueDate)}</span>,
  },
];

export default function CongNoPhaiTraPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePayables({ page, limit: 20 });

  return (
    <div>
      <PageHeader title="Công nợ phải trả" description="Quản lý công nợ phải trả cho nhà cung cấp" />
      <DataTable
        columns={apColumns}
        data={data?.data ?? []}
        pageCount={data?.meta?.totalPages}
        page={page}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </div>
  );
}
