'use client';

import { type ColumnDef } from '@tanstack/react-table';
import type { Driver, DriverStatus, Branch } from '@/lib/types';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  DRIVER_STATUS_LABELS,
  DRIVER_STATUS_COLORS,
  BRANCH_LABELS,
} from '@/lib/utils/constants';
import { MoreHorizontal, Eye, Pencil } from 'lucide-react';
import Link from 'next/link';

export const driverColumns: ColumnDef<Driver>[] = [
  {
    accessorKey: 'fullName',
    header: 'Họ tên',
    cell: ({ row }) => (
      <Link
        href={`/tai-xe/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.fullName}
      </Link>
    ),
  },
  {
    accessorKey: 'phone',
    header: 'SĐT',
    cell: ({ row }) => <span>{row.original.phone}</span>,
  },
  {
    accessorKey: 'licenseNumber',
    header: 'Số GPLX',
    cell: ({ row }) => <span>{row.original.licenseNumber || '---'}</span>,
  },
  {
    accessorKey: 'branch',
    header: 'Chi nhánh',
    cell: ({ row }) => (
      <StatusBadge
        label={BRANCH_LABELS[row.original.branch as Branch] || row.original.branch}
        colorClass="bg-blue-50 text-blue-700"
      />
    ),
  },
  {
    accessorKey: 'vehicleId',
    header: 'Xe',
    cell: ({ row }) => (
      <span className={row.original.vehicleId ? 'text-primary' : 'text-muted-foreground'}>
        {row.original.vehicleId || 'Chưa gán'}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => {
      const status = row.original.status as DriverStatus;
      return (
        <StatusBadge
          label={DRIVER_STATUS_LABELS[status] || status}
          colorClass={DRIVER_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
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
            href={`/tai-xe/${row.original.id}`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Eye className="h-4 w-4" /> Xem
          </Link>
          <Link
            href={`/tai-xe/${row.original.id}?edit=true`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Pencil className="h-4 w-4" /> Sửa
          </Link>
        </div>
      </div>
    ),
  },
];
