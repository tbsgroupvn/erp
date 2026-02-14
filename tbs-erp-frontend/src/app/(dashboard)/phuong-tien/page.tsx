'use client';

import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { vehicleColumns } from '@/features/fleet/vehicle-table-columns';
import { useVehicles } from '@/lib/hooks/use-fleet';
import { VehicleType, VehicleStatus, Branch } from '@/lib/types/enums';
import { VEHICLE_TYPE_LABELS, VEHICLE_STATUS_LABELS, BRANCH_LABELS } from '@/lib/utils/constants';
import type { VehicleQueryParams } from '@/lib/types/fleet.types';

export default function PhuongTienPage() {
  const [filters, setFilters] = useState<VehicleQueryParams>({});
  const [page, setPage] = useState(1);
  const { data, isLoading } = useVehicles({ ...filters, page, limit: 20 });

  const [vehicleType, setVehicleType] = useState('');
  const [vehicleStatus, setVehicleStatus] = useState('');
  const [branch, setBranch] = useState('');
  const [search, setSearch] = useState('');

  const applyFilters = (overrides: Partial<{ type: string; status: string; branch: string; search: string }> = {}) => {
    const newFilters: VehicleQueryParams = {
      type: ((overrides.type !== undefined ? overrides.type : vehicleType) || undefined) as VehicleType | undefined,
      status: ((overrides.status !== undefined ? overrides.status : vehicleStatus) || undefined) as VehicleStatus | undefined,
      branch: ((overrides.branch !== undefined ? overrides.branch : branch) || undefined) as Branch | undefined,
      search: (overrides.search !== undefined ? overrides.search : search) || undefined,
    };
    setFilters(newFilters);
    setPage(1);
  };

  return (
    <div>
      <PageHeader title="Phương tiện" description="Quản lý phương tiện vận tải">
        <Link
          href="/phuong-tien/tao-moi"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Thêm xe
        </Link>
      </PageHeader>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm theo biển số..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                applyFilters({ search: e.target.value });
              }}
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <select
            value={vehicleType}
            onChange={(e) => {
              setVehicleType(e.target.value);
              applyFilters({ type: e.target.value });
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Loại xe</option>
            {Object.entries(VEHICLE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={vehicleStatus}
            onChange={(e) => {
              setVehicleStatus(e.target.value);
              applyFilters({ status: e.target.value });
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Trạng thái</option>
            {Object.entries(VEHICLE_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value);
              applyFilters({ branch: e.target.value });
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
          columns={vehicleColumns}
          data={data?.data ?? []}
          pageCount={data?.meta?.totalPages}
          page={page}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
