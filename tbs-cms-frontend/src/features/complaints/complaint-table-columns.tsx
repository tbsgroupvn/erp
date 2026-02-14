'use client';

import { type ColumnDef } from '@tanstack/react-table';
import type { Complaint, ComplaintType, ComplaintSeverity, ComplaintStatus } from '@/lib/types';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  COMPLAINT_TYPE_LABELS,
  COMPLAINT_SEVERITY_LABELS,
  COMPLAINT_SEVERITY_COLORS,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_COLORS,
} from '@/lib/utils/constants';
import { formatDate } from '@/lib/utils/format';
import { MoreHorizontal, Eye, Pencil } from 'lucide-react';
import Link from 'next/link';

export const complaintColumns: ColumnDef<Complaint>[] = [
  {
    accessorKey: 'code',
    header: 'Mã',
    cell: ({ row }) => (
      <Link
        href={`/khieu-nai/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    accessorKey: 'customer.fullName',
    header: 'Khách hàng',
    cell: ({ row }) => (
      <span>{row.original.customer?.fullName ?? '---'}</span>
    ),
  },
  {
    accessorKey: 'type',
    header: 'Loại',
    cell: ({ row }) => {
      const type = row.original.type as ComplaintType;
      return (
        <StatusBadge
          label={COMPLAINT_TYPE_LABELS[type] || type}
          colorClass="bg-slate-100 text-slate-700"
        />
      );
    },
  },
  {
    accessorKey: 'severity',
    header: 'Mức độ',
    cell: ({ row }) => {
      const severity = row.original.severity as ComplaintSeverity;
      return (
        <StatusBadge
          label={COMPLAINT_SEVERITY_LABELS[severity] || severity}
          colorClass={COMPLAINT_SEVERITY_COLORS[severity] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => {
      const status = row.original.status as ComplaintStatus;
      return (
        <StatusBadge
          label={COMPLAINT_STATUS_LABELS[status] || status}
          colorClass={COMPLAINT_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    accessorKey: 'handler.fullName',
    header: 'Người xử lý',
    cell: ({ row }) => (
      <span>{row.original.handler?.fullName ?? '---'}</span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Ngày tạo',
    cell: ({ row }) => <span>{formatDate(row.original.createdAt)}</span>,
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <div className="relative group">
        <button className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
          <MoreHorizontal className="h-4 w-4" />
        </button>
        <div className="absolute right-0 top-full z-10 hidden w-48 rounded-md border bg-popover p-1 shadow-md group-hover:block">
          <Link
            href={`/khieu-nai/${row.original.id}`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Eye className="h-4 w-4" /> Xem
          </Link>
          <Link
            href={`/khieu-nai/${row.original.id}?edit=true`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Pencil className="h-4 w-4" /> Sửa
          </Link>
        </div>
      </div>
    ),
  },
];
