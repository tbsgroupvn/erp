'use client';

import React, { useState } from 'react';
import type { UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import type { Customer } from '@/lib/types';
import { Branch } from '@/lib/types';
import { BRANCH_LABELS } from '@/lib/utils/constants';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { CustomerPicker } from '@/components/shared/customer-picker';
import type { CustomerPickerValue } from '@/components/shared/customer-picker';
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

export const GeneralInfoStep = React.memo(function GeneralInfoStep({
  register,
  errors,
  setValue,
  selectedCustomer,
  onSelectCustomer,
  onNext,
}: GeneralInfoStepProps) {
  const [showQuickAddDialog, setShowQuickAddDialog] = useState(false);

  const handleCustomerChange = (customer: CustomerPickerValue | null) => {
    if (customer) {
      onSelectCustomer(customer as unknown as Customer);
      setValue('customerId', customer.id, { shouldValidate: true });
    } else {
      onSelectCustomer(null as unknown as Customer);
      setValue('customerId', '', { shouldValidate: true });
    }
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
          <CustomerPicker
            value={selectedCustomer?.id ?? null}
            onChange={handleCustomerChange}
            error={errors.customerId?.message as string}
            selectedCustomer={
              selectedCustomer
                ? {
                    id: selectedCustomer.id,
                    code: selectedCustomer.code,
                    fullName: selectedCustomer.fullName,
                    companyName: selectedCustomer.companyName,
                    phone: selectedCustomer.phone,
                  }
                : null
            }
            label="Kh\u00e1ch h\u00e0ng *"
            placeholder="T\u00ecm kh\u00e1ch h\u00e0ng theo t\u00ean, m\u00e3, S\u0110T..."
          />
          <input type="hidden" {...register('customerId')} />
          {!selectedCustomer && (
            <button
              type="button"
              onClick={() => setShowQuickAddDialog(true)}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-secondary/50 px-3 py-2 text-sm font-medium text-primary hover:bg-secondary transition-colors"
            >
              <span>+ Th\u00eam m\u1edbi kh\u00e1ch h\u00e0ng</span>
            </button>
          )}
        </div>

        {/* Branch */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Chi nh\u00e1nh *</p>
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
              <p className="text-sm font-medium">Th\u00f4ng tin t\u00edn d\u1ee5ng</p>
              <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">C\u00f4ng n\u1ee3 hi\u1ec7n t\u1ea1i</p>
                  <p className="font-semibold">{formatCurrency(selectedCustomer.currentDebt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">H\u1ea1n m\u1ee9c t\u00edn d\u1ee5ng</p>
                  <p className="font-semibold">{formatCurrency(selectedCustomer.creditLimit)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">% S\u1eed d\u1ee5ng</p>
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
                    ? '\u26a0\ufe0f Kh\u00e1ch h\u00e0ng \u0111\u00e3 v\u01b0\u1ee3t h\u1ea1n m\u1ee9c t\u00edn d\u1ee5ng!'
                    : '\u26a0\ufe0f Kh\u00e1ch h\u00e0ng s\u1eafp \u0111\u1ea1t h\u1ea1n m\u1ee9c t\u00edn d\u1ee5ng!'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Note */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Ghi ch\u00fa \u0111\u01a1n t\u1ed5ng</p>
        <textarea
          {...register('note')}
          rows={2}
          placeholder="Ghi ch\u00fa cho \u0111\u01a1n t\u1ed5ng..."
          className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          className="rounded-md bg-primary px-6 py-3 sm:px-4 sm:py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 touch-manipulation min-h-[44px]"
        >
          Ti\u1ebfp t\u1ee5c
        </button>
      </div>

      {showQuickAddDialog && (
        <QuickCustomerDialog
          initialPhone=""
          onClose={() => setShowQuickAddDialog(false)}
          onCustomerCreated={(newCustomer) => {
            setShowQuickAddDialog(false);
            handleCustomerChange({
              id: newCustomer.id,
              code: newCustomer.code,
              fullName: newCustomer.fullName,
              companyName: newCustomer.companyName,
              phone: newCustomer.phone,
            });
          }}
        />
      )}
    </div>
  );
});
