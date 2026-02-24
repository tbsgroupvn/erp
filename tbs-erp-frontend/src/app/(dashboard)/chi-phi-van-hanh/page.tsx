'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { formatDate, formatCurrency } from '@/lib/utils/format';
import type { ColumnDef } from '@tanstack/react-table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OperationCost {
  id: string;
  costType: string;
  containerId: string | null;
  amount: number;
  allocation: string | null;
  date: string;
}

interface OperationCostsResponse {
  data: OperationCost[];
  meta?: { totalPages?: number };
}

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

const columns: ColumnDef<OperationCost>[] = [
  {
    accessorKey: 'costType',
    header: 'Loai chi phi',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.costType || '---'}</span>
    ),
  },
  {
    accessorKey: 'containerId',
    header: 'Container',
    cell: ({ row }) => <span>{row.original.containerId || '---'}</span>,
  },
  {
    accessorKey: 'amount',
    header: 'So tien',
    cell: ({ row }) => (
      <span className="font-medium">{formatCurrency(row.original.amount)}</span>
    ),
  },
  {
    accessorKey: 'allocation',
    header: 'Phan bo',
    cell: ({ row }) => <span>{row.original.allocation || '---'}</span>,
  },
  {
    accessorKey: 'date',
    header: 'Ngay',
    cell: ({ row }) => (
      <span>
        {row.original.date ? formatDate(row.original.date, 'dd/MM/yyyy') : '---'}
      </span>
    ),
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ChiPhiVanHanhPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<OperationCostsResponse>({
    queryKey: ['operation-costs', page],
    queryFn: () =>
      apiClient
        .get('/operation-costs', { params: { page, limit: 20 } })
        .then((r) => r.data),
  });

  return (
    <div>
      <PageHeader
        title="Chi phi van hanh"
        description="Quan ly chi phi van hanh theo container"
      />

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
