'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Plus, Zap } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { QuickQuoteDrawer } from '@/components/shared/quick-quote-drawer';
import { quotationColumns } from '@/features/quotations/quotation-table-columns';
import { useQuotations } from '@/lib/hooks/use-quotations';
import { QuotationStatus } from '@/lib/types';
import { QUOTATION_STATUS_LABELS } from '@/lib/utils/constants';
import { cn } from '@/lib/utils/cn';
import type { QuotationQueryParams } from '@/lib/types';

const STATUS_TABS = [
  { value: undefined, label: 'Tất cả' },
  { value: QuotationStatus.DRAFT, label: QUOTATION_STATUS_LABELS[QuotationStatus.DRAFT] },
  { value: QuotationStatus.PENDING_APPROVAL, label: QUOTATION_STATUS_LABELS[QuotationStatus.PENDING_APPROVAL] },
  { value: QuotationStatus.APPROVED, label: QUOTATION_STATUS_LABELS[QuotationStatus.APPROVED] },
  { value: QuotationStatus.REJECTED, label: QUOTATION_STATUS_LABELS[QuotationStatus.REJECTED] },
  { value: QuotationStatus.CONVERTED, label: QUOTATION_STATUS_LABELS[QuotationStatus.CONVERTED] },
];

export default function BaoGiaPage() {
  const [activeStatus, setActiveStatus] = useState<QuotationStatus | undefined>();
  const [page, setPage] = useState(1);
  const [quickQuoteOpen, setQuickQuoteOpen] = useState(false);
  const { data, isLoading, refetch } = useQuotations({ status: activeStatus, page, limit: 20 });

  return (
    <div>
      <PageHeader title="Báo giá" description="Quản lý báo giá" infoKey="bao-gia">
        <button
          onClick={() => setQuickQuoteOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          <Zap className="h-4 w-4" />
          Báo giá nhanh
        </button>
        <Link
          href="/bao-gia/tao-moi"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tạo báo giá
        </Link>
      </PageHeader>

      <QuickQuoteDrawer
        open={quickQuoteOpen}
        onClose={() => setQuickQuoteOpen(false)}
        onSuccess={() => { setQuickQuoteOpen(false); refetch(); }}
      />

      <div className="space-y-4">
        <div className="flex gap-1 overflow-x-auto rounded-lg border p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => { setActiveStatus(tab.value); setPage(1); }}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors',
                activeStatus === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <DataTable
          columns={quotationColumns}
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
