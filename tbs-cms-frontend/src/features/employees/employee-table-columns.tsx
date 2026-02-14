'use client';

import { type ColumnDef } from '@tanstack/react-table';
import type { Employee, EmployeeStatus } from '@/lib/types';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUS_COLORS,
  BRANCH_LABELS,
} from '@/lib/utils/constants';
import { MoreHorizontal, Eye, Pencil } from 'lucide-react';
import Link from 'next/link';
import type { Branch } from '@/lib/types';

export const employeeColumns: ColumnDef<Employee>[] = [
  {
    accessorKey: 'code',
    header: 'Mã NV',
    cell: ({ row }) => (
      <Link
        href={`/nhan-su/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    accessorKey: 'fullName',
    header: 'Họ tên',
    cell: ({ row }) => <span>{row.original.fullName}</span>,
  },
  {
    accessorKey: 'departmentCode',
    header: 'Phòng ban',
    cell: ({ row }) => <span>{row.original.departmentCode}</span>,
  },
  {
    accessorKey: 'positionTitle',
    header: 'Chức vụ',
    cell: ({ row }) => <span>{row.original.positionTitle}</span>,
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
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => {
      const status = row.original.status as EmployeeStatus;
      return (
        <StatusBadge
          label={EMPLOYEE_STATUS_LABELS[status] || status}
          colorClass={EMPLOYEE_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    accessorKey: 'phone',
    header: 'SĐT',
    cell: ({ row }) => <span>{row.original.phone || '---'}</span>,
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
            href={`/nhan-su/${row.original.id}`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Eye className="h-4 w-4" /> Xem
          </Link>
          <Link
            href={`/nhan-su/${row.original.id}?edit=true`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Pencil className="h-4 w-4" /> Sửa
          </Link>
        </div>
      </div>
    ),
  },
];
