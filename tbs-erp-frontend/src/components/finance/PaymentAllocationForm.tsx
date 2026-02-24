/**
 * Payment Allocation Form Component
 *
 * Form phân bổ thanh toán cho hệ thống ERP - bắt buộc chỉ định
 * từng khoản tiền được phân bổ vào hợp đồng/đơn hàng nào.
 *
 * Features:
 * - Mandatory allocation table (không cho phép "ví tổng")
 * - Dynamic rows với validation realtime
 * - Search dropdown cho Contract/Order
 * - Vietnamese error messages
 * - Responsive design with Tailwind CSS
 */

import React, { useState } from 'react';
import { Search, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// TYPE DEFINITIONS
// ============================================

type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'E_WALLET';
type TargetType = 'CONTRACT' | 'ORDER';
type PurposeType = 'DEPOSIT' | 'SETTLEMENT' | 'INSTALLMENT';
type Currency = 'VND' | 'USD' | 'CNY';

interface ContractOption {
  id: string;
  code: string;
  title: string;
  totalValue: number;
  paidAmount: number;
  customerId: string;
  customerName: string;
}

interface OrderOption {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  depositPaid: number;
  status: string;
}

interface AllocationRow {
  id: string;
  targetType: TargetType | '';
  targetId: string;
  targetCode: string;
  targetName: string;
  amount: string;
  purposeType: PurposeType | '';
  note?: string;
}

interface PaymentVoucherFormData {
  amount: string;
  currency: Currency;
  paymentMethod: PaymentMethod | '';
  beneficiary: string;
  reason: string;
  allocations: AllocationRow[];
}

interface ValidationErrors {
  amount?: string;
  paymentMethod?: string;
  beneficiary?: string;
  reason?: string;
  allocations?: string;
  totalMismatch?: string;
}

// ============================================
// MOCK DATA (Replace with API calls)
// ============================================

const mockContracts: ContractOption[] = [
  {
    id: 'ct-001',
    code: 'HĐ-NV001-2025-001',
    title: 'Hợp đồng vận chuyển hàng hóa Q1/2025',
    totalValue: 500000000,
    paidAmount: 200000000,
    customerId: 'cust-001',
    customerName: 'Công ty TNHH ABC'
  },
  {
    id: 'ct-002',
    code: 'HĐ-NV002-2025-002',
    title: 'Hợp đồng mua hàng hộ tháng 2',
    totalValue: 300000000,
    paidAmount: 100000000,
    customerId: 'cust-002',
    customerName: 'Công ty CP XYZ'
  },
];

const mockOrders: OrderOption[] = [
  {
    id: 'ord-001',
    code: 'TBS-ORD-250101-0001',
    customerId: 'cust-001',
    customerName: 'Công ty TNHH ABC',
    totalAmount: 50000000,
    depositPaid: 15000000,
    status: 'PENDING_DEPOSIT'
  },
  {
    id: 'ord-002',
    code: 'TBS-ORD-250101-0002',
    customerId: 'cust-003',
    customerName: 'Công ty TNHH DEF',
    totalAmount: 80000000,
    depositPaid: 40000000,
    status: 'SOURCING'
  },
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  }).format(amount);
};

const parseCurrency = (str: string): number => {
  return parseFloat(str.replace(/[^\d.-]/g, '')) || 0;
};

const generateId = (): string => {
  return `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================
// MAIN COMPONENT
// ============================================

export const PaymentAllocationForm: React.FC = () => {
  // Form state
  const [formData, setFormData] = useState<PaymentVoucherFormData>({
    amount: '',
    currency: 'VND',
    paymentMethod: '',
    beneficiary: '',
    reason: '',
    allocations: [
      {
        id: generateId(),
        targetType: '',
        targetId: '',
        targetCode: '',
        targetName: '',
        amount: '',
        purposeType: '',
      },
    ],
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate total allocated
  const totalAllocated = formData.allocations.reduce(
    (sum, row) => sum + parseCurrency(row.amount),
    0
  );

  const totalAmount = parseCurrency(formData.amount);
  const allocationComplete = Math.abs(totalAllocated - totalAmount) < 0.01 && totalAmount > 0;

  // ============================================
  // VALIDATION
  // ============================================

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Amount
    if (!formData.amount || parseCurrency(formData.amount) <= 0) {
      newErrors.amount = 'Vui lòng nhập số tiền hợp lệ';
    }

    // Payment method
    if (!formData.paymentMethod) {
      newErrors.paymentMethod = 'Vui lòng chọn hình thức thanh toán';
    }

    // Beneficiary
    if (!formData.beneficiary.trim()) {
      newErrors.beneficiary = 'Vui lòng nhập người thụ hưởng';
    }

    // Reason (minimum 20 characters)
    if (formData.reason.trim().length < 20) {
      newErrors.reason = 'Lý do phải có tối thiểu 20 ký tự';
    }

    // Allocations
    const hasEmptyAllocations = formData.allocations.some(
      (row) =>
        !row.targetType ||
        !row.targetId ||
        !row.purposeType ||
        parseCurrency(row.amount) <= 0
    );

    if (hasEmptyAllocations) {
      newErrors.allocations = 'Vui lòng điền đầy đủ thông tin phân bổ';
    }

    // Total mismatch
    if (Math.abs(totalAllocated - totalAmount) >= 0.01) {
      newErrors.totalMismatch = `Tổng phân bổ (${formatCurrency(totalAllocated)}) phải bằng số tiền thu (${formatCurrency(totalAmount)})`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================
  // EVENT HANDLERS
  // ============================================

  const handleAmountChange = (value: string) => {
    // Allow only numbers and decimal point
    const sanitized = value.replace(/[^\d.]/g, '');
    setFormData({ ...formData, amount: sanitized });
  };

  const addAllocationRow = () => {
    setFormData({
      ...formData,
      allocations: [
        ...formData.allocations,
        {
          id: generateId(),
          targetType: '',
          targetId: '',
          targetCode: '',
          targetName: '',
          amount: '',
          purposeType: '',
        },
      ],
    });
  };

  const removeAllocationRow = (id: string) => {
    if (formData.allocations.length === 1) return; // Keep at least 1 row
    setFormData({
      ...formData,
      allocations: formData.allocations.filter((row) => row.id !== id),
    });
  };

  const updateAllocationRow = (
    id: string,
    field: keyof AllocationRow,
    value: string
  ) => {
    setFormData({
      ...formData,
      allocations: formData.allocations.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      ),
    });
  };

  const handleTargetSelect = (
    rowId: string,
    targetType: TargetType,
    selectedId: string
  ) => {
    const target =
      targetType === 'CONTRACT'
        ? mockContracts.find((c) => c.id === selectedId)
        : mockOrders.find((o) => o.id === selectedId);

    if (target) {
      setFormData(prev => ({
        ...prev,
        allocations: prev.allocations.map(row =>
          row.id === rowId
            ? {
                ...row,
                targetType,
                targetId: selectedId,
                targetCode: target.code,
                targetName: 'title' in target ? target.title : `Đơn hàng ${target.code}`,
              }
            : row
        ),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // API call here
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast.success('Phieu thu da duoc tao thanh cong!');
      // Reset form or redirect
    } catch (error) {
      console.error('Payment error:', (error as Error)?.message);
      toast.error('Co loi xay ra khi tao phieu thu');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            Tạo Phiếu Thu & Phân Bổ Thanh Toán
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Bắt buộc chỉ định từng khoản tiền được phân bổ vào hợp đồng hoặc đơn hàng cụ thể
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Payment Information Card */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-medium text-slate-900">
              Thông Tin Thanh Toán
            </h2>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Amount */}
              <div>
                <label
                  htmlFor="amount"
                  className="block text-sm font-medium text-slate-700"
                >
                  Số tiền thu <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    id="amount"
                    value={formData.amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0"
                    className={`block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.amount
                        ? 'border-red-300 focus:border-red-500'
                        : 'border-slate-300'
                    }`}
                  />
                  <span className="absolute right-3 top-2.5 text-sm text-slate-500">
                    VND
                  </span>
                </div>
                {errors.amount && (
                  <p className="mt-1 flex items-center text-sm text-red-600">
                    <AlertCircle className="mr-1 h-4 w-4" />
                    {errors.amount}
                  </p>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <label
                  htmlFor="paymentMethod"
                  className="block text-sm font-medium text-slate-700"
                >
                  Hình thức thanh toán <span className="text-red-500">*</span>
                </label>
                <select
                  id="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      paymentMethod: e.target.value as PaymentMethod,
                    })
                  }
                  className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.paymentMethod
                      ? 'border-red-300 focus:border-red-500'
                      : 'border-slate-300'
                  }`}
                >
                  <option value="">-- Chọn hình thức --</option>
                  <option value="CASH">Tiền mặt</option>
                  <option value="BANK_TRANSFER">Chuyển khoản</option>
                  <option value="CREDIT_CARD">Thẻ tín dụng</option>
                  <option value="E_WALLET">Ví điện tử</option>
                </select>
                {errors.paymentMethod && (
                  <p className="mt-1 flex items-center text-sm text-red-600">
                    <AlertCircle className="mr-1 h-4 w-4" />
                    {errors.paymentMethod}
                  </p>
                )}
              </div>

              {/* Beneficiary */}
              <div>
                <label
                  htmlFor="beneficiary"
                  className="block text-sm font-medium text-slate-700"
                >
                  Người thụ hưởng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="beneficiary"
                  value={formData.beneficiary}
                  onChange={(e) =>
                    setFormData({ ...formData, beneficiary: e.target.value })
                  }
                  placeholder="Tên khách hàng hoặc công ty"
                  className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.beneficiary
                      ? 'border-red-300 focus:border-red-500'
                      : 'border-slate-300'
                  }`}
                />
                {errors.beneficiary && (
                  <p className="mt-1 flex items-center text-sm text-red-600">
                    <AlertCircle className="mr-1 h-4 w-4" />
                    {errors.beneficiary}
                  </p>
                )}
              </div>

              {/* Reason */}
              <div>
                <label
                  htmlFor="reason"
                  className="block text-sm font-medium text-slate-700"
                >
                  Lý do thu tiền <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  placeholder="Mô tả chi tiết lý do thu tiền (tối thiểu 20 ký tự)"
                  rows={3}
                  className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.reason
                      ? 'border-red-300 focus:border-red-500'
                      : 'border-slate-300'
                  }`}
                />
                <p className="mt-1 text-xs text-slate-500">
                  {formData.reason.length}/20 ký tự tối thiểu
                </p>
                {errors.reason && (
                  <p className="mt-1 flex items-center text-sm text-red-600">
                    <AlertCircle className="mr-1 h-4 w-4" />
                    {errors.reason}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Allocation Table Card */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-slate-900">
                  Phân Bổ Thanh Toán <span className="text-red-500">*</span>
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Chỉ định rõ từng khoản tiền được phân bổ vào hợp đồng hoặc đơn hàng nào
                </p>
              </div>
              <button
                type="button"
                onClick={addAllocationRow}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <Plus className="h-4 w-4" />
                Thêm dòng
              </button>
            </div>

            {errors.allocations && (
              <div className="mb-4 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                {errors.allocations}
              </div>
            )}

            {/* Allocation Rows */}
            <div className="space-y-4">
              {formData.allocations.map((row, index) => (
                <AllocationRow
                  key={row.id}
                  row={row}
                  index={index}
                  onUpdate={updateAllocationRow}
                  onRemove={removeAllocationRow}
                  onTargetSelect={handleTargetSelect}
                  canRemove={formData.allocations.length > 1}
                />
              ))}
            </div>

            {/* Total Summary */}
            <div className="mt-6 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                  Tổng phân bổ:
                </span>
                <span className="text-lg font-semibold text-slate-900">
                  {formatCurrency(totalAllocated)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                  Số tiền thu:
                </span>
                <span className="text-lg font-semibold text-slate-900">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="text-sm font-medium text-slate-700">
                  Trạng thái:
                </span>
                {allocationComplete ? (
                  <span className="flex items-center gap-2 text-sm font-medium text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    Phân bổ chính xác
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-sm font-medium text-amber-600">
                    <AlertCircle className="h-5 w-5" />
                    Chưa khớp (còn {formatCurrency(Math.abs(totalAmount - totalAllocated))})
                  </span>
                )}
              </div>
              {errors.totalMismatch && (
                <p className="mt-2 flex items-center text-sm text-red-600">
                  <AlertCircle className="mr-1 h-4 w-4" />
                  {errors.totalMismatch}
                </p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="rounded-md border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !allocationComplete}
              className="rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Đang xử lý...' : 'Tạo phiếu thu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// ALLOCATION ROW SUB-COMPONENT
// ============================================

interface AllocationRowProps {
  row: AllocationRow;
  index: number;
  onUpdate: (id: string, field: keyof AllocationRow, value: string) => void;
  onRemove: (id: string) => void;
  onTargetSelect: (rowId: string, targetType: TargetType, targetId: string) => void;
  canRemove: boolean;
}

const AllocationRow: React.FC<AllocationRowProps> = ({
  row,
  index,
  onUpdate,
  onRemove,
  onTargetSelect,
  canRemove,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTargets =
    row.targetType === 'CONTRACT'
      ? mockContracts.filter(
          (c) =>
            c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : row.targetType === 'ORDER'
      ? mockOrders.filter(
          (o) =>
            o.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.customerName.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : [];

  return (
    <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-12">
      {/* Row Number */}
      <div className="flex items-center sm:col-span-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
          {index + 1}
        </span>
      </div>

      {/* Target Type */}
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-700">Loại</label>
        <select
          value={row.targetType}
          onChange={(e) => {
            onUpdate(row.id, 'targetType', e.target.value);
            onUpdate(row.id, 'targetId', '');
            onUpdate(row.id, 'targetCode', '');
            onUpdate(row.id, 'targetName', '');
          }}
          className="mt-1 block w-full rounded-md border-slate-300 py-1.5 text-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">-- Chọn --</option>
          <option value="CONTRACT">Hợp đồng</option>
          <option value="ORDER">Đơn hàng</option>
        </select>
      </div>

      {/* Target Selector with Search */}
      <div className="relative sm:col-span-3">
        <label className="block text-xs font-medium text-slate-700">
          {row.targetType === 'CONTRACT' ? 'Hợp đồng' : 'Đơn hàng'}
        </label>
        <div className="relative mt-1">
          <input
            type="text"
            value={row.targetCode || searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder={row.targetType ? 'Tìm kiếm...' : 'Chọn loại trước'}
            disabled={!row.targetType}
            className="block w-full rounded-md border-slate-300 py-1.5 pl-3 pr-8 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-100"
          />
          <Search className="absolute right-2 top-2.5 h-4 w-4 text-slate-400" />

          {/* Dropdown */}
          {showDropdown && row.targetType && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
              {filteredTargets.length > 0 ? (
                filteredTargets.map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => {
                      onTargetSelect(row.id, row.targetType as TargetType, target.id);
                      setShowDropdown(false);
                      setSearchQuery('');
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <div className="font-medium text-slate-900">{target.code}</div>
                    <div className="text-xs text-slate-600">
                      {'title' in target ? target.title : target.customerName}
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-slate-500">
                  Không tìm thấy kết quả
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-700">Số tiền</label>
        <input
          type="text"
          value={row.amount}
          onChange={(e) => onUpdate(row.id, 'amount', e.target.value.replace(/[^\d.]/g, ''))}
          placeholder="0"
          className="mt-1 block w-full rounded-md border-slate-300 py-1.5 text-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      {/* Purpose */}
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-700">Mục đích</label>
        <select
          value={row.purposeType}
          onChange={(e) => onUpdate(row.id, 'purposeType', e.target.value)}
          className="mt-1 block w-full rounded-md border-slate-300 py-1.5 text-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">-- Chọn --</option>
          <option value="DEPOSIT">Đặt cọc</option>
          <option value="SETTLEMENT">Thanh lý</option>
          <option value="INSTALLMENT">Trả góp</option>
        </select>
      </div>

      {/* Remove Button */}
      <div className="flex items-end sm:col-span-1">
        <button
          type="button"
          onClick={() => onRemove(row.id)}
          disabled={!canRemove}
          className="rounded-md p-2 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Xóa dòng"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Note (full width) */}
      <div className="sm:col-span-12">
        <label className="block text-xs font-medium text-slate-700">Ghi chú</label>
        <input
          type="text"
          value={row.note || ''}
          onChange={(e) => onUpdate(row.id, 'note', e.target.value)}
          placeholder="Ghi chú thêm (không bắt buộc)"
          className="mt-1 block w-full rounded-md border-slate-300 py-1.5 text-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};

export default PaymentAllocationForm;
