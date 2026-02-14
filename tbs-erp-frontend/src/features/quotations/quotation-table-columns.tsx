'use client';

import { type ColumnDef } from '@tanstack/react-table';
import type { Quotation, QuotationStatus, ServiceType } from '@/lib/types';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
} from '@/lib/utils/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { MoreHorizontal, Eye, Pencil, Copy } from 'lucide-react';
import Link from 'next/link';

export const quotationColumns: ColumnDef<Quotation>[] = [
  {
    accessorKey: 'code',
    header: 'Mã BG',
    cell: ({ row }) => (
      <Link
        href={`/bao-gia/${row.original.id}`}
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
    accessorKey: 'serviceType',
    header: 'Loại DV',
    cell: ({ row }) => (
      <StatusBadge
        label={SERVICE_TYPE_LABELS[row.original.serviceType as ServiceType] || row.original.serviceType}
        colorClass="bg-blue-50 text-blue-700"
      />
    ),
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => {
      const status = row.original.status as QuotationStatus;
      return (
        <StatusBadge
          label={QUOTATION_STATUS_LABELS[status] || status}
          colorClass={QUOTATION_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    accessorKey: 'totalAmount',
    header: 'Tổng tiền',
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.original.totalAmount)}
      </span>
    ),
  },
  {
    accessorKey: 'validUntil',
    header: 'Hiệu lực đến',
    cell: ({ row }) => (
      <span>{row.original.validUntil ? formatDate(row.original.validUntil, 'dd/MM/yyyy') : '---'}</span>
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
            href={`/bao-gia/${row.original.id}`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Eye className="h-4 w-4" /> Xem
          </Link>
          <Link
            href={`/bao-gia/${row.original.id}?edit=true`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Pencil className="h-4 w-4" /> Sửa
          </Link>
          <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
            <Copy className="h-4 w-4" /> Sao chép
          </button>
        </div>
      </div>
    ),
  },
];
