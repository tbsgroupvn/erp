'use client';

import { type ColumnDef } from '@tanstack/react-table';
import type { Vendor } from '@/lib/types/vendor.types';
import { StatusBadge } from '@/components/shared/status-badge';
import { MoreHorizontal, Eye, Pencil, Star } from 'lucide-react';
import Link from 'next/link';

function RatingStars({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < fullStars
              ? 'fill-yellow-400 text-yellow-400'
              : i === fullStars && hasHalf
                ? 'fill-yellow-400/50 text-yellow-400'
                : 'text-gray-300'
          }`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

export const vendorColumns: ColumnDef<Vendor>[] = [
  {
    accessorKey: 'code',
    header: 'Mã NCC',
    cell: ({ row }) => (
      <Link
        href={`/nha-cung-cap/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    accessorKey: 'name',
    header: 'Tên',
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'contactPerson',
    header: 'Người liên hệ',
    cell: ({ row }) => <span>{row.original.contactPerson}</span>,
  },
  {
    accessorKey: 'country',
    header: 'Quốc gia',
    cell: ({ row }) => <span>{row.original.country}</span>,
  },
  {
    accessorKey: 'isApproved',
    header: 'Trạng thái',
    cell: ({ row }) => (
      <StatusBadge
        label={row.original.isApproved ? 'Đã duyệt' : 'Chưa duyệt'}
        colorClass={row.original.isApproved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
      />
    ),
  },
  {
    accessorKey: 'averageRating',
    header: 'Đánh giá',
    cell: ({ row }) => <RatingStars rating={row.original.averageRating || 0} />,
  },
  {
    accessorKey: 'phone',
    header: 'Điện thoại',
    cell: ({ row }) => <span>{row.original.phone}</span>,
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
            href={`/nha-cung-cap/${row.original.id}`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Eye className="h-4 w-4" /> Xem
          </Link>
          <Link
            href={`/nha-cung-cap/${row.original.id}?edit=true`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Pencil className="h-4 w-4" /> Sửa
          </Link>
        </div>
      </div>
    ),
  },
];
