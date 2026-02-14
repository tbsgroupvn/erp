'use client';

import { type ColumnDef } from '@tanstack/react-table';
import type { Customer, CustomerTier } from '@/lib/types';
import { StatusBadge } from '@/components/shared/status-badge';
import { CUSTOMER_TIER_LABELS, CUSTOMER_TIER_COLORS, BRANCH_LABELS } from '@/lib/utils/constants';
import { formatCurrency } from '@/lib/utils/format';
import { MoreHorizontal, Eye, Pencil } from 'lucide-react';
import Link from 'next/link';

export const customerColumns: ColumnDef<Customer>[] = [
  {
    accessorKey: 'code',
    header: 'Mã KH',
    cell: ({ row }) => (
      <Link
        href={`/khach-hang/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    accessorKey: 'fullName',
    header: 'Họ tên',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.fullName}</p>
        {row.original.companyName && (
          <p className="text-xs text-muted-foreground">{row.original.companyName}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'phone',
    header: 'SĐT',
  },
  {
    accessorKey: 'tier',
    header: 'Hạng',
    cell: ({ row }) => {
      const tier = row.original.tier as CustomerTier;
      return (
        <StatusBadge
          label={CUSTOMER_TIER_LABELS[tier] || tier}
          colorClass={CUSTOMER_TIER_COLORS[tier] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    accessorKey: 'currentDebt',
    header: 'Công nợ',
    cell: ({ row }) => (
      <span className={row.original.currentDebt > 0 ? 'text-red-600 font-medium' : ''}>
        {formatCurrency(row.original.currentDebt)}
      </span>
    ),
  },
  {
    accessorKey: 'totalRevenue',
    header: 'Doanh thu',
    cell: ({ row }) => (
      <span className="font-medium">{formatCurrency(row.original.totalRevenue)}</span>
    ),
  },
  {
    accessorKey: 'branch',
    header: 'Chi nhánh',
    cell: ({ row }) => (
      <span>{row.original.branch ? BRANCH_LABELS[row.original.branch] : '---'}</span>
    ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <div className="relative group">
        <button className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
          <MoreHorizontal className="h-4 w-4" />
        </button>
        <div className="absolute right-0 top-full z-10 hidden w-40 rounded-md border bg-popover p-1 shadow-md group-hover:block">
          <Link
            href={`/khach-hang/${row.original.id}`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Eye className="h-4 w-4" /> Xem
          </Link>
          <Link
            href={`/khach-hang/${row.original.id}?edit=true`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Pencil className="h-4 w-4" /> Sửa
          </Link>
        </div>
      </div>
    ),
  },
];
