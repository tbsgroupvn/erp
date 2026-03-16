'use client';

import { Loader2 } from 'lucide-react';
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
  watchedCustomerId: string;
  watchedBranch: Branch;
  watchedNote?: string;
  watchedSubOrders: SubOrder[];
  isPending: boolean;
  onBack: () => void;
}

export function ConfirmationStep({
  selectedCustomer,
  watchedCustomerId,
  watchedBranch,
  watchedNote,
  watchedSubOrders,
  isPending,
  onBack,
}: ConfirmationStepProps) {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <h3 className="text-lg font-semibold">Xác nhận đơn hàng</h3>
      <p className="text-sm text-muted-foreground">
        Kiểm tra lại thông tin trước khi tạo đơn hàng.
      </p>

      {/* Master order info */}
      <div className="text-sm space-y-2 rounded-md border p-4">
        <p>
          <span className="text-muted-foreground">Khách hàng:</span>{' '}
          {selectedCustomer
            ? `${selectedCustomer.fullName} (${selectedCustomer.code})`
            : watchedCustomerId}
        </p>
        <p>
          <span className="text-muted-foreground">Chi nhánh:</span>{' '}
          {BRANCH_LABELS[watchedBranch]}
        </p>
        {watchedNote && (
          <p>
            <span className="text-muted-foreground">Ghi chú:</span> {watchedNote}
          </p>
        )}
        <p>
          <span className="text-muted-foreground">Số đơn con:</span>{' '}
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
                Đơn con {String.fromCharCode(65 + idx)}
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
                <span className="text-muted-foreground">Dịch vụ:</span>{' '}
                {SERVICE_TYPE_LABELS[so.serviceType as ServiceType]}
              </p>
              {so.shippingRoute && (
                <p>
                  <span className="text-muted-foreground">Tuyến:</span>{' '}
                  {SHIPPING_ROUTE_LABELS[so.shippingRoute as ShippingRoute]}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Số sản phẩm:</span>{' '}
                {so.items?.length ?? 0}
              </p>
              <p>
                <span className="text-muted-foreground">Tổng tiền:</span>{' '}
                <span className="font-semibold">
                  {soTotal.toLocaleString('vi-VN')} (CNY)
                </span>
              </p>
            </div>
            {so.items && so.items.length > 0 && (
              <table className="w-full text-sm mt-2">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-2 py-1 text-left font-medium">Sản phẩm</th>
                    <th className="px-2 py-1 text-right font-medium">SL</th>
                    <th className="px-2 py-1 text-right font-medium">Đơn giá</th>
                    <th className="px-2 py-1 text-right font-medium">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {so.items.map((item, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-2 py-1">{item.productName || '(chưa đặt tên)'}</td>
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
          Quay lại
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-8 py-3 sm:px-6 sm:py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 touch-manipulation min-h-[44px]"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Tạo đơn hàng
        </button>
      </div>
    </div>
  );
}
