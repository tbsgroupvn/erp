'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { DataTable } from '@/components/shared/data-table';
import { driverColumns } from '@/features/drivers/driver-table-columns';
import { useDrivers } from '@/lib/hooks/use-drivers';
import { DriverStatus, Branch } from '@/lib/types';
import { DRIVER_STATUS_LABELS, BRANCH_LABELS } from '@/lib/utils/constants';
import type { DriverQueryParams } from '@/lib/types';

export function TaiXeTab() {
  const [filters, setFilters] = useState<DriverQueryParams>({});
  const [page, setPage] = useState(1);
  const { data, isLoading } = useDrivers({ ...filters, page, limit: 20 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Quản lý tài xế</p>
        <Link
          href="/tai-xe/tao-moi"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Thêm tài xế
        </Link>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filters.status || ''}
          onChange={(e) => {
            const val = e.target.value ? (e.target.value as DriverStatus) : undefined;
            setFilters((prev) => ({ ...prev, status: val }));
            setPage(1);
          }}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Trạng thái</option>
          {Object.entries(DRIVER_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <select
          value={filters.branch || ''}
          onChange={(e) => {
            const val = e.target.value ? (e.target.value as Branch) : undefined;
            setFilters((prev) => ({ ...prev, branch: val }));
            setPage(1);
          }}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Chi nhánh</option>
          {Object.entries(BRANCH_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={driverColumns}
        data={data?.data ?? []}
        pageCount={data?.meta?.totalPages}
        page={page}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </div>
  );
}
