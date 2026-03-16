'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { contractColumns } from '@/features/contracts/contract-table-columns';
import { useContracts } from '@/lib/hooks/use-contracts';
import { ContractStatus } from '@/lib/types';
import { CONTRACT_STATUS_LABELS } from '@/lib/utils/constants';
import { cn } from '@/lib/utils/cn';

const STATUS_TABS = [
  { value: undefined, label: 'Tất cả' },
  { value: ContractStatus.DRAFT, label: CONTRACT_STATUS_LABELS[ContractStatus.DRAFT] },
  { value: ContractStatus.PENDING_SIGNATURE, label: CONTRACT_STATUS_LABELS[ContractStatus.PENDING_SIGNATURE] },
  { value: ContractStatus.SIGNED, label: CONTRACT_STATUS_LABELS[ContractStatus.SIGNED] },
  { value: ContractStatus.ACTIVE, label: CONTRACT_STATUS_LABELS[ContractStatus.ACTIVE] },
  { value: ContractStatus.COMPLETED, label: CONTRACT_STATUS_LABELS[ContractStatus.COMPLETED] },
];

export default function HopDongPage() {
  const [activeStatus, setActiveStatus] = useState<ContractStatus | undefined>();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useContracts({ status: activeStatus, page, limit: 20 });

  return (
    <div>
      <PageHeader title="Hợp đồng" description="Quản lý hợp đồng & phụ lục" infoKey="hop-dong">
        <Link
          href="/hop-dong/tao-moi"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tạo hợp đồng
        </Link>
      </PageHeader>

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
          columns={contractColumns}
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
