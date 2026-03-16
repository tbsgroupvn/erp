'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { DataTable } from '@/components/shared/data-table';
import { formatCurrency } from '@/lib/utils/format';
import type { ColumnDef } from '@tanstack/react-table';

interface Budget {
  id: string;
  department: string;
  period: string;
  budget: number;
  spent: number;
  remaining: number;
  ratio: number;
}

interface BudgetsResponse {
  data: Budget[];
  meta?: { totalPages?: number };
}

const columns: ColumnDef<Budget>[] = [
  {
    accessorKey: 'department',
    header: 'Phòng ban',
    cell: ({ row }) => <span className="font-medium">{row.original.department}</span>,
  },
  {
    accessorKey: 'period',
    header: 'Kỳ',
  },
  {
    accessorKey: 'budget',
    header: 'Ngân sách',
    cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.budget)}</span>,
  },
  {
    accessorKey: 'spent',
    header: 'Đã chi',
    cell: ({ row }) => <span className="text-red-600">{formatCurrency(row.original.spent)}</span>,
  },
  {
    accessorKey: 'remaining',
    header: 'Còn lại',
    cell: ({ row }) => (
      <span className="text-green-600">{formatCurrency(row.original.remaining)}</span>
    ),
  },
  {
    accessorKey: 'ratio',
    header: 'Tỷ lệ',
    cell: ({ row }) => {
      const ratio = row.original.ratio ?? 0;
      const colorClass =
        ratio > 90 ? 'text-red-600' : ratio > 70 ? 'text-yellow-600' : 'text-green-600';
      return <span className={`font-medium ${colorClass}`}>{ratio.toFixed(1)}%</span>;
    },
  },
];

export function TabNganSach() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<BudgetsResponse>({
    queryKey: ['budgets', page],
    queryFn: () =>
      apiClient.get('/budgets', { params: { page, limit: 20 } }).then((r) => r.data),
  });

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">Theo dõi ngân sách theo phòng ban và kỳ</p>
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
