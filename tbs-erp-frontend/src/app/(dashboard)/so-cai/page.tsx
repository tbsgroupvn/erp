'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatDate, formatCurrency } from '@/lib/utils/format';
import type { ColumnDef } from '@tanstack/react-table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JournalEntry {
  id: string;
  date: string;
  voucherCode: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  description: string;
}

interface JournalEntriesResponse {
  data: JournalEntry[];
  meta?: { totalPages?: number };
}

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

const columns: ColumnDef<JournalEntry>[] = [
  {
    accessorKey: 'date',
    header: 'Ngay',
    cell: ({ row }) => (
      <span>{row.original.date ? formatDate(row.original.date, 'dd/MM/yyyy') : '---'}</span>
    ),
  },
  {
    accessorKey: 'voucherCode',
    header: 'Ma chung tu',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.voucherCode || '---'}</span>
    ),
  },
  {
    accessorKey: 'debitAccount',
    header: 'Tai khoan No',
  },
  {
    accessorKey: 'creditAccount',
    header: 'Tai khoan Co',
  },
  {
    accessorKey: 'amount',
    header: 'So tien',
    cell: ({ row }) => (
      <span className="font-medium">{formatCurrency(row.original.amount)}</span>
    ),
  },
  {
    accessorKey: 'description',
    header: 'Dien giai',
    cell: ({ row }) => (
      <span className="max-w-[300px] truncate block">
        {row.original.description || '---'}
      </span>
    ),
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SoCaiPage() {
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, isLoading } = useQuery<JournalEntriesResponse>({
    queryKey: ['general-ledger', page, fromDate, toDate],
    queryFn: () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      return apiClient.get('/general-ledger/entries', { params }).then((r) => r.data);
    },
  });

  const handleReset = () => {
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="So cai tong hop"
        description="Xem but toan so cai theo ky"
      />

      {/* Date range filter */}
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="fromDate">Tu ngay</Label>
          <Input
            id="fromDate"
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="toDate">Den ngay</Label>
          <Input
            id="toDate"
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button variant="outline" onClick={handleReset}>
          Xoa loc
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        pageCount={data?.meta?.totalPages}
        page={page}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </div>
  );
}
