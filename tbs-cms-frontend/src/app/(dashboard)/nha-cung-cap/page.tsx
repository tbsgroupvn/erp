'use client';

import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { vendorColumns } from '@/features/vendors/vendor-table-columns';
import { useVendors } from '@/lib/hooks/use-vendors';
import type { VendorQueryParams } from '@/lib/types/vendor.types';

export default function NhaCungCapPage() {
  const [filters, setFilters] = useState<VendorQueryParams>({});
  const [page, setPage] = useState(1);
  const { data, isLoading } = useVendors({ ...filters, page, limit: 20 });

  const [country, setCountry] = useState('');
  const [isApproved, setIsApproved] = useState('');
  const [search, setSearch] = useState('');

  const applyFilters = (overrides: Partial<{ country: string; isApproved: string; search: string }> = {}) => {
    const approvedVal = overrides.isApproved !== undefined ? overrides.isApproved : isApproved;
    const newFilters: VendorQueryParams = {
      country: (overrides.country !== undefined ? overrides.country : country) || undefined,
      isApproved: approvedVal === '' ? undefined : approvedVal === 'true',
      search: (overrides.search !== undefined ? overrides.search : search) || undefined,
    };
    setFilters(newFilters);
    setPage(1);
  };

  return (
    <div>
      <PageHeader title="Nhà cung cấp" description="Quản lý nhà cung cấp">
        <Link
          href="/nha-cung-cap/tao-moi"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Thêm NCC
        </Link>
      </PageHeader>

      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm theo mã, tên NCC..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                applyFilters({ search: e.target.value });
              }}
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              applyFilters({ country: e.target.value });
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Quốc gia</option>
            <option value="CN">Trung Quốc</option>
            <option value="VN">Việt Nam</option>
            <option value="KR">Hàn Quốc</option>
            <option value="JP">Nhật Bản</option>
            <option value="TH">Thái Lan</option>
          </select>

          <select
            value={isApproved}
            onChange={(e) => {
              setIsApproved(e.target.value);
              applyFilters({ isApproved: e.target.value });
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Trạng thái duyệt</option>
            <option value="true">Đã duyệt</option>
            <option value="false">Chưa duyệt</option>
          </select>
        </div>

        <DataTable
          columns={vendorColumns}
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
