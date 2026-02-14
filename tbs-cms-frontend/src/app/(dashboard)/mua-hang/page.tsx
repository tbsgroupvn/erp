'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { purchaseRequestColumns, purchaseOrderColumns } from '@/features/purchases/purchase-table-columns';
import { usePurchaseRequests, usePurchaseOrders } from '@/lib/hooks/use-purchases';
import { cn } from '@/lib/utils/cn';
import type { PurchaseQueryParams } from '@/lib/types/purchase.types';

type TabKey = 'pr' | 'po';

export default function MuaHangPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('pr');
  const [prFilters] = useState<PurchaseQueryParams>({});
  const [poFilters] = useState<PurchaseQueryParams>({});
  const [prPage, setPrPage] = useState(1);
  const [poPage, setPoPage] = useState(1);

  const { data: prData, isLoading: prLoading } = usePurchaseRequests({ ...prFilters, page: prPage, limit: 20 });
  const { data: poData, isLoading: poLoading } = usePurchaseOrders({ ...poFilters, page: poPage, limit: 20 });

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'pr', label: 'Yêu cầu mua' },
    { key: 'po', label: 'Đơn mua hàng' },
  ];

  return (
    <div>
      <PageHeader title="Mua hàng" description="Quản lý yêu cầu mua và đơn mua hàng">
        <Link
          href="/mua-hang/tao-moi"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tạo yêu cầu mua
        </Link>
      </PageHeader>

      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm transition-colors',
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'pr' && (
          <DataTable
            columns={purchaseRequestColumns}
            data={prData?.data ?? []}
            pageCount={prData?.meta?.totalPages}
            page={prPage}
            onPageChange={setPrPage}
            isLoading={prLoading}
          />
        )}

        {activeTab === 'po' && (
          <DataTable
            columns={purchaseOrderColumns}
            data={poData?.data ?? []}
            pageCount={poData?.meta?.totalPages}
            page={poPage}
            onPageChange={setPoPage}
            isLoading={poLoading}
          />
        )}
      </div>
    </div>
  );
}
