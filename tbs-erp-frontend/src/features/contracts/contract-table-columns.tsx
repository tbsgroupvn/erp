'use client';

import { type ColumnDef } from '@tanstack/react-table';
import type { Contract, ContractStatus, ContractType } from '@/lib/types';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  CONTRACT_TYPE_LABELS,
  CONTRACT_TYPE_COLORS,
} from '@/lib/utils/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';

function ContractActions({ row }: { row: Contract }) {
  return (
    <div className="relative group">
      <button className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <div className="absolute right-0 top-full z-10 hidden w-44 rounded-md border bg-popover p-1 shadow-md group-hover:block">
        <Link
          href={`/hop-dong/${row.id}`}
          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          <Eye className="h-4 w-4" /> Xem chi tiết
        </Link>
        {row.status === 'DRAFT' && (
          <>
            <Link
              href={`/hop-dong/${row.id}?edit=true`}
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Pencil className="h-4 w-4" /> Sửa
            </Link>
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
            >
              <Trash2 className="h-4 w-4" /> Xóa
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export const contractColumns: ColumnDef<Contract>[] = [
  {
    accessorKey: 'code',
    header: 'Mã HĐ',
    cell: ({ row }) => (
      <Link
        href={`/hop-dong/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    accessorKey: 'title',
    header: 'Tiêu đề',
    cell: ({ row }) => (
      <span className="max-w-[200px] truncate block">{row.original.title}</span>
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
      const type = row.original.type as ContractType;
      return (
        <StatusBadge
          label={CONTRACT_TYPE_LABELS[type] || type}
          colorClass={CONTRACT_TYPE_COLORS[type] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    accessorKey: 'totalValue',
    header: 'Giá trị',
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.original.totalValue)}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => {
      const status = row.original.status as ContractStatus;
      return (
        <StatusBadge
          label={CONTRACT_STATUS_LABELS[status] || status}
          colorClass={CONTRACT_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Ngày tạo',
    cell: ({ row }) => <span>{formatDate(row.original.createdAt)}</span>,
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => <ContractActions row={row.original} />,
  },
];
