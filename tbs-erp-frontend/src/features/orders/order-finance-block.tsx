'use client';

import { useState, type FormEvent } from 'react';
import { DollarSign, TrendingUp, CreditCard, Percent, Receipt, Plus, CheckCircle, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { PAYMENT_METHOD_LABELS } from '@/lib/utils/constants';
import { apiClient } from '@/lib/api/client';
import type { MasterOrder, PaymentMethod } from '@/lib/types';
import type { SupplierOrder } from '@/lib/types';
import type { Currency } from '@/lib/types/enums';
import { InfoTooltip } from '@/components/shared/info-tooltip';

interface PaymentAllocation {
  id: string;
  voucherCode?: string;
  code?: string;
  paidAt?: string;
  createdAt: string;
  method?: string;
  amount: number;
  currency?: Currency;
  note?: string;
}

interface ProcurementPayment {
  id: string;
  code: string;
  createdAt: string;
  beneficiary?: string;
  amount: number;
  currency?: Currency;
  status: string;
  approvedBy?: string;
}

const APPROVAL_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

interface OrderFinanceBlockProps {
  order: MasterOrder & {
    finance?: {
      totalAmount?: number;
      totalPaid?: number;
      totalDebt?: number;
      estimatedProfit?: number;
      paymentAllocations?: PaymentAllocation[];
      exchangeRate?: ExchangeRateInfo | number;
      commission?: CommissionInfo;
      procurementPayments?: ProcurementPayment[];
      totalProcurementPaid?: number;
      totalProcurementAmount?: number;
    };
    totalAmount?: number;
    totalPaid?: number;
    estimatedProfit?: number;
    paymentAllocations?: PaymentAllocation[];
    exchangeRate?: ExchangeRateInfo | number;
    commission?: CommissionInfo;
    supplierOrders?: SupplierOrder[];
    goods?: {
      supplierOrders?: SupplierOrder[];
    };
    documents?: unknown[];
  };
}

interface ExchangeRateInfo {
  rate?: number;
  cnyToVnd?: number;
  appliedAt?: string;
}

interface CommissionInfo {
  rate?: number;
  percent?: number;
  amount: number;
  saleName?: string;
}

export function OrderFinanceBlock({ order }: OrderFinanceBlockProps) {
  const finance = order.finance || {};
  const totalAmount = finance.totalAmount ?? order.totalAmount ?? 0;
  const totalPaid = finance.totalPaid ?? order.totalPaid ?? 0;
  const totalDebt = finance.totalDebt ?? (totalAmount - totalPaid);
  const estimatedProfit = finance.estimatedProfit ?? order.estimatedProfit ?? 0;
  const paymentAllocations = finance.paymentAllocations || order.paymentAllocations || [];
  const exchangeRate = finance.exchangeRate ?? order.exchangeRate;
  const commission = finance.commission ?? order.commission;
  const procurementPayments = finance.procurementPayments || [];
  const totalProcurementPaid = finance.totalProcurementPaid ?? 0;
  const totalProcurementAmount = finance.totalProcurementAmount ?? 0;
  const supplierOrders = order.goods?.supplierOrders || order.supplierOrders || [];

  const [showVoucherForm, setShowVoucherForm] = useState(false);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              Tổng tiền
            </span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-green-600" />
            <span className="text-sm text-muted-foreground">Đã thu</span>
          </div>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-orange-600" />
            <span className="text-sm text-muted-foreground">Còn nợ</span>
          </div>
          <p className={`text-xl font-bold ${totalDebt > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {formatCurrency(totalDebt)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-muted-foreground">Lợi nhuận dự kiến</span>
          </div>
          <p className={`text-xl font-bold ${estimatedProfit >= 0 ? 'text-blue-600' : 'text-destructive'}`}>
            {formatCurrency(estimatedProfit)}
          </p>
        </div>
      </div>

      {/* Payment Allocations Table */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Chi tiết thanh toán</h3>
        {paymentAllocations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Mã phiếu</th>
                  <th className="pb-2 font-medium">Ngày</th>
                  <th className="pb-2 font-medium">Phương thức</th>
                  <th className="pb-2 font-medium text-right">Số tiền</th>
                  <th className="pb-2 font-medium">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {paymentAllocations.map((allocation: PaymentAllocation) => (
                  <tr key={allocation.id} className="border-b">
                    <td className="py-2 font-medium">{allocation.voucherCode || allocation.code || '---'}</td>
                    <td className="py-2">{formatDateTime(allocation.paidAt || allocation.createdAt)}</td>
                    <td className="py-2">
                      {PAYMENT_METHOD_LABELS[allocation.method as PaymentMethod] || allocation.method || '---'}
                    </td>
                    <td className="py-2 text-right font-medium text-green-600">
                      {formatCurrency(allocation.amount, allocation.currency)}
                    </td>
                    <td className="py-2 text-muted-foreground">{allocation.note || '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa có thanh toán nào</p>
        )}
      </div>

      {/* Procurement Payments - Purchase History */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Lịch sử chi tiền NCC
          </h3>
          {supplierOrders.length > 0 && (
            <button
              type="button"
              onClick={() => setShowVoucherForm(!showVoucherForm)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              Tạo phiếu chi NCC
            </button>
          )}
        </div>

        {/* Progress bar */}
        {totalProcurementAmount > 0 && (
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Đã chi: {formatCurrency(totalProcurementPaid)}
              </span>
              <span className="text-muted-foreground">
                Tổng mua hàng: {formatCurrency(totalProcurementAmount)}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{
                  width: `${Math.min(100, totalProcurementAmount > 0 ? (totalProcurementPaid / totalProcurementAmount) * 100 : 0)}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {totalProcurementAmount > 0
                ? `${((totalProcurementPaid / totalProcurementAmount) * 100).toFixed(1)}%`
                : '0%'}
            </p>
          </div>
        )}

        {/* NCC Voucher Creation Form */}
        {showVoucherForm && (
          <CreateProcurementVoucherForm
            orderId={order.sale?.id || order.id}
            supplierOrders={supplierOrders}
            onClose={() => setShowVoucherForm(false)}
          />
        )}

        {/* Procurement Payments Table */}
        {procurementPayments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Mã phiếu chi</th>
                  <th className="pb-2 font-medium">Ngày</th>
                  <th className="pb-2 font-medium">NCC</th>
                  <th className="pb-2 font-medium text-right">Số tiền</th>
                  <th className="pb-2 font-medium">Trạng thái</th>
                  <th className="pb-2 font-medium">Người duyệt</th>
                </tr>
              </thead>
              <tbody>
                {procurementPayments.map((pv: ProcurementPayment) => (
                  <tr key={pv.id} className="border-b">
                    <td className="py-2 font-medium">{pv.code}</td>
                    <td className="py-2">{formatDateTime(pv.createdAt)}</td>
                    <td className="py-2">{pv.beneficiary || '---'}</td>
                    <td className="py-2 text-right font-medium text-red-600">
                      {formatCurrency(pv.amount, pv.currency)}
                    </td>
                    <td className="py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${APPROVAL_STATUS_COLORS[pv.status] || 'bg-gray-100 text-gray-700'}`}>
                        {pv.status === 'APPROVED' && <CheckCircle className="h-3 w-3" />}
                        {pv.status === 'PENDING' && <Clock className="h-3 w-3" />}
                        {pv.status === 'REJECTED' && <XCircle className="h-3 w-3" />}
                        {APPROVAL_STATUS_LABELS[pv.status] || pv.status}
                      </span>
                    </td>
                    <td className="py-2 text-muted-foreground">{pv.approvedBy || '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa có phiếu chi NCC nào</p>
        )}
      </div>

      {/* Exchange Rate & Commission */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Exchange Rate */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Tỷ giá
            <InfoTooltip tipKey="exchange-rate" />
          </h3>
          {exchangeRate ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">CNY/VND</dt>
                <dd className="font-medium">
                  {typeof exchangeRate === 'object'
                    ? formatCurrency(exchangeRate.rate || exchangeRate.cnyToVnd)
                    : formatCurrency(exchangeRate)}
                </dd>
              </div>
              {typeof exchangeRate === 'object' && exchangeRate.appliedAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Áp dụng lúc</dt>
                  <dd>{formatDateTime(exchangeRate.appliedAt)}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có thông tin tỷ giá</p>
          )}
        </div>

        {/* Commission */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Hoa hồng
          </h3>
          {commission ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">% Hoa hồng</dt>
                <dd className="font-medium">{commission.rate ?? commission.percent ?? '---'}%</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Số tiền</dt>
                <dd className="font-medium">{formatCurrency(commission.amount)}</dd>
              </div>
              {commission.saleName && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Nhân viên</dt>
                  <dd>{commission.saleName}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có thông tin hoa hồng</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Procurement Voucher Form (inline)
// ---------------------------------------------------------------------------

interface CreateVoucherPayload {
  type: string;
  orderId: string;
  supplierOrderId: string;
  amount: number;
  reason: string;
  beneficiary: string;
  costType: string;
  paymentMethod: string;
}

function CreateProcurementVoucherForm({
  orderId,
  supplierOrders,
  onClose,
}: {
  orderId: string;
  supplierOrders: SupplierOrder[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    supplierOrderId: supplierOrders[0]?.id || '',
    amount: '',
    reason: '',
    beneficiary: '',
    costType: 'Thanh toán NCC',
    paymentMethod: 'BANK_TRANSFER',
  });

  const createVoucher = useMutation({
    mutationFn: (data: CreateVoucherPayload) => apiClient.post('/cash/vouchers', data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Tạo phiếu chi NCC thành công');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onClose();
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error?.response?.data?.message || 'Lỗi tạo phiếu chi');
    },
  });

  const selectedSO = supplierOrders.find((so) => so.id === formData.supplierOrderId);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.supplierOrderId || !formData.amount || !formData.reason || !formData.beneficiary) return;
    if (formData.reason.length < 20) {
      toast.error('Lý do phải có ít nhất 20 ký tự');
      return;
    }

    createVoucher.mutate({
      type: 'PAYMENT',
      orderId,
      supplierOrderId: formData.supplierOrderId,
      amount: Number(formData.amount),
      reason: formData.reason,
      beneficiary: formData.beneficiary,
      costType: formData.costType,
      paymentMethod: formData.paymentMethod,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4 space-y-3">
      <h4 className="text-sm font-semibold text-blue-800">Tạo phiếu chi NCC</h4>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="flex items-center gap-1 text-xs font-medium text-blue-800">
            Đơn đặt NCC
            <InfoTooltip tipKey="supplier-order" />
          </p>
          <select
            value={formData.supplierOrderId}
            onChange={(e) => setFormData({ ...formData, supplierOrderId: e.target.value })}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white"
          >
            {supplierOrders.map((so) => (
              <option key={so.id} value={so.id}>
                {so.code} - {so.supplierName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs font-medium text-blue-800">Số tiền</p>
          <input
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            placeholder={selectedSO?.totalCNY ? `Tổng NCC: ${selectedSO.totalCNY} CNY` : 'Nhập số tiền'}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white"
            min="1"
            required
          />
        </div>
        <div>
          <p className="text-xs font-medium text-blue-800">Người thụ hưởng</p>
          <input
            type="text"
            value={formData.beneficiary}
            onChange={(e) => setFormData({ ...formData, beneficiary: e.target.value })}
            placeholder={selectedSO?.supplierName || 'Tên NCC'}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white"
            required
          />
        </div>
        <div>
          <p className="text-xs font-medium text-blue-800">Phương thức</p>
          <select
            value={formData.paymentMethod}
            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white"
          >
            <option value="BANK_TRANSFER">Chuyển khoản</option>
            <option value="CASH">Tiền mặt</option>
            <option value="WALLET">Ví điện tử</option>
          </select>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-blue-800">Lý do (tối thiểu 20 ký tự)</p>
        <textarea
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          placeholder="Thanh toán tiền hàng cho NCC..."
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white"
          rows={2}
          required
          minLength={20}
        />
      </div>

      {/* Approval Flow Timeline */}
      <div className="rounded-md bg-white/50 p-3">
        <p className="text-xs font-medium text-blue-800 mb-2">Luồng duyệt 4 cấp:</p>
        <div className="flex items-center gap-1 text-xs">
          <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-700">Tạo</span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded bg-yellow-100 px-2 py-0.5 text-yellow-700">Leader</span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded bg-purple-100 px-2 py-0.5 text-purple-700">Kế toán</span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">Giám đốc</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={createVoucher.isPending}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {createVoucher.isPending ? 'Đang tạo...' : 'Tạo phiếu chi'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border px-4 py-1.5 text-xs font-medium hover:bg-accent"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
