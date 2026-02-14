'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, ChevronDown, ChevronRight, XCircle, ArrowRightCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { useMasterOrder, useChangeOrderStatus, useCancelOrder } from '@/lib/hooks/use-orders';
import { OrderStatus as OrderStatusEnum } from '@/lib/types/enums';
import {
  MASTER_ORDER_STATUS_LABELS,
  MASTER_ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
  CLEARANCE_TYPE_LABELS,
  CLEARANCE_TYPE_COLORS,
  BRANCH_LABELS,
  SHIPPING_ROUTE_LABELS,
} from '@/lib/utils/constants';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format';
import type { MasterOrderStatus, OrderStatus, ServiceType, ClearanceType, Branch, ShippingRoute, Order } from '@/lib/types';

/** Define valid next statuses for each status (linear flow + hold) */
const STATUS_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatusEnum.CONSULTING]: [OrderStatusEnum.QUOTATION, OrderStatusEnum.ON_HOLD],
  [OrderStatusEnum.QUOTATION]: [OrderStatusEnum.PENDING_DEPOSIT, OrderStatusEnum.ON_HOLD],
  [OrderStatusEnum.PENDING_DEPOSIT]: [OrderStatusEnum.SOURCING, OrderStatusEnum.ON_HOLD],
  [OrderStatusEnum.SOURCING]: [OrderStatusEnum.WAREHOUSE_CN, OrderStatusEnum.ON_HOLD],
  [OrderStatusEnum.WAREHOUSE_CN]: [OrderStatusEnum.PACKING, OrderStatusEnum.ON_HOLD],
  [OrderStatusEnum.PACKING]: [OrderStatusEnum.CONSOLIDATION, OrderStatusEnum.ON_HOLD],
  [OrderStatusEnum.CONSOLIDATION]: [OrderStatusEnum.IN_TRANSIT, OrderStatusEnum.ON_HOLD],
  [OrderStatusEnum.IN_TRANSIT]: [OrderStatusEnum.CUSTOMS, OrderStatusEnum.ON_HOLD],
  [OrderStatusEnum.CUSTOMS]: [OrderStatusEnum.WAREHOUSE_VN, OrderStatusEnum.ON_HOLD],
  [OrderStatusEnum.WAREHOUSE_VN]: [OrderStatusEnum.DELIVERING, OrderStatusEnum.ON_HOLD],
  [OrderStatusEnum.DELIVERING]: [OrderStatusEnum.SETTLEMENT, OrderStatusEnum.ON_HOLD],
  [OrderStatusEnum.SETTLEMENT]: [OrderStatusEnum.COMPLETED],
  [OrderStatusEnum.ON_HOLD]: [
    OrderStatusEnum.CONSULTING,
    OrderStatusEnum.QUOTATION,
    OrderStatusEnum.PENDING_DEPOSIT,
    OrderStatusEnum.SOURCING,
    OrderStatusEnum.WAREHOUSE_CN,
    OrderStatusEnum.PACKING,
    OrderStatusEnum.CONSOLIDATION,
    OrderStatusEnum.IN_TRANSIT,
    OrderStatusEnum.CUSTOMS,
    OrderStatusEnum.WAREHOUSE_VN,
    OrderStatusEnum.DELIVERING,
    OrderStatusEnum.SETTLEMENT,
  ],
};

export default function MasterOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: masterOrder, isLoading, isError } = useMasterOrder(id);
  const changeStatus = useChangeOrderStatus();
  const cancelOrder = useCancelOrder();
  const [expandedSubOrder, setExpandedSubOrder] = useState<string | null>(null);
  const [cancellingSubOrderId, setCancellingSubOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [changingStatus, setChangingStatus] = useState<{ subOrderId: string; nextStatus: OrderStatus; currentCode: string } | null>(null);
  const [statusChangeNote, setStatusChangeNote] = useState('');

  if (isLoading) return <LoadingOverlay className="h-[60vh]" />;
  if (isError) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive font-medium">Lỗi tải dữ liệu</p>
        <p className="text-sm text-muted-foreground mt-1">Không thể tải thông tin đơn hàng. Vui lòng thử lại.</p>
        <Link href="/don-hang" className="text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    );
  }
  if (!masterOrder) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Không tìm thấy đơn hàng</p>
        <Link href="/don-hang" className="text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const overallStatus = masterOrder.overallStatus as MasterOrderStatus;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/don-hang" className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{masterOrder.code}</h1>
            <StatusBadge
              label={MASTER_ORDER_STATUS_LABELS[overallStatus] || overallStatus}
              colorClass={MASTER_ORDER_STATUS_COLORS[overallStatus] || 'bg-gray-100 text-gray-700'}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Tạo lúc {formatDateTime(masterOrder.createdAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            try {
              // SSR safety check (though onClick should always be client-side)
              if (typeof window === 'undefined') {
                console.error('Cannot clone order on server-side');
                return;
              }

              // Store order data in sessionStorage for cloning
              sessionStorage.setItem('cloneOrderData', JSON.stringify({
                customerId: masterOrder.customerId,
                branch: masterOrder.branch,
                note: masterOrder.note,
                subOrders: masterOrder.subOrders?.map((so: any) => ({
                  serviceType: so.serviceType,
                  clearanceType: so.clearanceType,
                  shippingRoute: so.shippingRoute,
                  note: so.note,
                  items: so.items?.map((item: any) => ({
                    productName: item.productName,
                    productUrl: item.productUrl,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    note: item.note,
                  })) || [],
                })) || [],
              }));
              router.push(`/don-hang/tao-moi?clone=${id}`);
            } catch (error) {
              console.error('Failed to prepare clone data:', error);
              toast?.error('Không thể chuẩn bị dữ liệu sao chép');
            }
          }}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          <Copy className="h-4 w-4" />
          Tạo đơn tương tự
        </button>
      </div>

      {/* Master Order Info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Thông tin đơn tổng</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Mã đơn</dt>
              <dd className="font-medium">{masterOrder.code}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Chi nhánh</dt>
              <dd>{BRANCH_LABELS[masterOrder.branch as Branch] || masterOrder.branch}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Sale</dt>
              <dd>{masterOrder.sale?.fullName ?? '---'} {masterOrder.sale?.saleCode && <span className="text-muted-foreground">({masterOrder.sale.saleCode})</span>}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Số đơn con</dt>
              <dd>{masterOrder.subOrders?.length ?? 0}</dd>
            </div>
            {masterOrder.note && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ghi chú</dt>
                <dd>{masterOrder.note}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Khách hàng</h3>
          {masterOrder.customer ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Mã KH</dt>
                <dd>
                  <Link href={`/khach-hang/${masterOrder.customer.id}`} className="text-primary hover:underline">
                    {masterOrder.customer.code}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tên</dt>
                <dd>{masterOrder.customer.fullName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Công ty</dt>
                <dd>{masterOrder.customer.companyName || '---'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">SĐT</dt>
                <dd>{masterOrder.customer.phone}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Không có thông tin</p>
          )}
        </div>
      </div>

      {/* Sub Orders */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Đơn con ({masterOrder.subOrders?.length ?? 0})</h3>
        {masterOrder.subOrders?.map((subOrder: Order) => {
          const isExpanded = expandedSubOrder === subOrder.id;
          const subStatus = subOrder.status as OrderStatus;
          const clearance = subOrder.clearanceType as ClearanceType;

          return (
            <div key={subOrder.id} className="rounded-lg border bg-card overflow-hidden">
              {/* Sub order header */}
              <button
                type="button"
                onClick={() => setExpandedSubOrder(isExpanded ? null : subOrder.id)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-semibold">{subOrder.code}</span>
                  <StatusBadge
                    label={SERVICE_TYPE_LABELS[subOrder.serviceType as ServiceType] || subOrder.serviceType}
                    colorClass="bg-blue-50 text-blue-700"
                  />
                  <StatusBadge
                    label={CLEARANCE_TYPE_LABELS[clearance] || clearance}
                    colorClass={CLEARANCE_TYPE_COLORS[clearance] || 'bg-gray-100 text-gray-700'}
                  />
                  <StatusBadge
                    label={ORDER_STATUS_LABELS[subStatus] || subStatus}
                    colorClass={ORDER_STATUS_COLORS[subStatus] || 'bg-gray-100 text-gray-700'}
                  />
                </div>
                <span className="font-medium text-sm">
                  {formatCurrency(subOrder.totalAmount, subOrder.currency)}
                </span>
              </button>

              {/* Sub order detail */}
              {isExpanded && (
                <div className="border-t px-6 py-4 space-y-4">
                  {/* Action buttons */}
                  {subStatus !== OrderStatusEnum.COMPLETED && subStatus !== OrderStatusEnum.CANCELLED && (
                    <div className="flex items-center gap-2 pb-2 border-b">
                      {/* Status transition buttons */}
                      {(STATUS_TRANSITIONS[subStatus] ?? []).map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          onClick={() => setChangingStatus({ subOrderId: subOrder.id, nextStatus, currentCode: subOrder.code })}
                          disabled={changeStatus.isPending}
                          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                        >
                          <ArrowRightCircle className="h-3.5 w-3.5" />
                          {ORDER_STATUS_LABELS[nextStatus] || nextStatus}
                        </button>
                      ))}
                      {/* Cancel button */}
                      <button
                        type="button"
                        onClick={() => setCancellingSubOrderId(subOrder.id)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 ml-auto"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Hủy đơn
                      </button>
                    </div>
                  )}

                  {/* Cancel dialog */}
                  {cancellingSubOrderId === subOrder.id && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-3">
                      <p className="text-sm font-medium text-red-800">Xác nhận hủy đơn {subOrder.code}?</p>
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Nhập lý do hủy đơn..."
                        className="w-full rounded-md border px-3 py-2 text-sm bg-white"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!cancelReason.trim()) return;
                            cancelOrder.mutate(
                              { id: subOrder.id, reason: cancelReason },
                              {
                                onSuccess: () => {
                                  setCancellingSubOrderId(null);
                                  setCancelReason('');
                                },
                              }
                            );
                          }}
                          disabled={!cancelReason.trim() || cancelOrder.isPending}
                          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {cancelOrder.isPending ? 'Đang hủy...' : 'Xác nhận hủy'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCancellingSubOrderId(null);
                            setCancelReason('');
                          }}
                          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                        >
                          Đóng
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Status Change Confirm Dialog */}
                  {changingStatus && changingStatus.subOrderId === subOrder.id && (
                    <div className="rounded-md border border-blue-200 bg-blue-50 p-4 space-y-3">
                      <p className="text-sm font-medium text-blue-800">
                        Xác nhận chuyển trạng thái đơn {changingStatus.currentCode} sang{' '}
                        <span className="font-bold">{ORDER_STATUS_LABELS[changingStatus.nextStatus]}</span>?
                      </p>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-blue-800">Ghi chú (tùy chọn)</label>
                        <textarea
                          value={statusChangeNote}
                          onChange={(e) => setStatusChangeNote(e.target.value)}
                          placeholder="Nhập ghi chú khi chuyển trạng thái..."
                          className="w-full rounded-md border px-3 py-2 text-sm bg-white"
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            changeStatus.mutate(
                              {
                                id: changingStatus.subOrderId,
                                status: changingStatus.nextStatus,
                                note: statusChangeNote.trim() || undefined,
                              },
                              {
                                onSuccess: () => {
                                  setChangingStatus(null);
                                  setStatusChangeNote('');
                                },
                              }
                            );
                          }}
                          disabled={changeStatus.isPending}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {changeStatus.isPending ? 'Đang xử lý...' : 'Xác nhận'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setChangingStatus(null);
                            setStatusChangeNote('');
                          }}
                          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Loại dịch vụ:</span>{' '}
                      {SERVICE_TYPE_LABELS[subOrder.serviceType as ServiceType]}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Thông quan:</span>{' '}
                      {CLEARANCE_TYPE_LABELS[clearance]}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tuyến:</span>{' '}
                      {subOrder.shippingRoute ? SHIPPING_ROUTE_LABELS[subOrder.shippingRoute as ShippingRoute] : '---'}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Đặt cọc:</span>{' '}
                      {formatCurrency(subOrder.depositPaid, subOrder.currency)} / {formatCurrency(subOrder.depositRequired, subOrder.currency)}
                    </div>
                    {(subOrder as any).trackingNumber && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Tracking:</span>{' '}
                        <Link
                          href={`/theo-doi?tracking=${(subOrder as any).trackingNumber}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {(subOrder as any).trackingNumber}
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  {subOrder.items && subOrder.items.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Hàng hóa</h4>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 font-medium">Sản phẩm</th>
                            <th className="pb-2 font-medium">SL</th>
                            <th className="pb-2 font-medium text-right">Đơn giá</th>
                            <th className="pb-2 font-medium text-right">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subOrder.items.map((item) => (
                            <tr key={item.id} className="border-b">
                              <td className="py-2">
                                <p>{item.productName}</p>
                                {item.productUrl && (
                                  <a href={item.productUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                                    Link sản phẩm
                                  </a>
                                )}
                              </td>
                              <td className="py-2">{item.quantity}</td>
                              <td className="py-2 text-right">{formatCurrency(item.unitPrice, item.currency)}</td>
                              <td className="py-2 text-right font-medium">{formatCurrency(item.totalPrice, item.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Status History */}
                  {subOrder.statusHistory && subOrder.statusHistory.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Lịch sử trạng thái</h4>
                      <div className="space-y-2">
                        {subOrder.statusHistory.map((h) => (
                          <div key={h.id} className="flex items-start gap-3">
                            <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-sm">
                                {h.fromStatus && (
                                  <>
                                    <span className="font-medium">{ORDER_STATUS_LABELS[h.fromStatus as OrderStatus] || h.fromStatus}</span>
                                    {' -> '}
                                  </>
                                )}
                                <span className="font-medium">{ORDER_STATUS_LABELS[h.toStatus as OrderStatus] || h.toStatus}</span>
                              </p>
                              {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
                              <p className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
