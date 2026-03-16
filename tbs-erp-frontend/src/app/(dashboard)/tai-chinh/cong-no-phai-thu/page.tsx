'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, DollarSign, X, AlertTriangle, Clock, Flame } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  useCustomerDebtSummary,
  useCustomerDebt,
  useRecordArPayment,
} from '@/lib/hooks/use-finance';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { ColumnDef } from '@tanstack/react-table';
import type { AccountReceivable, CustomerDebtSummary } from '@/lib/types';
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

// ---------------------------------------------------------------------------
// Urgency helpers — days since order completed
// ---------------------------------------------------------------------------

type UrgencyLevel = 'critical' | 'high' | 'medium' | 'normal';

function getUrgencyLevel(days: number | null): UrgencyLevel {
  if (days === null || days < 3) return 'normal';
  if (days >= 15) return 'critical';
  if (days >= 7) return 'high';
  return 'medium';
}

const URGENCY_CONFIG: Record<UrgencyLevel, { label: string; color: string; icon: typeof Flame }> = {
  critical: { label: '15+ ngày', color: 'bg-red-100 text-red-700 ring-red-200', icon: Flame },
  high: { label: '7+ ngày', color: 'bg-orange-100 text-orange-700 ring-orange-200', icon: AlertTriangle },
  medium: { label: '3+ ngày', color: 'bg-amber-100 text-amber-700 ring-amber-200', icon: Clock },
  normal: { label: '', color: '', icon: Clock },
};

const URGENCY_FILTER_TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'critical', label: '15+ ngày', color: 'text-red-600' },
  { key: 'high', label: '7+ ngày', color: 'text-orange-600' },
  { key: 'medium', label: '3+ ngày', color: 'text-amber-600' },
] as const;

type UrgencyFilterKey = (typeof URGENCY_FILTER_TABS)[number]['key'];

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
// Customer detail view (drill-down)
// ---------------------------------------------------------------------------

interface CustomerDetailProps {
  customerId: string;
  customerName: string;
  onBack: () => void;
}

function CustomerDetail({ customerId, customerName, onBack }: CustomerDetailProps) {
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payingBalance, setPayingBalance] = useState(0);
  const { data, isLoading, error, refetch } = useCustomerDebt(customerId);
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

  const openPayment = (ar: AccountReceivable) => {
    const remaining = ar.amount - ar.paidAmount;
    setPayingId(ar.id);
    setPayingBalance(remaining);
    form.reset({ amount: remaining, reference: '', note: '' });
  };

  if (error) {
    return <ErrorState error={error as Error} onRetry={() => void refetch()} />;
  }

  const arColumns: ColumnDef<AccountReceivable>[] = [
    {
      accessorKey: 'code',
      header: 'Mã AR',
      cell: ({ row }) => <span className="font-medium">{row.original.code}</span>,
    },
    {
      id: 'orderCode',
      header: 'Mã đơn hàng',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.order?.code ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Tiền hàng',
      cell: ({ row }) => (
        <span className="font-medium">{formatCurrency(row.original.amount)}</span>
      ),
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
          <span className={cn('font-medium', remaining > 0 ? 'text-red-600' : '')}>
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
          label={AR_STATUS_LABELS[row.original.status] ?? row.original.status}
          colorClass={AR_STATUS_COLORS[row.original.status] ?? 'bg-gray-100 text-gray-700'}
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
      {/* Back navigation */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </button>
        <h2 className="text-base font-semibold">{customerName}</h2>
      </div>

      {/* Summary stat cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="section-card p-4">
            <p className="text-sm text-muted-foreground">Tổng nợ</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(data.totalDebt)}</p>
          </div>
          <div className="section-card p-4">
            <p className="text-sm text-muted-foreground">Nợ quá hạn</p>
            <p className={cn('text-xl font-bold', data.overdueDebt > 0 ? 'text-red-600' : 'text-foreground')}>
              {formatCurrency(data.overdueDebt)}
            </p>
          </div>
          <div className="section-card p-4">
            <p className="text-sm text-muted-foreground">Số phiếu AR</p>
            <p className="text-xl font-bold">{data.receivablesCount}</p>
          </div>
        </div>
      )}

      {/* Payment form */}
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

      {/* AR records table */}
      <DataTable
        columns={arColumns}
        data={data?.receivables ?? []}
        isLoading={isLoading}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customer summary list (main view)
// ---------------------------------------------------------------------------

interface ArContentProps {
  onSelectCustomer: (id: string, name: string) => void;
}

function ArContent({ onSelectCustomer }: ArContentProps) {
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilterKey>('all');
  const { data, isLoading, error, refetch } = useCustomerDebtSummary();

  if (error) {
    return <ErrorState error={error as Error} onRetry={() => void refetch()} />;
  }

  // Filter by urgency
  const filteredData = (data ?? []).filter((item) => {
    if (urgencyFilter === 'all') return true;
    return getUrgencyLevel(item.maxDaysSinceCompletion) === urgencyFilter;
  });

  // Count per urgency level for badge counts
  const urgencyCounts = (data ?? []).reduce(
    (acc, item) => {
      const level = getUrgencyLevel(item.maxDaysSinceCompletion);
      if (level !== 'normal') acc[level] = (acc[level] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const summaryColumns: ColumnDef<CustomerDebtSummary>[] = [
    {
      id: 'urgency',
      header: 'Thu hồi',
      cell: ({ row }) => {
        const days = row.original.maxDaysSinceCompletion;
        const level = getUrgencyLevel(days);
        if (level === 'normal') return <span className="text-muted-foreground text-xs">—</span>;
        const config = URGENCY_CONFIG[level];
        const Icon = config.icon;
        return (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1', config.color)}>
            <Icon className="h-3 w-3" />
            {config.label}
          </span>
        );
      },
    },
    {
      accessorKey: 'customerCode',
      header: 'Mã KH',
      cell: ({ row }) => <span className="font-medium">{row.original.customerCode}</span>,
    },
    {
      accessorKey: 'customerName',
      header: 'Tên khách hàng',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => onSelectCustomer(row.original.customerId, row.original.customerName)}
          className="text-left font-medium text-primary hover:underline"
        >
          {row.original.customerName}
        </button>
      ),
    },
    {
      accessorKey: 'companyName',
      header: 'Công ty',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.companyName ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'totalDebt',
      header: 'Tổng nợ',
      cell: ({ row }) => (
        <span className="font-semibold text-red-600">
          {formatCurrency(row.original.totalDebt)}
        </span>
      ),
    },
    {
      accessorKey: 'overdueDebt',
      header: 'Nợ quá hạn',
      cell: ({ row }) => (
        <span className={cn('font-medium', row.original.overdueDebt > 0 ? 'text-red-600' : 'text-muted-foreground')}>
          {row.original.overdueDebt > 0 ? formatCurrency(row.original.overdueDebt) : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'arCount',
      header: 'Số phiếu AR',
      cell: ({ row }) => <span>{row.original.arCount}</span>,
    },
    {
      accessorKey: 'oldestDueDate',
      header: 'Hạn cũ nhất',
      cell: ({ row }) => (
        <span className={cn(row.original.overdueDebt > 0 ? 'text-red-600' : '')}>
          {row.original.oldestDueDate ? formatDate(row.original.oldestDueDate) : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => onSelectCustomer(row.original.customerId, row.original.customerName)}
          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent whitespace-nowrap"
        >
          Xem chi tiết
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Urgency filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {URGENCY_FILTER_TABS.map((tab) => {
          const count = tab.key === 'all' ? (data ?? []).length : (urgencyCounts[tab.key] ?? 0);
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setUrgencyFilter(tab.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ring-1',
                urgencyFilter === tab.key
                  ? 'bg-primary text-primary-foreground ring-primary shadow-sm'
                  : 'bg-card text-muted-foreground ring-border hover:bg-accent hover:text-foreground',
              )}
            >
              {tab.label}
              <span className={cn(
                'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                urgencyFilter === tab.key
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <DataTable
        columns={summaryColumns}
        data={filteredData}
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

  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const setTab = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'default') params.delete('tab');
    else params.set('tab', tab);
    router.push(`${pathname}?${params.toString()}`);
    // Clear drill-down when switching tabs
    setSelectedCustomer(null);
  };

  const handleSelectCustomer = (id: string, name: string) => {
    setSelectedCustomer({ id, name });
  };

  const handleBack = () => {
    setSelectedCustomer(null);
  };

  return (
    <div>
      <PageHeader
        title="Công nợ phải thu"
        description="Quản lý công nợ phải thu từ khách hàng"
        infoKey="cong-no-phai-thu"
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
      {activeTab === 'default' && (
        selectedCustomer ? (
          <CustomerDetail
            customerId={selectedCustomer.id}
            customerName={selectedCustomer.name}
            onBack={handleBack}
          />
        ) : (
          <ArContent onSelectCustomer={handleSelectCustomer} />
        )
      )}
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
