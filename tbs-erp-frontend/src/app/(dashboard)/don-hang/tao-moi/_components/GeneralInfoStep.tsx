'use client';

import { useRef, useState, useEffect } from 'react';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import type { UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form';
import type { Customer } from '@/lib/types';
import { Branch } from '@/lib/types';
import { BRANCH_LABELS } from '@/lib/utils/constants';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useCustomers } from '@/lib/hooks/use-customers';
import { QuickCustomerDialog } from './QuickCustomerDialog';

interface CreateMasterOrderForm {
  customerId: string;
  branch: Branch;
  note?: string;
  subOrders: unknown[];
}

export interface GeneralInfoStepProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<CreateMasterOrderForm>;
  setValue: UseFormSetValue<any>;
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer) => void;
  onNext: () => void;
}

export function GeneralInfoStep({
  register,
  errors,
  setValue,
  selectedCustomer,
  onSelectCustomer,
  onNext,
}: GeneralInfoStepProps) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showQuickAddDialog, setShowQuickAddDialog] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const { data: customersData, isLoading: isLoadingCustomers } = useCustomers(
    debouncedSearch ? { search: debouncedSearch, limit: 10 } : { limit: 10 },
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCustomer = (customer: Customer) => {
    onSelectCustomer(customer);
    setCustomerSearch('');
    setShowDropdown(false);
  };

  const usagePercent =
    selectedCustomer && selectedCustomer.creditLimit > 0
      ? (selectedCustomer.currentDebt / selectedCustomer.creditLimit) * 100
      : 0;

  const creditBorderClass =
    usagePercent >= 100
      ? 'bg-red-50 border-red-200'
      : usagePercent >= 80
      ? 'bg-orange-50 border-orange-200'
      : 'bg-blue-50 border-blue-200';

  const creditIconClass =
    usagePercent >= 100
      ? 'text-red-600'
      : usagePercent >= 80
      ? 'text-orange-600'
      : 'text-blue-600';

  const usageTextClass =
    usagePercent >= 100
      ? 'text-red-600 font-medium'
      : 'text-orange-600';

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Customer Picker */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Khách hàng *</p>
          <div className="relative" ref={dropdownRef}>
            {selectedCustomer ? (
              <div className="flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                <span>
                  {selectedCustomer.fullName}{' '}
                  <span className="text-muted-foreground">({selectedCustomer.code})</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setValue('customerId', '', { shouldValidate: true });
                    onSelectCustomer(null as unknown as Customer);
                    setShowDropdown(true);
                  }}
                  className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Thay đổi
                </button>
              </div>
            ) : (
              <>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Tìm khách hàng theo tên, mã, SĐT..."
                  value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  className="flex h-10 w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </>
            )}
            <input type="hidden" {...register('customerId')} />
            {showDropdown && !selectedCustomer && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                {isLoadingCustomers ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Đang tìm...</span>
                  </div>
                ) : customersData?.data && customersData.data.length > 0 ? (
                  <ul className="max-h-60 overflow-auto py-1">
                    {customersData.data.map((customer) => (
                      <li key={customer.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectCustomer(customer)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          <div>
                            <div className="font-medium">{customer.fullName}</div>
                            <div className="text-xs text-muted-foreground">
                              {customer.code}
                              {customer.phone && ` - ${customer.phone}`}
                              {customer.companyName && ` - ${customer.companyName}`}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="py-4 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                    <span>{customerSearch ? 'Không tìm thấy khách hàng' : 'Nhập để tìm khách hàng'}</span>
                  </div>
                )}
                
                {/* Luôn chèn thêm Nút Tạo Nhanh Khách Cũ dưới cùng của Dropdown */}
                <div className="border-t p-2">
                   <button
                     type="button"
                     onClick={() => {
                       setShowDropdown(false);
                       setShowQuickAddDialog(true);
                     }}
                     className="flex w-full items-center justify-center gap-2 rounded-md bg-secondary/50 px-3 py-2 text-sm font-medium text-primary hover:bg-secondary transition-colors"
                   >
                     <span>+ Thêm mới khách hàng &quot;{customerSearch}&quot;</span>
                   </button>
                </div>
              </div>
            )}
          </div>
          {errors.customerId && (
            <p className="text-xs text-destructive">{errors.customerId.message as string}</p>
          )}
        </div>

        {/* Branch */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Chi nhánh *</p>
          <select
            {...register('branch')}
            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.entries(BRANCH_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Credit Limit Warning */}
      {selectedCustomer && (
        <div className={cn('rounded-md border p-4 space-y-2', creditBorderClass)}>
          <div className="flex items-start gap-2">
            <AlertCircle className={cn('h-5 w-5 mt-0.5', creditIconClass)} />
            <div className="flex-1">
              <p className="text-sm font-medium">Thông tin tín dụng</p>
              <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Công nợ hiện tại</p>
                  <p className="font-semibold">{formatCurrency(selectedCustomer.currentDebt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Hạn mức tín dụng</p>
                  <p className="font-semibold">{formatCurrency(selectedCustomer.creditLimit)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">% Sử dụng</p>
                  <p className={cn('font-semibold', usagePercent >= 80 ? usageTextClass : '')}>
                    {selectedCustomer.creditLimit > 0
                      ? `${usagePercent.toFixed(1)}%`
                      : '0%'}
                  </p>
                </div>
              </div>
              {selectedCustomer.creditLimit > 0 && usagePercent >= 80 && (
                <p className={cn('mt-2 text-xs', usageTextClass)}>
                  {usagePercent >= 100
                    ? '⚠️ Khách hàng đã vượt hạn mức tín dụng!'
                    : '⚠️ Khách hàng sắp đạt hạn mức tín dụng!'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Note */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Ghi chú đơn tổng</p>
        <textarea
          {...register('note')}
          rows={2}
          placeholder="Ghi chú cho đơn tổng..."
          className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          className="rounded-md bg-primary px-6 py-3 sm:px-4 sm:py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 touch-manipulation min-h-[44px]"
        >
          Tiếp tục
        </button>
      </div>

      {showQuickAddDialog && (
        <QuickCustomerDialog
          initialPhone={customerSearch || ''}
          onClose={() => setShowQuickAddDialog(false)}
          onCustomerCreated={(newCustomer) => {
            setShowQuickAddDialog(false);
            handleSelectCustomer(newCustomer);
          }}
        />
      )}
    </div>
  );
}
