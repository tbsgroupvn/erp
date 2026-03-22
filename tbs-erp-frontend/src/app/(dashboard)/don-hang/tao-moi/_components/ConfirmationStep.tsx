'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { StatusBadge } from '@/components/shared/status-badge';
import { ServiceType, ShippingRoute, Branch, ClearanceType } from '@/lib/types';
import type { Customer } from '@/lib/types';
import {
  SERVICE_TYPE_LABELS,
  SHIPPING_ROUTE_LABELS,
  BRANCH_LABELS,
  CLEARANCE_TYPE_LABELS,
} from '@/lib/utils/constants';

interface SubOrderItem {
  productName?: string;
  quantity?: number | string;
  unitPrice?: number | string;
}

interface SubOrder {
  serviceType: ServiceType | string;
  clearanceType: ClearanceType | string;
  shippingRoute?: ShippingRoute | string;
  note?: string;
  items?: SubOrderItem[];
}

export interface ConfirmationStepProps {
  selectedCustomer: Customer | null;
  control: Control<any>;
  isPending: boolean;
  onBack: () => void;
}

export const ConfirmationStep = React.memo(function ConfirmationStep({
  selectedCustomer,
  control,
  isPending,
  onBack,
}: ConfirmationStepProps) {
  const watchedCustomerId = useWatch({ control, name: 'customerId' });
  const watchedBranch = useWatch({ control, name: 'branch' });
  const watchedNote = useWatch({ control, name: 'note' });
  const watchedSubOrders: SubOrder[] = useWatch({ control, name: 'subOrders' }) ?? [];

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <h3 className="text-lg font-semibold">X\u00e1c nh\u1eadn \u0111\u01a1n h\u00e0ng</h3>
      <p className="text-sm text-muted-foreground">
        Ki\u1ec3m tra l\u1ea1i th\u00f4ng tin tr\u01b0\u1edbc khi t\u1ea1o \u0111\u01a1n h\u00e0ng.
      </p>

      {/* Master order info */}
      <div className="text-sm space-y-2 rounded-md border p-4">
        <p>
          <span className="text-muted-foreground">Kh\u00e1ch h\u00e0ng:</span>{' '}
          {selectedCustomer
            ? `${selectedCustomer.fullName} (${selectedCustomer.code})`
            : watchedCustomerId}
        </p>
        <p>
          <span className="text-muted-foreground">Chi nh\u00e1nh:</span>{' '}
          {BRANCH_LABELS[watchedBranch as Branch]}
        </p>
        {watchedNote && (
          <p>
            <span className="text-muted-foreground">Ghi ch\u00fa:</span> {watchedNote}
          </p>
        )}
        <p>
          <span className="text-muted-foreground">S\u1ed1 \u0111\u01a1n con:</span>{' '}
          {watchedSubOrders?.length ?? 0}
        </p>
      </div>

      {/* Sub orders summary */}
      {watchedSubOrders?.map((so, idx) => {
        const soTotal =
          so.items?.reduce(
            (sum, item) =>
              sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
            0,
          ) ?? 0;
        return (
          <div key={idx} className="rounded-md border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">
                \u0110\u01a1n con {String.fromCharCode(65 + idx)}
              </h4>
              <StatusBadge
                label={CLEARANCE_TYPE_LABELS[so.clearanceType as ClearanceType]}
                colorClass={
                  so.clearanceType === ClearanceType.CHINH_NGACH
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-orange-100 text-orange-700'
                }
              />
            </div>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">D\u1ecbch v\u1ee5:</span>{' '}
                {SERVICE_TYPE_LABELS[so.serviceType as ServiceType]}
              </p>
              {so.shippingRoute && (
                <p>
                  <span className="text-muted-foreground">Tuy\u1ebfn:</span>{' '}
                  {SHIPPING_ROUTE_LABELS[so.shippingRoute as ShippingRoute]}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">S\u1ed1 s\u1ea3n ph\u1ea9m:</span>{' '}
                {so.items?.length ?? 0}
              </p>
              <p>
                <span className="text-muted-foreground">T\u1ed5ng ti\u1ec1n:</span>{' '}
                <span className="font-semibold">
                  {soTotal.toLocaleString('vi-VN')} (CNY)
                </span>
              </p>
            </div>
            {so.items && so.items.length > 0 && (
              <table className="w-full text-sm mt-2">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-2 py-1 text-left font-medium">S\u1ea3n ph\u1ea9m</th>
                    <th className="px-2 py-1 text-right font-medium">SL</th>
                    <th className="px-2 py-1 text-right font-medium">\u0110\u01a1n gi\u00e1</th>
                    <th className="px-2 py-1 text-right font-medium">Th\u00e0nh ti\u1ec1n</th>
                  </tr>
                </thead>
                <tbody>
                  {so.items.map((item, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-2 py-1">{item.productName || '(ch\u01b0a \u0111\u1eb7t t\u00ean)'}</td>
                      <td className="px-2 py-1 text-right">{item.quantity}</td>
                      <td className="px-2 py-1 text-right">
                        {Number(item.unitPrice).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-2 py-1 text-right font-medium">
                        {(
                          (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
                        ).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border px-6 py-3 sm:px-4 sm:py-2 text-sm hover:bg-accent touch-manipulation min-h-[44px]"
        >
          Quay l\u1ea1i
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-8 py-3 sm:px-6 sm:py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 touch-manipulation min-h-[44px]"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          T\u1ea1o \u0111\u01a1n h\u00e0ng
        </button>
      </div>
    </div>
  );
});
