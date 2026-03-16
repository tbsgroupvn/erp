'use client';

import Link from 'next/link';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  MASTER_ORDER_STATUS_LABELS,
  MASTER_ORDER_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
  BRANCH_LABELS,
} from '@/lib/utils/constants';
import { formatDateTime } from '@/lib/utils/format';
import type { MasterOrderStatus, ServiceType, Branch, MasterOrder } from '@/lib/types';

interface MasterOrderWithSale extends Omit<MasterOrder, 'sale'> {
  leader?: { fullName?: string };
  sale?: MasterOrder['sale'] & { leader?: { fullName?: string } };
}

interface OrderSaleBlockProps {
  order: MasterOrderWithSale;
}

export function OrderSaleBlock({ order }: OrderSaleBlockProps) {
  const overallStatus = order.overallStatus as MasterOrderStatus;

  return (
    <div className="space-y-6">
      {/* Order & Status */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Thông tin đơn hàng</h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-sm text-muted-foreground">Mã đơn</dt>
            <dd className="text-sm font-semibold">{order.code}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-sm text-muted-foreground">Trạng thái</dt>
            <dd>
              <StatusBadge
                label={MASTER_ORDER_STATUS_LABELS[overallStatus] || overallStatus}
                colorClass={MASTER_ORDER_STATUS_COLORS[overallStatus] || 'bg-gray-100 text-gray-700'}
              />
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-sm text-muted-foreground">Chi nhánh</dt>
            <dd className="text-sm">{BRANCH_LABELS[order.branch as Branch] || order.branch}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-sm text-muted-foreground">Loại dịch vụ</dt>
            <dd className="flex flex-wrap gap-1">
              {order.subOrders?.map((so, idx: number) => (
                <StatusBadge
                  key={idx}
                  label={SERVICE_TYPE_LABELS[so.serviceType as ServiceType] || so.serviceType}
                  colorClass="bg-blue-50 text-blue-700"
                />
              ))}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-sm text-muted-foreground">Ngày tạo</dt>
            <dd className="text-sm">{formatDateTime(order.createdAt)}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-sm text-muted-foreground">Số đơn con</dt>
            <dd className="text-sm font-medium">{order.subOrders?.length ?? 0}</dd>
          </div>
          {order.note && (
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Ghi chú</dt>
              <dd className="text-sm">{order.note}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Customer Info */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Khách hàng</h3>
        {order.customer ? (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Mã KH</dt>
              <dd>
                <Link href={`/khach-hang/${order.customer.id}`} className="text-sm text-primary hover:underline font-medium">
                  {order.customer.code}
                </Link>
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Tên</dt>
              <dd className="text-sm font-medium">{order.customer.fullName}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Công ty</dt>
              <dd className="text-sm">{order.customer.companyName || '---'}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">SDT</dt>
              <dd className="text-sm">{order.customer.phone || '---'}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Không có thông tin khách hàng</p>
        )}
      </div>

      {/* Sale & Leader */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Nhân viên phụ trách</h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-sm text-muted-foreground">Sale</dt>
            <dd className="text-sm font-medium">
              {order.sale?.fullName ?? '---'}
              {order.sale?.saleCode && (
                <span className="text-muted-foreground ml-1">({order.sale.saleCode})</span>
              )}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-sm text-muted-foreground">Leader</dt>
            <dd className="text-sm font-medium">
              {order.leader?.fullName ?? order.sale?.leader?.fullName ?? '---'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
