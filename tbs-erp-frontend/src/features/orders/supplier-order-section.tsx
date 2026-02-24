'use client';

import { useState } from 'react';
import {
  Package,
  Plus,
  ExternalLink,
  CheckCircle,
  ArrowRightCircle,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  useSupplierOrdersByOrder,
  useCreateSupplierOrder,
  useChangeSupplierOrderStatus,
  useRecordReceived,
} from '@/lib/hooks/use-supplier-orders';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  SUPPLIER_ORDER_STATUS_LABELS,
  SUPPLIER_ORDER_STATUS_COLORS,
} from '@/lib/utils/constants';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format';
import { apiClient } from '@/lib/api/client';
import { SupplierOrderStatus } from '@/lib/types/enums';
import type {
  SupplierOrder,
  CreateSupplierOrderDto,
  RecordReceivedDto,
} from '@/lib/types';

/** FSM transitions for supplier order (mirrors backend) */
const SO_TRANSITIONS: Partial<Record<SupplierOrderStatus, SupplierOrderStatus[]>> = {
  [SupplierOrderStatus.DRAFT]: [SupplierOrderStatus.QUOTED, SupplierOrderStatus.ORDERED, SupplierOrderStatus.CANCELLED],
  [SupplierOrderStatus.QUOTED]: [SupplierOrderStatus.ORDERED, SupplierOrderStatus.CANCELLED],
  [SupplierOrderStatus.ORDERED]: [SupplierOrderStatus.CONFIRMED, SupplierOrderStatus.CANCELLED, SupplierOrderStatus.ISSUE],
  [SupplierOrderStatus.CONFIRMED]: [SupplierOrderStatus.PARTIALLY_SHIPPED, SupplierOrderStatus.SHIPPED_CN, SupplierOrderStatus.CANCELLED, SupplierOrderStatus.ISSUE],
  [SupplierOrderStatus.PARTIALLY_SHIPPED]: [SupplierOrderStatus.SHIPPED_CN, SupplierOrderStatus.RECEIVED_CN, SupplierOrderStatus.ISSUE],
  [SupplierOrderStatus.SHIPPED_CN]: [SupplierOrderStatus.RECEIVED_CN, SupplierOrderStatus.ISSUE],
  [SupplierOrderStatus.RECEIVED_CN]: [SupplierOrderStatus.RETURN_IN_PROGRESS, SupplierOrderStatus.ISSUE],
  [SupplierOrderStatus.RETURN_IN_PROGRESS]: [SupplierOrderStatus.REFUNDED, SupplierOrderStatus.ISSUE],
  [SupplierOrderStatus.ISSUE]: [SupplierOrderStatus.ORDERED, SupplierOrderStatus.CONFIRMED, SupplierOrderStatus.RETURN_IN_PROGRESS, SupplierOrderStatus.CANCELLED],
};

interface SupplierOrderSectionProps {
  orderId: string;
  orderCode: string;
}

export function SupplierOrderSection({ orderId, orderCode }: SupplierOrderSectionProps) {
  const { data: supplierOrders, isLoading } = useSupplierOrdersByOrder(orderId);
  const createSO = useCreateSupplierOrder();
  const changeStatus = useChangeSupplierOrderStatus();
  const recordReceived = useRecordReceived();

  // Procurement gate check
  const { data: procurementGate } = useQuery({
    queryKey: ['orders', 'procurement-gate', orderId],
    queryFn: async () => {
      const res = await apiClient.get(`/orders/${orderId}/procurement-gate`);
      return res.data?.data || res.data;
    },
    enabled: !!orderId,
  });
  const canProcure = procurementGate?.allowed ?? true;
  const isPriority = procurementGate?.isPriority ?? false;

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receiveForm, setReceiveForm] = useState<RecordReceivedDto>({});

  // Create form state
  const [createForm, setCreateForm] = useState<Partial<CreateSupplierOrderDto>>({
    orderId,
    supplierName: '',
  });

  const handleCreate = () => {
    if (!createForm.supplierName?.trim()) return;
    createSO.mutate(
      { ...createForm, orderId } as CreateSupplierOrderDto,
      {
        onSuccess: () => {
          setShowCreateForm(false);
          setCreateForm({ orderId, supplierName: '' });
        },
      },
    );
  };

  const handleReceived = (soId: string) => {
    recordReceived.mutate(
      { id: soId, data: receiveForm, orderId },
      {
        onSuccess: () => {
          setReceivingId(null);
          setReceiveForm({});
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tải đơn NCC...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Package className="h-4 w-4" />
          Đơn đặt NCC ({supplierOrders?.length ?? 0})
        </h4>
        <div className="flex items-center gap-2">
          {isPriority && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              Priority
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            disabled={!canProcure}
            title={!canProcure ? 'Cần cọc tối thiểu 70% để mua hàng' : undefined}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm NCC
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="rounded-md border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">Tạo đơn đặt NCC mới</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tên NCC *</label>
              <input
                type="text"
                value={createForm.supplierName ?? ''}
                onChange={(e) => setCreateForm((p) => ({ ...p, supplierName: e.target.value }))}
                placeholder="Tên nhà cung cấp"
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Platform</label>
              <input
                type="text"
                value={createForm.supplierPlatform ?? ''}
                onChange={(e) => setCreateForm((p) => ({ ...p, supplierPlatform: e.target.value }))}
                placeholder="1688, Taobao, Pinduoduo..."
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">URL sản phẩm</label>
              <input
                type="text"
                value={createForm.supplierUrl ?? ''}
                onChange={(e) => setCreateForm((p) => ({ ...p, supplierUrl: e.target.value }))}
                placeholder="https://..."
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Giá báo (CNY)</label>
              <input
                type="number"
                value={createForm.quotedPriceCNY ?? ''}
                onChange={(e) => setCreateForm((p) => ({ ...p, quotedPriceCNY: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="0"
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Số lượng</label>
              <input
                type="number"
                value={createForm.quantityOrdered ?? ''}
                onChange={(e) => setCreateForm((p) => ({ ...p, quantityOrdered: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="0"
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phí ship nội TQ (CNY)</label>
              <input
                type="number"
                value={createForm.shippingFeeCNY ?? ''}
                onChange={(e) => setCreateForm((p) => ({ ...p, shippingFeeCNY: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="0"
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Ghi chú</label>
            <textarea
              value={createForm.note ?? ''}
              onChange={(e) => setCreateForm((p) => ({ ...p, note: e.target.value }))}
              placeholder="Ghi chú cho NCC..."
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!createForm.supplierName?.trim() || createSO.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createSO.isPending ? 'Đang tạo...' : 'Tạo đơn NCC'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Supplier orders list */}
      {supplierOrders && supplierOrders.length > 0 ? (
        <div className="space-y-2">
          {supplierOrders.map((so: SupplierOrder) => {
            const soStatus = so.status as SupplierOrderStatus;
            const nextStatuses = SO_TRANSITIONS[soStatus] ?? [];
            const isTerminal = soStatus === SupplierOrderStatus.REFUNDED || soStatus === SupplierOrderStatus.CANCELLED;

            return (
              <div key={so.id} className="rounded-md border p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{so.code}</span>
                    <StatusBadge
                      label={SUPPLIER_ORDER_STATUS_LABELS[soStatus] || soStatus}
                      colorClass={SUPPLIER_ORDER_STATUS_COLORS[soStatus] || 'bg-gray-100 text-gray-700'}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(so.createdAt)}
                  </span>
                </div>

                {/* Info */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div>
                    <span className="text-muted-foreground">NCC:</span>{' '}
                    <span className="font-medium">{so.supplierName}</span>
                    {so.supplierPlatform && (
                      <span className="text-muted-foreground"> ({so.supplierPlatform})</span>
                    )}
                  </div>
                  {so.supplierOrderNumber && (
                    <div>
                      <span className="text-muted-foreground">Mã NCC:</span> {so.supplierOrderNumber}
                    </div>
                  )}
                  {so.quotedPriceCNY != null && (
                    <div>
                      <span className="text-muted-foreground">Giá báo:</span> {formatCurrency(so.quotedPriceCNY, 'CNY')}
                    </div>
                  )}
                  {so.actualPriceCNY != null && (
                    <div>
                      <span className="text-muted-foreground">Giá thực:</span> {formatCurrency(so.actualPriceCNY, 'CNY')}
                    </div>
                  )}
                  {so.quantityOrdered != null && (
                    <div>
                      <span className="text-muted-foreground">SL đặt:</span> {so.quantityOrdered}
                      {so.quantityReceived != null && (
                        <span> / Nhận: {so.quantityReceived}</span>
                      )}
                    </div>
                  )}
                  {so.trackingNumberCN && (
                    <div>
                      <span className="text-muted-foreground">Tracking TQ:</span> {so.trackingNumberCN}
                    </div>
                  )}
                  {so.supplierUrl && (
                    <div className="col-span-2">
                      <a href={so.supplierUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" />
                        Link sản phẩm
                      </a>
                    </div>
                  )}
                  {so.note && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Ghi chú:</span> {so.note}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!isTerminal && (
                  <div className="flex items-center gap-2 pt-1 border-t">
                    {nextStatuses.map((nextStatus) => (
                      <button
                        key={nextStatus}
                        type="button"
                        onClick={() =>
                          changeStatus.mutate({
                            id: so.id,
                            status: nextStatus,
                            orderId,
                          })
                        }
                        disabled={changeStatus.isPending}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                      >
                        <ArrowRightCircle className="h-3 w-3" />
                        {SUPPLIER_ORDER_STATUS_LABELS[nextStatus]}
                      </button>
                    ))}

                    {/* Record received button (for SHIPPED_CN) */}
                    {soStatus === SupplierOrderStatus.SHIPPED_CN && (
                      <button
                        type="button"
                        onClick={() => setReceivingId(receivingId === so.id ? null : so.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-green-200 px-2 py-1 text-xs text-green-700 hover:bg-green-50 ml-auto"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Nhận hàng
                      </button>
                    )}
                  </div>
                )}

                {/* Record Received Form */}
                {receivingId === so.id && (
                  <div className="rounded-md border border-green-200 bg-green-50 p-3 space-y-3">
                    <p className="text-xs font-medium text-green-800">Ghi nhận hàng nhập kho TQ</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">SL nhận</label>
                        <input
                          type="number"
                          value={receiveForm.quantityReceived ?? ''}
                          onChange={(e) => setReceiveForm((p) => ({ ...p, quantityReceived: e.target.value ? Number(e.target.value) : undefined }))}
                          placeholder={so.quantityOrdered?.toString() ?? '0'}
                          className="mt-1 w-full rounded-md border px-2 py-1 text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Giá thực (CNY)</label>
                        <input
                          type="number"
                          value={receiveForm.actualPriceCNY ?? ''}
                          onChange={(e) => setReceiveForm((p) => ({ ...p, actualPriceCNY: e.target.value ? Number(e.target.value) : undefined }))}
                          placeholder={so.quotedPriceCNY?.toString() ?? '0'}
                          className="mt-1 w-full rounded-md border px-2 py-1 text-xs bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleReceived(so.id)}
                        disabled={recordReceived.isPending}
                        className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {recordReceived.isPending ? 'Đang xử lý...' : 'Xác nhận nhận hàng'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setReceivingId(null); setReceiveForm({}); }}
                        className="rounded-md border px-3 py-1 text-xs hover:bg-accent"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Chưa có đơn đặt NCC nào</p>
      )}
    </div>
  );
}
