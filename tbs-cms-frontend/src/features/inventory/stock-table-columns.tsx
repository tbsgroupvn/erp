'use client';

import { type ColumnDef } from '@tanstack/react-table';
import type { StockItem } from '@/lib/types/inventory.types';
import { MoreHorizontal, Eye, ArrowUpDown, Pencil } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export const stockColumns: ColumnDef<StockItem>[] = [
  {
    accessorKey: 'code',
    header: 'Mã vật tư',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.code}</span>
    ),
  },
  {
    accessorKey: 'name',
    header: 'Tên vật tư',
    cell: ({ row }) => <span>{row.original.name}</span>,
  },
  {
    accessorKey: 'unit',
    header: 'Đơn vị',
    cell: ({ row }) => <span>{row.original.unit}</span>,
  },
  {
    accessorKey: 'currentQty',
    header: 'Tồn kho',
    cell: ({ row }) => {
      const isLow = row.original.currentQty <= row.original.minLevel;
      return (
        <span className={isLow ? 'text-red-600 font-bold' : 'font-medium'}>
          {row.original.currentQty.toLocaleString('vi-VN')}
          {isLow && ' (Thấp)'}
        </span>
      );
    },
  },
  {
    accessorKey: 'minLevel',
    header: 'Mức tối thiểu',
    cell: ({ row }) => (
      <span>{row.original.minLevel.toLocaleString('vi-VN')}</span>
    ),
  },
  {
    accessorKey: 'maxLevel',
    header: 'Mức tối đa',
    cell: ({ row }) => (
      <span>{row.original.maxLevel.toLocaleString('vi-VN')}</span>
    ),
  },
  {
    accessorKey: 'location',
    header: 'Vị trí',
    cell: ({ row }) => <span>{row.original.location}</span>,
  },
  {
    accessorKey: 'category',
    header: 'Danh mục',
    cell: ({ row }) => <span>{row.original.category}</span>,
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
            href={`/kho/vat-tu/${row.original.id}`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Eye className="h-4 w-4" /> Xem chi tiết
          </Link>
          <button
            onClick={() => toast.info('Tính năng đang phát triển')}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <ArrowUpDown className="h-4 w-4" /> Ghi nhận biến động
          </button>
          <Link
            href={`/kho/vat-tu/${row.original.id}/sua`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Pencil className="h-4 w-4" /> Sửa
          </Link>
        </div>
      </div>
    ),
  },
];
