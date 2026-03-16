'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatDate, formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { ColumnDef } from '@tanstack/react-table';
import dynamic from 'next/dynamic';

const TabTyGia = dynamic(
  () => import('./_components/tab-ty-gia').then((m) => m.TabTyGia),
  { loading: () => <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div> },
);

const TabTaiSan = dynamic(
  () => import('./_components/tab-tai-san').then((m) => m.TabTaiSan),
  { loading: () => <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div> },
);

const TabNganSach = dynamic(
  () => import('./_components/tab-ngan-sach').then((m) => m.TabNganSach),
  { loading: () => <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div> },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JournalEntry {
  id: string;
  date: string;
  voucherCode: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  description: string;
}

interface JournalEntriesResponse {
  data: JournalEntry[];
  meta?: { totalPages?: number };
}

// ---------------------------------------------------------------------------
// GL table columns
// ---------------------------------------------------------------------------

const glColumns: ColumnDef<JournalEntry>[] = [
  {
    accessorKey: 'date',
    header: 'Ngày',
    cell: ({ row }) => (
      <span>{row.original.date ? formatDate(row.original.date, 'dd/MM/yyyy') : '---'}</span>
    ),
  },
  {
    accessorKey: 'voucherCode',
    header: 'Mã chứng từ',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.voucherCode || '---'}</span>
    ),
  },
  {
    accessorKey: 'debitAccount',
    header: 'Tài khoản Nợ',
  },
  {
    accessorKey: 'creditAccount',
    header: 'Tài khoản Có',
  },
  {
    accessorKey: 'amount',
    header: 'Số tiền',
    cell: ({ row }) => (
      <span className="font-medium">{formatCurrency(row.original.amount)}</span>
    ),
  },
  {
    accessorKey: 'description',
    header: 'Diễn giải',
    cell: ({ row }) => (
      <span className="max-w-[300px] truncate block">{row.original.description || '---'}</span>
    ),
  },
];

// ---------------------------------------------------------------------------
// GL content (default tab)
// ---------------------------------------------------------------------------

function GlContent() {
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, isLoading } = useQuery<JournalEntriesResponse>({
    queryKey: ['general-ledger', page, fromDate, toDate],
    queryFn: () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      return apiClient.get('/general-ledger/entries', { params }).then((r) => r.data);
    },
  });

  const handleReset = () => {
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="gl-fromDate">Từ ngày</Label>
          <Input
            id="gl-fromDate"
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gl-toDate">Đến ngày</Label>
          <Input
            id="gl-toDate"
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button variant="outline" onClick={handleReset}>
          Xóa lọc
        </Button>
      </div>

      <DataTable
        columns={glColumns}
        data={data?.data ?? []}
        pageCount={data?.meta?.totalPages}
        page={page}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'default', label: 'Sổ cái tổng hợp' },
  { key: 'ty-gia', label: 'Tỷ giá' },
  { key: 'tai-san', label: 'Tài sản' },
  { key: 'ngan-sach', label: 'Ngân sách' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function SoCaiPageInner() {
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

  const pageDescriptions: Record<TabKey, string> = {
    default: 'Xem bút toán sổ cái theo kỳ',
    'ty-gia': 'Quản lý tỷ giá hối đoái',
    'tai-san': 'Quản lý tài sản cố định của công ty',
    'ngan-sach': 'Theo dõi ngân sách theo phòng ban và kỳ',
  };

  return (
    <div>
      <PageHeader
        title="Sổ cái & Kế toán"
        description={pageDescriptions[activeTab]}
        infoKey="so-cai"
      />

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
      {activeTab === 'default' && <GlContent />}
      {activeTab === 'ty-gia' && <TabTyGia />}
      {activeTab === 'tai-san' && <TabTaiSan />}
      {activeTab === 'ngan-sach' && <TabNganSach />}
    </div>
  );
}

export default function SoCaiPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div>}>
      <SoCaiPageInner />
    </Suspense>
  );
}
