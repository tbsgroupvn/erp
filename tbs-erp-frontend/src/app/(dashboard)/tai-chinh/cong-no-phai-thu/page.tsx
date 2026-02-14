'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DollarSign, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useReceivables, useRecordArPayment } from '@/lib/hooks/use-finance';
import { PaymentMethod } from '@/lib/types/enums';
import { PAYMENT_METHOD_LABELS } from '@/lib/utils/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { ColumnDef } from '@tanstack/react-table';
import type { AccountReceivable } from '@/lib/types';

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
  paymentMethod: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

export default function CongNoPhaiBaiThuPage() {
  const [page, setPage] = useState(1);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payingBalance, setPayingBalance] = useState(0);
  const { data, isLoading } = useReceivables({ page, limit: 20 });
  const recordPayment = useRecordArPayment();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      reference: '',
      notes: '',
    },
  });

  const onSubmit = (formData: PaymentFormData) => {
    if (!payingId) return;
    recordPayment.mutate(
      {
        id: payingId,
        data: {
          amount: formData.amount,
          paymentMethod: formData.paymentMethod,
          reference: formData.reference || undefined,
          notes: formData.notes || undefined,
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
    form.reset({ amount: remaining, paymentMethod: PaymentMethod.BANK_TRANSFER, reference: '', notes: '' });
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
        return <span className={remaining > 0 ? 'text-red-600 font-medium' : ''}>{formatCurrency(remaining)}</span>;
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
      <PageHeader title="Công nợ phải thu" description="Quản lý công nợ phải thu từ khách hàng" />

      {/* Record Payment Form */}
      {payingId && (
        <div className="mb-6 rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Ghi nhận thanh toán</h3>
            <button
              type="button"
              onClick={() => { setPayingId(null); form.reset(); }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Số tiền còn lại: <span className="font-medium text-red-600">{formatCurrency(payingBalance)}</span>
          </p>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-sm font-medium">Số tiền thu *</label>
                <input
                  type="number"
                  {...form.register('amount')}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.amount.message}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Phương thức *</label>
                <select
                  {...form.register('paymentMethod')}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Mã tham chiếu</label>
                <input
                  {...form.register('reference')}
                  placeholder="Mã GD ngân hàng..."
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Ghi chú</label>
                <input
                  {...form.register('notes')}
                  placeholder="Ghi chú..."
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={recordPayment.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {recordPayment.isPending ? 'Đang xử lý...' : 'Ghi nhận thanh toán'}
              </button>
              <button
                type="button"
                onClick={() => { setPayingId(null); form.reset(); }}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Hủy
              </button>
            </div>
          </form>
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
