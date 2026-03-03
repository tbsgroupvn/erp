'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { voucherColumns } from '@/features/finance/voucher-table-columns';
import { useVouchers, useCreateVoucher } from '@/lib/hooks/use-finance';
import { PaymentMethod, Currency } from '@/lib/types/enums';
import { PAYMENT_METHOD_LABELS } from '@/lib/utils/constants';

const voucherSchema = z.object({
  type: z.enum(['RECEIPT', 'PAYMENT']),
  orderId: z.string().min(1, 'Bắt buộc nhập mã đơn hàng'),
  amount: z.coerce.number().min(1, 'Số tiền phải > 0'),
  currency: z.nativeEnum(Currency).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  costType: z.string().min(1, 'Bắt buộc'),
  beneficiary: z.string().min(1, 'Bắt buộc'),
  reason: z.string().min(1, 'Bắt buộc nhập lý do'),
  bankTraceId: z.string().optional(),
}).refine(
  (data) => {
    if (data.type === 'RECEIPT' && data.paymentMethod === PaymentMethod.BANK_TRANSFER) {
      return data.bankTraceId && data.bankTraceId.trim().length >= 5;
    }
    return true;
  },
  {
    message: 'Ma giao dich ngan hang bat buoc cho Phieu thu + Chuyen khoan (toi thieu 5 ky tu)',
    path: ['bankTraceId'],
  },
);

type VoucherFormData = z.infer<typeof voucherSchema>;

const COST_TYPES = [
  'Cọc đơn hàng',
  'Thanh toán đơn hàng',
  'Phí vận chuyển',
  'Phí thông quan',
  'Phí đóng gói',
  'Phí kho bãi',
  'Hoàn tiền',
  'Chi phí khác',
];

export default function PhieuThuChiPage() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const { data, isLoading } = useVouchers({ page, limit: 20 });
  const createVoucher = useCreateVoucher();

  const form = useForm<VoucherFormData>({
    resolver: zodResolver(voucherSchema),
    defaultValues: {
      type: 'RECEIPT',
      orderId: '',
      amount: 0,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      costType: '',
      beneficiary: '',
      reason: '',
      bankTraceId: '',
    },
  });

  const onSubmit = (data: VoucherFormData) => {
    createVoucher.mutate(data, {
      onSuccess: () => {
        setShowForm(false);
        form.reset();
      },
    });
  };

  return (
    <div>
      <PageHeader title="Phiếu thu chi" description="Quản lý phiếu thu và phiếu chi">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tạo phiếu
        </button>
      </PageHeader>

      {/* Create Voucher Form */}
      {showForm && (
        <div className="mb-6 rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Tạo phiếu thu/chi mới</h3>
            <button
              type="button"
              onClick={() => { setShowForm(false); form.reset(); }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Type */}
              <div>
                <label htmlFor="voucher-type" className="text-sm font-medium">Loại phiếu *</label>
                <select
                  id="voucher-type"
                  {...form.register('type')}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="RECEIPT">Phiếu thu</option>
                  <option value="PAYMENT">Phiếu chi</option>
                </select>
              </div>

              {/* Order ID */}
              <div>
                <label htmlFor="voucher-order-id" className="text-sm font-medium">Mã đơn hàng (ID) *</label>
                <input
                  id="voucher-order-id"
                  {...form.register('orderId')}
                  placeholder="Nhập ID đơn hàng"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
                {form.formState.errors.orderId && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.orderId.message}</p>
                )}
              </div>

              {/* Amount */}
              <div>
                <label htmlFor="voucher-amount" className="text-sm font-medium">Số tiền *</label>
                <input
                  id="voucher-amount"
                  type="number"
                  {...form.register('amount')}
                  placeholder="0"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.amount.message}</p>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <label htmlFor="voucher-payment-method" className="text-sm font-medium">Phương thức *</label>
                <select
                  id="voucher-payment-method"
                  {...form.register('paymentMethod')}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Bank Trace ID - shown when RECEIPT + BANK_TRANSFER */}
              {form.watch('type') === 'RECEIPT' && form.watch('paymentMethod') === PaymentMethod.BANK_TRANSFER && (
                <div>
                  <label htmlFor="voucher-bank-trace-id" className="text-sm font-medium">Mã GD ngân hàng (Trace ID) *</label>
                  <input
                    id="voucher-bank-trace-id"
                    {...form.register('bankTraceId')}
                    placeholder="VD: FT24060012345678"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                  {form.formState.errors.bankTraceId && (
                    <p className="text-xs text-destructive mt-1">{form.formState.errors.bankTraceId.message}</p>
                  )}
                </div>
              )}

              {/* Cost Type */}
              <div>
                <label htmlFor="voucher-cost-type" className="text-sm font-medium">Loại chi phí *</label>
                <select
                  id="voucher-cost-type"
                  {...form.register('costType')}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">-- Chọn --</option>
                  {COST_TYPES.map((ct) => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                </select>
                {form.formState.errors.costType && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.costType.message}</p>
                )}
              </div>

              {/* Beneficiary */}
              <div>
                <label htmlFor="voucher-beneficiary" className="text-sm font-medium">Người nhận/nộp *</label>
                <input
                  id="voucher-beneficiary"
                  {...form.register('beneficiary')}
                  placeholder="Tên người nhận hoặc nộp tiền"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
                {form.formState.errors.beneficiary && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.beneficiary.message}</p>
                )}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label htmlFor="voucher-reason" className="text-sm font-medium">Lý do *</label>
              <textarea
                id="voucher-reason"
                {...form.register('reason')}
                placeholder="Nhập lý do tạo phiếu..."
                rows={2}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
              {form.formState.errors.reason && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.reason.message}</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createVoucher.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {createVoucher.isPending ? 'Đang tạo...' : 'Tạo phiếu'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); form.reset(); }}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      <DataTable
        columns={voucherColumns}
        data={data?.data ?? []}
        pageCount={data?.meta?.totalPages}
        page={page}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </div>
  );
}
