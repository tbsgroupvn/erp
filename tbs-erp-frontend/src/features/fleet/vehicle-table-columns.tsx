'use client';

import { type ColumnDef } from '@tanstack/react-table';
import type { Vehicle } from '@/lib/types/fleet.types';
import type { VehicleType, VehicleStatus, Branch } from '@/lib/types/enums';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  VEHICLE_TYPE_LABELS,
  VEHICLE_STATUS_LABELS,
  VEHICLE_STATUS_COLORS,
  BRANCH_LABELS,
} from '@/lib/utils/constants';
import { formatDate } from '@/lib/utils/format';
import { MoreHorizontal, Eye, Pencil, Wrench } from 'lucide-react';
import Link from 'next/link';

function isExpiringSoon(dateStr?: string): 'expired' | 'soon' | 'ok' {
  if (!dateStr) return 'ok';
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return 'expired';
  if (diff < 30 * 24 * 60 * 60 * 1000) return 'soon';
  return 'ok';
}

export const vehicleColumns: ColumnDef<Vehicle>[] = [
  {
    accessorKey: 'plateNumber',
    header: 'Biển số',
    cell: ({ row }) => (
      <Link
        href={`/phuong-tien/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.plateNumber}
      </Link>
    ),
  },
  {
    accessorKey: 'type',
    header: 'Loại xe',
    cell: ({ row }) => (
      <StatusBadge
        label={VEHICLE_TYPE_LABELS[row.original.type as VehicleType] || row.original.type}
        colorClass="bg-blue-50 text-blue-700"
      />
    ),
  },
  {
    id: 'brandModel',
    header: 'Hãng / Model',
    cell: ({ row }) => (
      <span>{row.original.brand} {row.original.model}</span>
    ),
  },
  {
    accessorKey: 'capacityKg',
    header: 'Tải trọng (kg)',
    cell: ({ row }) => (
      <span>{row.original.capacityKg.toLocaleString('vi-VN')}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => {
      const status = row.original.status as VehicleStatus;
      return (
        <StatusBadge
          label={VEHICLE_STATUS_LABELS[status] || status}
          colorClass={VEHICLE_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    accessorKey: 'branch',
    header: 'Chi nhánh',
    cell: ({ row }) => (
      <span>{BRANCH_LABELS[row.original.branch as Branch] || row.original.branch}</span>
    ),
  },
  {
    accessorKey: 'insuranceExpiry',
    header: 'Hạn bảo hiểm',
    cell: ({ row }) => {
      const expiry = row.original.insuranceExpiry;
      const status = isExpiringSoon(expiry);
      return (
        <span
          className={
            status === 'expired'
              ? 'text-red-600 font-medium'
              : status === 'soon'
                ? 'text-amber-600 font-medium'
                : ''
          }
        >
          {expiry ? formatDate(expiry, 'dd/MM/yyyy') : '---'}
          {status === 'expired' && ' (Hết hạn)'}
          {status === 'soon' && ' (Sắp hết)'}
        </span>
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
            href={`/phuong-tien/${row.original.id}`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Eye className="h-4 w-4" /> Xem
          </Link>
          <Link
            href={`/phuong-tien/${row.original.id}?edit=true`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Pencil className="h-4 w-4" /> Sửa
          </Link>
          <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
            <Wrench className="h-4 w-4" /> Bảo dưỡng
          </button>
        </div>
      </div>
    ),
  },
];
