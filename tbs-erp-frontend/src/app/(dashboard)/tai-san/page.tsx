'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency } from '@/lib/utils/format';
import type { ColumnDef } from '@tanstack/react-table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Status maps
// ---------------------------------------------------------------------------

const ASSET_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Dang su dung',
  INACTIVE: 'Khong su dung',
  DISPOSED: 'Da thanh ly',
  MAINTENANCE: 'Bao tri',
};

const ASSET_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-700',
  DISPOSED: 'bg-red-100 text-red-700',
  MAINTENANCE: 'bg-yellow-100 text-yellow-700',
};

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

const columns: ColumnDef<Asset>[] = [
  {
    accessorKey: 'code',
    header: 'Ma TS',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.code}</span>
    ),
  },
  {
    accessorKey: 'name',
    header: 'Ten tai san',
  },
  {
    accessorKey: 'type',
    header: 'Loai',
  },
  {
    accessorKey: 'value',
    header: 'Gia tri',
    cell: ({ row }) => (
      <span className="font-medium">{formatCurrency(row.original.value)}</span>
    ),
  },
  {
    accessorKey: 'depreciation',
    header: 'Khau hao',
    cell: ({ row }) => (
      <span>{formatCurrency(row.original.depreciation)}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Trang thai',
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

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function TaiSanPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<AssetsResponse>({
    queryKey: ['assets', page],
    queryFn: () =>
      apiClient.get('/assets', { params: { page, limit: 20 } }).then((r) => r.data),
  });

  return (
    <div>
      <PageHeader
        title="Quan ly tai san"
        description="Danh sach tai san co dinh cua cong ty"
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
