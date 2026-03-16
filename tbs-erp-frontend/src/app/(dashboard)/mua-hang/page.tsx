'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { purchaseRequestColumns, purchaseOrderColumns } from '@/features/purchases/purchase-table-columns';
import { usePurchaseRequests, usePurchaseOrders } from '@/lib/hooks/use-purchases';
import { cn } from '@/lib/utils/cn';
import type { PurchaseQueryParams } from '@/lib/types/purchase.types';
import dynamic from 'next/dynamic';

const TabNhaCungCap = dynamic(
  () => import('./_components/tab-nha-cung-cap').then((m) => m.TabNhaCungCap),
  { loading: () => <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div> },
);

const TabKhoVatTu = dynamic(
  () => import('./_components/tab-kho-vat-tu').then((m) => m.TabKhoVatTu),
  { loading: () => <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div> },
);

// ---------------------------------------------------------------------------
// PR / PO inner tabs (within the default tab)
// ---------------------------------------------------------------------------

type InnerTab = 'pr' | 'po';

function PurchaseContent() {
  const [activeInnerTab, setActiveInnerTab] = useState<InnerTab>('pr');
  const [prFilters] = useState<PurchaseQueryParams>({});
  const [poFilters] = useState<PurchaseQueryParams>({});
  const [prPage, setPrPage] = useState(1);
  const [poPage, setPoPage] = useState(1);

  const { data: prData, isLoading: prLoading } = usePurchaseRequests({
    ...prFilters,
    page: prPage,
    limit: 20,
  });
  const { data: poData, isLoading: poLoading } = usePurchaseOrders({
    ...poFilters,
    page: poPage,
    limit: 20,
  });

  const innerTabs: { key: InnerTab; label: string }[] = [
    { key: 'pr', label: 'Yêu cầu mua' },
    { key: 'po', label: 'Đơn mua hàng' },
  ];

  return (
    <div className="space-y-4">
      {/* Inner pill tabs */}
      <div className="flex gap-1 rounded-lg border p-1 w-fit">
        {innerTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveInnerTab(tab.key)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm transition-colors',
              activeInnerTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeInnerTab === 'pr' && (
        <DataTable
          columns={purchaseRequestColumns}
          data={prData?.data ?? []}
          pageCount={prData?.meta?.totalPages}
          page={prPage}
          onPageChange={setPrPage}
          isLoading={prLoading}
        />
      )}

      {activeInnerTab === 'po' && (
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
  );
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'default', label: 'Mua hàng' },
  { key: 'nha-cung-cap', label: 'Nhà cung cấp' },
  { key: 'kho-vat-tu', label: 'Kho vật tư' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function MuaHangPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get('tab') ?? 'default') as TabKey;

  const setTab = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'default') params.delete('tab');
    else params.set('tab', tab);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div>
      <PageHeader title="Mua hàng" description="Quản lý mua hàng, nhà cung cấp và kho vật tư" infoKey="mua-hang">
        {activeTab === 'default' && (
          <Link
            href="/mua-hang/tao-moi"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Tạo yêu cầu mua
          </Link>
        )}
      </PageHeader>

      {/* Tab bar */}
      <div className="flex gap-1 border-b mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'default' && <PurchaseContent />}
      {activeTab === 'nha-cung-cap' && <TabNhaCungCap />}
      {activeTab === 'kho-vat-tu' && <TabKhoVatTu />}
    </div>
  );
}

export default function MuaHangPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div>}>
      <MuaHangPageInner />
    </Suspense>
  );
}
