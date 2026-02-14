'use client';

import { type ColumnDef } from '@tanstack/react-table';
import type { MasterOrder, Order, OrderStatus, ServiceType, ClearanceType, MasterOrderStatus } from '@/lib/types';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  MASTER_ORDER_STATUS_LABELS,
  MASTER_ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
  CLEARANCE_TYPE_LABELS,
  CLEARANCE_TYPE_COLORS,
  BRANCH_LABELS,
} from '@/lib/utils/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { Eye, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { Branch } from '@/lib/types';

export const masterOrderColumns: ColumnDef<MasterOrder>[] = [
  {
    id: 'expand',
    header: '',
    cell: ({ row }) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          row.toggleExpanded();
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
      >
        {row.getIsExpanded() ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
    ),
    size: 40,
  },
  {
    accessorKey: 'code',
    header: 'Mã đơn tổng',
    cell: ({ row }) => (
      <Link
        href={`/don-hang/${row.original.id}`}
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
      <div>
        <span className="font-medium">{row.original.customer?.fullName ?? '---'}</span>
        {row.original.customer?.companyName && (
          <p className="text-xs text-muted-foreground">{row.original.customer.companyName}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'branch',
    header: 'Chi nhánh',
    cell: ({ row }) => (
      <span>{BRANCH_LABELS[row.original.branch as Branch] || row.original.branch}</span>
    ),
  },
  {
    accessorKey: 'overallStatus',
    header: 'Trạng thái',
    cell: ({ row }) => {
      const status = row.original.overallStatus as MasterOrderStatus;
      return (
        <StatusBadge
          label={MASTER_ORDER_STATUS_LABELS[status] || status}
          colorClass={MASTER_ORDER_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    id: 'subOrderCount',
    header: 'Số đơn con',
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original._count?.subOrders ?? row.original.subOrders?.length ?? 0}
      </span>
    ),
  },
  {
    id: 'sale',
    header: 'Sale',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.sale?.fullName ?? '---'}</span>
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
      <Link
        href={`/don-hang/${row.original.id}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
      >
        <Eye className="h-4 w-4" />
      </Link>
    ),
  },
];

/** Sub order columns used in the expandable row */
export const subOrderColumns: ColumnDef<Order>[] = [
  {
    accessorKey: 'code',
    header: 'Mã đơn con',
    cell: ({ row }) => (
      <span className="font-medium text-sm">{row.original.code}</span>
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
    accessorKey: 'clearanceType',
    header: 'Thông quan',
    cell: ({ row }) => {
      const ct = row.original.clearanceType as ClearanceType;
      return (
        <StatusBadge
          label={CLEARANCE_TYPE_LABELS[ct] || ct}
          colorClass={CLEARANCE_TYPE_COLORS[ct] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => {
      const status = row.original.status as OrderStatus;
      return (
        <StatusBadge
          label={ORDER_STATUS_LABELS[status] || status}
          colorClass={ORDER_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    accessorKey: 'totalAmount',
    header: 'Tổng tiền',
    cell: ({ row }) => (
      <span className="font-medium text-sm">
        {formatCurrency(row.original.totalAmount, row.original.currency)}
      </span>
    ),
  },
];

