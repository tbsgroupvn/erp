'use client';

import { type ColumnDef } from '@tanstack/react-table';
import type { PaymentVoucher } from '@/lib/types';
import { StatusBadge } from '@/components/shared/status-badge';
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS } from '@/lib/utils/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { MoreHorizontal, Eye, Flag } from 'lucide-react';
import Link from 'next/link';
import type { ApprovalStatus } from '@/lib/types';

export const voucherColumns: ColumnDef<PaymentVoucher>[] = [
  {
    accessorKey: 'code',
    header: 'Mã phiếu',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.code}</span>
    ),
  },
  {
    accessorKey: 'type',
    header: 'Loại',
    cell: ({ row }) => (
      <StatusBadge
        label={row.original.type === 'RECEIPT' ? 'Phiếu thu' : 'Phiếu chi'}
        colorClass={
          row.original.type === 'RECEIPT'
            ? 'bg-green-100 text-green-700'
            : 'bg-orange-100 text-orange-700'
        }
      />
    ),
  },
  {
    accessorKey: 'orderId',
    header: 'Đơn hàng',
    cell: ({ row }) => (
      <span>{row.original.orderId || '---'}</span>
    ),
  },
  {
    accessorKey: 'amount',
    header: 'Số tiền',
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.original.amount, row.original.currency)}
      </span>
    ),
  },
  {
    accessorKey: 'beneficiary',
    header: 'Người thụ hưởng',
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => {
      const status = row.original.status as ApprovalStatus;
      return (
        <StatusBadge
          label={APPROVAL_STATUS_LABELS[status] || status}
          colorClass={APPROVAL_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    id: 'flagged',
    header: 'Cảnh báo',
    cell: ({ row }) =>
      row.original.isFlagged ? (
        <Flag className="h-4 w-4 text-red-500" />
      ) : null,
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
            href={`/tai-chinh/phieu/${row.original.id}`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Eye className="h-4 w-4" /> Xem chi tiết
          </Link>
        </div>
      </div>
    ),
  },
];
