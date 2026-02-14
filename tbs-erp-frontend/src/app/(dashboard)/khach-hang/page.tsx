'use client';

import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { customerColumns } from '@/features/customers/customer-table-columns';
import { useCustomers } from '@/lib/hooks/use-customers';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { CustomerTier, Branch } from '@/lib/types/enums';
import type { CustomerQueryParams } from '@/lib/types';

export default function KhachHangPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  // Debounce search to avoid excessive API calls (increased to 500ms for consistency)
  const debouncedSearch = useDebouncedValue(search, 500);
  const [tier, setTier] = useState<CustomerTier | undefined>();
  const [branch, setBranch] = useState<Branch | undefined>();
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const params: CustomerQueryParams = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    tier,
    branch,
    isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
  };
  const { data, isLoading } = useCustomers(params);

  return (
    <div>
      <PageHeader title="Khách hàng" description="Quản lý khách hàng">
        <Link
          href="/khach-hang/tao-moi"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Thêm khách hàng
        </Link>
      </PageHeader>

      <div className="space-y-4">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm theo tên, SĐT, mã KH..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tier Filter */}
          <select
            value={tier || ''}
            onChange={(e) => { setTier(e.target.value as CustomerTier || undefined); setPage(1); }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Tất cả hạng KH</option>
            <option value={CustomerTier.NEW}>Mới</option>
            <option value={CustomerTier.REGULAR}>Thường</option>
            <option value={CustomerTier.VIP}>VIP</option>
            <option value={CustomerTier.STRATEGIC}>Chiến lược</option>
          </select>

          {/* Branch Filter */}
          <select
            value={branch || ''}
            onChange={(e) => { setBranch(e.target.value as Branch || undefined); setPage(1); }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Tất cả chi nhánh</option>
            <option value={Branch.HN}>Hà Nội</option>
            <option value={Branch.HCM}>Hồ Chí Minh</option>
          </select>

          {/* Active Status Filter */}
          <div className="flex items-center gap-2 rounded-md border bg-background">
            <button
              onClick={() => { setActiveFilter('all'); setPage(1); }}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === 'all'
                  ? 'bg-primary text-primary-foreground rounded-l-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => { setActiveFilter('active'); setPage(1); }}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === 'active'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Hoạt động
            </button>
            <button
              onClick={() => { setActiveFilter('inactive'); setPage(1); }}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === 'inactive'
                  ? 'bg-primary text-primary-foreground rounded-r-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Ngừng
            </button>
          </div>

          {/* Clear Filters */}
          {(tier || branch || activeFilter !== 'all') && (
            <button
              onClick={() => {
                setTier(undefined);
                setBranch(undefined);
                setActiveFilter('all');
                setPage(1);
              }}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        <DataTable
          columns={customerColumns}
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
