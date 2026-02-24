'use client';

import { useState } from 'react';
import { DollarSign, TrendingUp, CreditCard, Percent, Receipt, Plus, CheckCircle, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { PAYMENT_METHOD_LABELS } from '@/lib/utils/constants';
import { apiClient } from '@/lib/api/client';
import type { PaymentMethod } from '@/lib/types';

const APPROVAL_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Cho duyet',
  APPROVED: 'Da duyet',
  REJECTED: 'Tu choi',
};

interface OrderFinanceBlockProps {
  order: any;
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
            <span className="text-sm text-muted-foreground">Tong tien</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-green-600" />
            <span className="text-sm text-muted-foreground">Da thu</span>
          </div>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-orange-600" />
            <span className="text-sm text-muted-foreground">Con no</span>
          </div>
          <p className={`text-xl font-bold ${totalDebt > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {formatCurrency(totalDebt)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-muted-foreground">Loi nhuan du kien</span>
          </div>
          <p className={`text-xl font-bold ${estimatedProfit >= 0 ? 'text-blue-600' : 'text-destructive'}`}>
            {formatCurrency(estimatedProfit)}
          </p>
        </div>
      </div>

      {/* Payment Allocations Table */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Chi tiet thanh toan</h3>
        {paymentAllocations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Ma phieu</th>
                  <th className="pb-2 font-medium">Ngay</th>
                  <th className="pb-2 font-medium">Phuong thuc</th>
                  <th className="pb-2 font-medium text-right">So tien</th>
                  <th className="pb-2 font-medium">Ghi chu</th>
                </tr>
              </thead>
              <tbody>
                {paymentAllocations.map((allocation: any) => (
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
          <p className="text-sm text-muted-foreground">Chua co thanh toan nao</p>
        )}
      </div>

      {/* Procurement Payments - Purchase History */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Lich su chi tien NCC
          </h3>
          {supplierOrders.length > 0 && (
            <button
              type="button"
              onClick={() => setShowVoucherForm(!showVoucherForm)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              Tao phieu chi NCC
            </button>
          )}
        </div>

        {/* Progress bar */}
        {totalProcurementAmount > 0 && (
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Da chi: {formatCurrency(totalProcurementPaid)}
              </span>
              <span className="text-muted-foreground">
                Tong mua hang: {formatCurrency(totalProcurementAmount)}
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
                  <th className="pb-2 font-medium">Ma phieu chi</th>
                  <th className="pb-2 font-medium">Ngay</th>
                  <th className="pb-2 font-medium">NCC</th>
                  <th className="pb-2 font-medium text-right">So tien</th>
                  <th className="pb-2 font-medium">Trang thai</th>
                  <th className="pb-2 font-medium">Nguoi duyet</th>
                </tr>
              </thead>
              <tbody>
                {procurementPayments.map((pv: any) => (
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
          <p className="text-sm text-muted-foreground">Chua co phieu chi NCC nao</p>
        )}
      </div>

      {/* Exchange Rate & Commission */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Exchange Rate */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Ty gia
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
              {exchangeRate.appliedAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Ap dung luc</dt>
                  <dd>{formatDateTime(exchangeRate.appliedAt)}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Chua co thong tin ty gia</p>
          )}
        </div>

        {/* Commission */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Hoa hong
          </h3>
          {commission ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">% Hoa hong</dt>
                <dd className="font-medium">{commission.rate ?? commission.percent ?? '---'}%</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">So tien</dt>
                <dd className="font-medium">{formatCurrency(commission.amount)}</dd>
              </div>
              {commission.saleName && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Nhan vien</dt>
                  <dd>{commission.saleName}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Chua co thong tin hoa hong</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Procurement Voucher Form (inline)
// ---------------------------------------------------------------------------

function CreateProcurementVoucherForm({
  orderId,
  supplierOrders,
  onClose,
}: {
  orderId: string;
  supplierOrders: any[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    supplierOrderId: supplierOrders[0]?.id || '',
    amount: '',
    reason: '',
    beneficiary: '',
    costType: 'Thanh toan NCC',
    paymentMethod: 'BANK_TRANSFER',
  });

  const createVoucher = useMutation({
    mutationFn: (data: any) => apiClient.post('/cash/vouchers', data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Tao phieu chi NCC thanh cong');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Loi tao phieu chi');
    },
  });

  const selectedSO = supplierOrders.find((so: any) => so.id === formData.supplierOrderId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplierOrderId || !formData.amount || !formData.reason || !formData.beneficiary) return;
    if (formData.reason.length < 20) {
      toast.error('Ly do phai co it nhat 20 ky tu');
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
      <h4 className="text-sm font-semibold text-blue-800">Tao phieu chi NCC</h4>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-blue-800">Don dat NCC</label>
          <select
            value={formData.supplierOrderId}
            onChange={(e) => setFormData({ ...formData, supplierOrderId: e.target.value })}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white"
          >
            {supplierOrders.map((so: any) => (
              <option key={so.id} value={so.id}>
                {so.code} - {so.supplierName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-blue-800">So tien</label>
          <input
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            placeholder={selectedSO?.totalCNY ? `Tong NCC: ${selectedSO.totalCNY} CNY` : 'Nhap so tien'}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white"
            min="1"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium text-blue-800">Nguoi thu huong</label>
          <input
            type="text"
            value={formData.beneficiary}
            onChange={(e) => setFormData({ ...formData, beneficiary: e.target.value })}
            placeholder={selectedSO?.supplierName || 'Ten NCC'}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium text-blue-800">Phuong thuc</label>
          <select
            value={formData.paymentMethod}
            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white"
          >
            <option value="BANK_TRANSFER">Chuyen khoan</option>
            <option value="CASH">Tien mat</option>
            <option value="WALLET">Vi dien tu</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-blue-800">Ly do (toi thieu 20 ky tu)</label>
        <textarea
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          placeholder="Thanh toan tien hang cho NCC..."
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white"
          rows={2}
          required
          minLength={20}
        />
      </div>

      {/* Approval Flow Timeline */}
      <div className="rounded-md bg-white/50 p-3">
        <p className="text-xs font-medium text-blue-800 mb-2">Luong duyet 4 cap:</p>
        <div className="flex items-center gap-1 text-xs">
          <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-700">Tao</span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded bg-yellow-100 px-2 py-0.5 text-yellow-700">Leader</span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded bg-purple-100 px-2 py-0.5 text-purple-700">Ke toan</span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">Giam doc</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={createVoucher.isPending}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {createVoucher.isPending ? 'Dang tao...' : 'Tao phieu chi'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border px-4 py-1.5 text-xs font-medium hover:bg-accent"
        >
          Huy
        </button>
      </div>
    </form>
  );
}
