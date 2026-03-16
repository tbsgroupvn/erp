'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency } from '@/lib/utils/format';
import type { ColumnDef } from '@tanstack/react-table';

interface Asset {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  depreciation: number;
  status: string;
}

interface AssetsResponse {
  data: Asset[];
  meta?: { totalPages?: number };
}

const ASSET_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang sử dụng',
  INACTIVE: 'Không sử dụng',
  DISPOSED: 'Đã thanh lý',
  MAINTENANCE: 'Bảo trì',
};

const ASSET_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-700',
  DISPOSED: 'bg-red-100 text-red-700',
  MAINTENANCE: 'bg-yellow-100 text-yellow-700',
};

const columns: ColumnDef<Asset>[] = [
  {
    accessorKey: 'code',
    header: 'Mã TS',
    cell: ({ row }) => <span className="font-medium">{row.original.code}</span>,
  },
  {
    accessorKey: 'name',
    header: 'Tên tài sản',
  },
  {
    accessorKey: 'type',
    header: 'Loại',
  },
  {
    accessorKey: 'value',
    header: 'Giá trị',
    cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.value)}</span>,
  },
  {
    accessorKey: 'depreciation',
    header: 'Khấu hao',
    cell: ({ row }) => <span>{formatCurrency(row.original.depreciation)}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => {
      const status = row.original.status || '';
      return (
        <StatusBadge
          label={ASSET_STATUS_LABELS[status] || status || '---'}
          colorClass={ASSET_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
];

export function TabTaiSan() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<AssetsResponse>({
    queryKey: ['assets', page],
    queryFn: () =>
      apiClient.get('/assets', { params: { page, limit: 20 } }).then((r) => r.data),
  });

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">Danh sách tài sản cố định của công ty</p>
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
