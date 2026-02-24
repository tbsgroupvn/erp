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
import { MoreHorizontal, Eye, Pencil, Copy, FileText, FileSpreadsheet, BookmarkPlus } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { quotationsApi } from '@/lib/api/quotations.api';
import { saveAs } from 'file-saver';

function QuotationActions({ row }: { row: Quotation }) {
  const handleDuplicate = async () => {
    try {
      await quotationsApi.duplicate(row.id);
      toast.success('\u0110\u00E3 sao ch\u00E9p b\u00E1o gi\u00E1');
      window.location.reload();
    } catch {
      toast.error('L\u1ED7i sao ch\u00E9p b\u00E1o gi\u00E1');
    }
  };

  const handleExportPdf = async () => {
    try {
      const blob = await quotationsApi.exportPdf(row.id);
      saveAs(blob, `bao-gia-${row.code}.pdf`);
      toast.success('\u0110\u00E3 t\u1EA3i PDF');
    } catch {
      toast.error('L\u1ED7i xu\u1EA5t PDF');
    }
  };

  const handleExportExcel = async () => {
    try {
      const blob = await quotationsApi.exportExcel(row.id);
      saveAs(blob, `bao-gia-${row.code}.xlsx`);
      toast.success('\u0110\u00E3 t\u1EA3i Excel');
    } catch {
      toast.error('L\u1ED7i xu\u1EA5t Excel');
    }
  };

  const handleSaveAsTemplate = async () => {
    const name = prompt('T\u00EAn m\u1EABu b\u00E1o gi\u00E1:');
    if (!name?.trim()) return;
    try {
      await quotationsApi.saveAsTemplate(row.id, { name: name.trim() });
      toast.success('\u0110\u00E3 l\u01B0u m\u1EABu b\u00E1o gi\u00E1');
    } catch {
      toast.error('L\u1ED7i l\u01B0u m\u1EABu');
    }
  };

  return (
    <div className="relative group">
      <button className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <div className="absolute right-0 top-full z-10 hidden w-52 rounded-md border bg-popover p-1 shadow-md group-hover:block">
        <Link
          href={`/bao-gia/${row.id}`}
          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          <Eye className="h-4 w-4" /> Xem
        </Link>
        <Link
          href={`/bao-gia/tao-moi?editId=${row.id}`}
          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          <Pencil className="h-4 w-4" /> S\u1EEDa
        </Link>
        <button
          onClick={handleDuplicate}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          <Copy className="h-4 w-4" /> Sao ch\u00E9p
        </button>
        <div className="my-1 border-t" />
        <button
          onClick={handleExportPdf}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          <FileText className="h-4 w-4" /> Xu\u1EA5t PDF
        </button>
        <button
          onClick={handleExportExcel}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          <FileSpreadsheet className="h-4 w-4" /> Xu\u1EA5t Excel
        </button>
        <div className="my-1 border-t" />
        <button
          onClick={handleSaveAsTemplate}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          <BookmarkPlus className="h-4 w-4" /> L\u01B0u l\u00E0m m\u1EABu
        </button>
      </div>
    </div>
  );
}

export const quotationColumns: ColumnDef<Quotation>[] = [
  {
    accessorKey: 'code',
    header: 'M\u00E3 BG',
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
    header: 'Kh\u00E1ch h\u00E0ng',
    cell: ({ row }) => (
      <span>{row.original.customer?.fullName ?? '---'}</span>
    ),
  },
  {
    accessorKey: 'serviceType',
    header: 'Lo\u1EA1i DV',
    cell: ({ row }) => (
      <StatusBadge
        label={SERVICE_TYPE_LABELS[row.original.serviceType as ServiceType] || row.original.serviceType}
        colorClass="bg-blue-50 text-blue-700"
      />
    ),
  },
  {
    accessorKey: 'status',
    header: 'Tr\u1EA1ng th\u00E1i',
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
    header: 'T\u1ED5ng ti\u1EC1n',
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.original.totalAmount)}
      </span>
    ),
  },
  {
    accessorKey: 'validUntil',
    header: 'Hi\u1EC7u l\u1EF1c \u0111\u1EBFn',
    cell: ({ row }) => (
      <span>{row.original.validUntil ? formatDate(row.original.validUntil, 'dd/MM/yyyy') : '---'}</span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Ng\u00E0y t\u1EA1o',
    cell: ({ row }) => <span>{formatDate(row.original.createdAt)}</span>,
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => <QuotationActions row={row.original} />,
  },
];
