'use client';

import { useState } from 'react';
import { Plus, AlertTriangle, Search, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { stockColumns } from '@/features/inventory/stock-table-columns';
import { useCurrentStock, useLowStockAlerts } from '@/lib/hooks/use-inventory';
import type { InventoryQueryParams } from '@/lib/types/inventory.types';

export default function KhoVatTuPage() {
  const [filters, setFilters] = useState<InventoryQueryParams>({});
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCurrentStock({ ...filters, page, limit: 20 });
  const { data: alerts } = useLowStockAlerts();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const applyFilters = (overrides: Partial<{ search: string; category: string }> = {}) => {
    const newFilters: InventoryQueryParams = {
      search: (overrides.search !== undefined ? overrides.search : search) || undefined,
      category: (overrides.category !== undefined ? overrides.category : category) || undefined,
    };
    setFilters(newFilters);
    setPage(1);
  };

  return (
    <div>
      <PageHeader title="Kho vật tư" description="Quản lý tồn kho và vật tư">
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
            <ArrowUpDown className="h-4 w-4" />
            Ghi nhận biến động
          </button>
          <Link
            href="/kho-vat-tu/tao-moi"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Thêm vật tư
          </Link>
        </div>
      </PageHeader>

      <div className="space-y-4">
        {/* Low stock alerts */}
        {alerts && alerts.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-amber-800">Cảnh báo tồn kho thấp</h3>
            </div>
            <div className="space-y-1">
              {alerts.map((alert) => (
                <p key={alert.stockItemId} className="text-sm text-amber-700">
                  <span className="font-medium">{alert.code}</span> - {alert.name}:
                  tồn kho <span className="font-bold text-red-600">{alert.currentQty}</span> (tối thiểu: {alert.minLevel})
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm theo mã, tên vật tư..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                applyFilters({ search: e.target.value });
              }}
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              applyFilters({ category: e.target.value });
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Danh mục</option>
            <option value="PACKAGING">Bao bì đóng gói</option>
            <option value="OFFICE">Văn phòng phẩm</option>
            <option value="EQUIPMENT">Thiết bị</option>
            <option value="CONSUMABLE">Vật tư tiêu hao</option>
            <option value="SPARE_PART">Phụ tùng</option>
          </select>
        </div>

        <DataTable
          columns={stockColumns}
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
