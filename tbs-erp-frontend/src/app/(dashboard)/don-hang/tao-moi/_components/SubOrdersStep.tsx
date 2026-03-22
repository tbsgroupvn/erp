'use client';

import React from 'react';
import { Plus, X } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import type { UseFieldArrayRemove, Control } from 'react-hook-form';
import { ServiceType, ShippingRoute, ClearanceType } from '@/lib/types';
import type { Customer } from '@/lib/types';
import {
  SERVICE_TYPE_LABELS,
  SHIPPING_ROUTE_LABELS,
} from '@/lib/utils/constants';
import { MHHPriceCalculator } from '@/features/orders/mhh-price-calculator';
import { InfoTooltip } from '@/components/shared/info-tooltip';
import { SubOrderItems } from './SubOrderItems';

interface SubOrderField {
  id: string;
  [key: string]: unknown;
}

export interface SubOrdersStepProps {
  subOrderFields: SubOrderField[];
  activeSubOrder: number;
  setActiveSubOrder: (idx: number) => void;
  appendSubOrder: any;
  removeSubOrder: UseFieldArrayRemove;
  control: Control<any>;
  register: any;
  errors: any;
  quickMode: boolean;
  selectedCustomer: Customer | null;
  onBack: () => void;
  onNext: () => void;
}

export const SubOrdersStep = React.memo(function SubOrdersStep({
  subOrderFields,
  activeSubOrder,
  setActiveSubOrder,
  appendSubOrder,
  removeSubOrder,
  control,
  register,
  errors,
  quickMode,
  selectedCustomer,
  onBack,
  onNext,
}: SubOrdersStepProps) {
  const watchedSubOrders = useWatch({ control, name: 'subOrders' }) ?? [];
  return (
    <div className="space-y-4">
      {/* Sub Order Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {subOrderFields.map((field, idx) => (
          <button
            key={field.id}
            type="button"
            onClick={() => setActiveSubOrder(idx)}
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm border transition-colors ${
              activeSubOrder === idx
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-accent border-border'
            }`}
          >
            Đơn con {String.fromCharCode(65 + idx)}
            {subOrderFields.length > 1 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  removeSubOrder(idx);
                  if (activeSubOrder >= idx && activeSubOrder > 0) {
                    setActiveSubOrder(activeSubOrder - 1);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    removeSubOrder(idx);
                    if (activeSubOrder >= idx && activeSubOrder > 0) {
                      setActiveSubOrder(activeSubOrder - 1);
                    }
                  }
                }}
                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-destructive/20"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            appendSubOrder({
              serviceType: ServiceType.VCT,
              clearanceType: ClearanceType.TIEU_NGACH,
              note: '',
              items: [{ productName: '', quantity: 1, unitPrice: 0 }],
            });
            setActiveSubOrder(subOrderFields.length);
          }}
          className="inline-flex items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-sm hover:bg-accent"
        >
          <Plus className="h-3 w-3" /> Thêm đơn con
        </button>
      </div>

      {/* Active Sub Order Form — only the active sub-order is mounted.
           react-hook-form keeps field values in `control` even when fields unmount
           (shouldUnregister defaults to false), so switching tabs preserves data. */}
      {subOrderFields.map((field, idx) =>
        idx === activeSubOrder ? (
          <div key={field.id}>
            <div className="rounded-lg border bg-card p-6 space-y-4">
              <h3 className="flex items-center gap-1.5 text-base font-semibold">
                Đơn con {String.fromCharCode(65 + idx)}
                <InfoTooltip tipKey="sub-order" />
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Service Type */}
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    Loại dịch vụ *
                    <InfoTooltip tipKey="vct" />
                  </p>
                  <select
                    {...register(`subOrders.${idx}.serviceType`)}
                    className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {Object.entries(SERVICE_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Clearance Type */}
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    Loại thông quan *
                    <InfoTooltip tip={{ definition: 'Chính ngạch: thông quan chính thức, có hóa đơn VAT. Tiểu ngạch: thông quan biên mậu, phí thấp hơn nhưng giới hạn mặt hàng.' }} />
                  </p>
                  <div className="flex gap-4 pt-2">
                    <p className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        value={ClearanceType.CHINH_NGACH}
                        {...register(`subOrders.${idx}.clearanceType`)}
                        className="h-4 w-4"
                      />
                      <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Chính ngạch
                      </span>
                    </p>
                    <p className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        value={ClearanceType.TIEU_NGACH}
                        {...register(`subOrders.${idx}.clearanceType`)}
                        className="h-4 w-4"
                      />
                      <span className="inline-flex items-center rounded-md bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                        Tiểu ngạch
                      </span>
                    </p>
                  </div>
                </div>

                {/* Shipping Route */}
                {!quickMode && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Tuyến vận chuyển</p>
                    <select
                      {...register(`subOrders.${idx}.shippingRoute`)}
                      className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Chọn tuyến</option>
                      {Object.entries(SHIPPING_ROUTE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Items */}
              <SubOrderItems
                control={control}
                register={register}
                errors={errors}
                subOrderIndex={idx}
                quickMode={quickMode}
              />

              {/* MHH Price Calculator */}
              {watchedSubOrders?.[idx]?.serviceType === ServiceType.MHH && (
                <MHHPriceCalculator
                  defaultRoute={watchedSubOrders[idx]?.shippingRoute}
                  defaultCustomerTier={selectedCustomer?.tier}
                />
              )}

              {/* Sub Order Note */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Ghi chú đơn con</p>
                <textarea
                  {...register(`subOrders.${idx}.note`)}
                  rows={2}
                  placeholder="Ghi chú..."
                  className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        ) : null,
      )}

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border px-6 py-3 sm:px-4 sm:py-2 text-sm hover:bg-accent touch-manipulation min-h-[44px]"
        >
          Quay lại
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-md bg-primary px-6 py-3 sm:px-4 sm:py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 touch-manipulation min-h-[44px]"
        >
          Tiếp tục
        </button>
      </div>
    </div>
  );
});
