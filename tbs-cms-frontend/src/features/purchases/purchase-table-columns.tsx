'use client';

import { type ColumnDef } from '@tanstack/react-table';
import type { PurchaseRequest } from '@/lib/types/purchase.types';
import type { PurchaseStatus } from '@/lib/types/enums';
import { StatusBadge } from '@/components/shared/status-badge';
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUS_COLORS } from '@/lib/utils/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { Currency } from '@/lib/types';
import { MoreHorizontal, Eye, CheckCircle, ArrowRightCircle } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export const purchaseRequestColumns: ColumnDef<PurchaseRequest>[] = [
  {
    accessorKey: 'code',
    header: 'Mã PR',
    cell: ({ row }) => (
      <Link
        href={`/mua-hang/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    accessorKey: 'vendorId',
    header: 'Nhà cung cấp',
    cell: ({ row }) => (
      <span>{row.original.vendor?.name || row.original.vendorId}</span>
    ),
  },
  {
    accessorKey: 'totalAmount',
    header: 'Tổng tiền',
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.original.totalAmount, row.original.currency as Currency)}
      </span>
    ),
  },
  {
    accessorKey: 'currency',
    header: 'Tiền tệ',
    cell: ({ row }) => <span>{row.original.currency}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => {
      const status = row.original.status as PurchaseStatus;
      return (
        <StatusBadge
          label={PURCHASE_STATUS_LABELS[status] || status}
          colorClass={PURCHASE_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    accessorKey: 'createdBy',
    header: 'Người tạo',
    cell: ({ row }) => (
      <span>{row.original.createdByUser?.fullName || row.original.createdBy}</span>
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
            href={`/mua-hang/${row.original.id}`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Eye className="h-4 w-4" /> Xem chi tiết
          </Link>
          <button
            onClick={() => toast.info('Tính năng đang phát triển')}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <CheckCircle className="h-4 w-4" /> Duyệt
          </button>
          <button
            onClick={() => toast.info('Tính năng đang phát triển')}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <ArrowRightCircle className="h-4 w-4" /> Chuyển PO
          </button>
        </div>
      </div>
    ),
  },
];

export const purchaseOrderColumns: ColumnDef<PurchaseRequest>[] = [
  {
    accessorKey: 'code',
    header: 'Mã PO',
    cell: ({ row }) => (
      <Link
        href={`/mua-hang/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    accessorKey: 'vendorId',
    header: 'Nhà cung cấp',
    cell: ({ row }) => (
      <span>{row.original.vendor?.name || row.original.vendorId}</span>
    ),
  },
  {
    accessorKey: 'totalAmount',
    header: 'Tổng tiền',
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.original.totalAmount, row.original.currency as Currency)}
      </span>
    ),
  },
  {
    accessorKey: 'currency',
    header: 'Tiền tệ',
    cell: ({ row }) => <span>{row.original.currency}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => {
      const status = row.original.status as PurchaseStatus;
      return (
        <StatusBadge
          label={PURCHASE_STATUS_LABELS[status] || status}
          colorClass={PURCHASE_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    accessorKey: 'createdBy',
    header: 'Người tạo',
    cell: ({ row }) => (
      <span>{row.original.createdByUser?.fullName || row.original.createdBy}</span>
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
            href={`/mua-hang/${row.original.id}`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Eye className="h-4 w-4" /> Xem chi tiết
          </Link>
        </div>
      </div>
    ),
  },
];
