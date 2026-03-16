'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DollarSign, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { useReceivables, useRecordArPayment } from '@/lib/hooks/use-finance';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { ColumnDef } from '@tanstack/react-table';
import type { AccountReceivable } from '@/lib/types';
import dynamic from 'next/dynamic';

const TabBuTru = dynamic(
  () => import('./_components/tab-bu-tru').then((m) => m.TabBuTru),
  { loading: () => <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div> },
);

const TabChuaPhanBo = dynamic(
  () => import('./_components/tab-chua-phan-bo').then((m) => m.TabChuaPhanBo),
  { loading: () => <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div> },
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AR_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Chưa thu',
  PARTIAL: 'Thu một phần',
  PAID: 'Đã thu',
  OVERDUE: 'Quá hạn',
  NETTED: 'Đã bù trừ',
};

const AR_STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  NETTED: 'bg-slate-100 text-slate-700',
};

const paymentSchema = z.object({
  amount: z.coerce.number().min(1, 'Số tiền phải > 0'),
  reference: z.string().optional(),
  note: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'default', label: 'Công nợ phải thu' },
  { key: 'bu-tru', label: 'Bù trừ công nợ' },
  { key: 'chua-phan-bo', label: 'Chưa phân bổ' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// ---------------------------------------------------------------------------
// AR table (default tab content)
// ---------------------------------------------------------------------------

function ArContent() {
  const [page, setPage] = useState(1);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payingBalance, setPayingBalance] = useState(0);
  const { data, isLoading, error, refetch } = useReceivables({ page, limit: 20 });
  const recordPayment = useRecordArPayment();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, reference: '', note: '' },
  });

  const onSubmit = (formData: PaymentFormData) => {
    if (!payingId) return;
    recordPayment.mutate(
      {
        id: payingId,
        data: {
          amount: formData.amount,
          reference: formData.reference || undefined,
          note: formData.note || undefined,
        },
      },
      {
        onSuccess: () => {
          setPayingId(null);
          form.reset();
        },
      },
    );
  };

  if (error) {
    return <ErrorState error={error as Error} onRetry={() => void refetch()} />;
  }

  const openPayment = (ar: AccountReceivable) => {
    const remaining = ar.amount - ar.paidAmount;
    setPayingId(ar.id);
    setPayingBalance(remaining);
    form.reset({ amount: remaining, reference: '', note: '' });
  };

  const arColumns: ColumnDef<AccountReceivable>[] = [
    {
      accessorKey: 'code',
      header: 'Mã',
      cell: ({ row }) => <span className="font-medium">{row.original.code}</span>,
    },
    {
      accessorKey: 'customerId',
      header: 'Khách hàng',
    },
    {
      accessorKey: 'amount',
      header: 'Số tiền',
      cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.amount)}</span>,
    },
    {
      accessorKey: 'paidAmount',
      header: 'Đã thu',
      cell: ({ row }) => <span>{formatCurrency(row.original.paidAmount)}</span>,
    },
    {
      id: 'remaining',
      header: 'Còn lại',
      cell: ({ row }) => {
        const remaining = row.original.amount - row.original.paidAmount;
        return (
          <span className={remaining > 0 ? 'text-red-600 font-medium' : ''}>
            {formatCurrency(remaining)}
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => (
        <StatusBadge
          label={AR_STATUS_LABELS[row.original.status] || row.original.status}
          colorClass={AR_STATUS_COLORS[row.original.status] || 'bg-gray-100 text-gray-700'}
        />
      ),
    },
    {
      accessorKey: 'dueDate',
      header: 'Hạn thu',
      cell: ({ row }) => <span>{formatDate(row.original.dueDate)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const remaining = row.original.amount - row.original.paidAmount;
        if (remaining <= 0) return null;
        return (
          <button
            type="button"
            onClick={() => openPayment(row.original)}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent"
          >
            <DollarSign className="h-3.5 w-3.5" />
            Thu tiền
          </button>
        );
      },
    },
  ];

  return (
    <div>
      {payingId && (
        <div className="mb-6 section-card">
          <div className="section-card-header flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground/80">Ghi nhận thanh toán</h3>
            <button
              type="button"
              onClick={() => { setPayingId(null); form.reset(); }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Số tiền còn lại:{' '}
              <span className="font-medium text-red-600">{formatCurrency(payingBalance)}</span>
            </p>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label htmlFor="ar-payment-amount" className="text-sm font-medium">
                    Số tiền thu *
                  </label>
                  <input
                    id="ar-payment-amount"
                    type="number"
                    {...form.register('amount')}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                  {form.formState.errors.amount && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.amount.message}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="ar-payment-reference" className="text-sm font-medium">
                    Mã tham chiếu
                  </label>
                  <input
                    id="ar-payment-reference"
                    {...form.register('reference')}
                    placeholder="Mã GD ngân hàng..."
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="ar-payment-note" className="text-sm font-medium">
                    Ghi chú
                  </label>
                  <input
                    id="ar-payment-note"
                    {...form.register('note')}
                    placeholder="Ghi chú..."
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={recordPayment.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {recordPayment.isPending ? 'Đang xử lý...' : 'Ghi nhận thanh toán'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPayingId(null); form.reset(); }}
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DataTable
        columns={arColumns}
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
// Page with tab navigation
// ---------------------------------------------------------------------------

function CongNoPhaiBaiThuPageInner() {
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
      <PageHeader title="Công nợ phải thu" description="Quản lý công nợ phải thu từ khách hàng" infoKey="cong-no-phai-thu" />

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
      {activeTab === 'default' && <ArContent />}
      {activeTab === 'bu-tru' && <TabBuTru />}
      {activeTab === 'chua-phan-bo' && <TabChuaPhanBo />}
    </div>
  );
}

export default function CongNoPhaiBaiThuPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div>}>
      <CongNoPhaiBaiThuPageInner />
    </Suspense>
  );
}
