'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, ChevronRight, XCircle, ArrowRightCircle, Package, Layers, Loader2, FileSignature, FileText as FileTextIcon, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useChangeOrderStatus, useCancelOrder } from '@/lib/hooks/use-orders';
import { useOpenContainers, useAddPackages } from '@/lib/hooks/use-containers';
import { SupplierOrderSection } from '@/features/orders/supplier-order-section';
import { MHHIssueSection } from '@/features/orders/mhh-issue-section';
import { MHHPriceCalculator } from '@/features/orders/mhh-price-calculator';
import { OrderSaleBlock } from '@/features/orders/order-sale-block';
import { OrderGoodsBlock } from '@/features/orders/order-goods-block';
import { OrderFinanceBlock } from '@/features/orders/order-finance-block';
import { OrderOperationsBlock } from '@/features/orders/order-operations-block';
import { OrderDocumentHub } from '@/features/orders/order-document-hub';
import { OrderAuditLog } from '@/features/orders/order-audit-log';
import { OrderProjectTab } from '@/features/orders/order-project-tab';
import { OrderExtraCharges } from '@/features/orders/order-extra-charges';
import { OrderHeader } from '@/features/orders/detail/order-header';
import { OrderTracking } from '@/features/orders/detail/order-tracking';
import { OrderPackages } from '@/features/orders/detail/order-packages';
import { apiClient } from '@/lib/api/client';
import { OrderStatus as OrderStatusEnum, ServiceType as ServiceTypeEnum, ClearanceType as ClearanceTypeEnum } from '@/lib/types/enums';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
  CLEARANCE_TYPE_LABELS,
  CLEARANCE_TYPE_COLORS,
  SHIPPING_ROUTE_LABELS,
} from '@/lib/utils/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { OrderStatus, ServiceType, ClearanceType, ShippingRoute, Order } from '@/lib/types';

/** Fetch full 360 data for an order */
function useOrder360(id: string) {
  return useQuery({
    queryKey: ['orders', '360', id],
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/orders/${id}/360`);
        return res.data?.data || res.data;
      } catch {
        // Fall back to standard master order detail
        const res = await apiClient.get(`/master-orders/${id}`);
        return res.data?.data || res.data;
      }
    },
    enabled: !!id,
  });
}

/** Fetch 3-way matching report for an order */
function useThreeWayMatch(id: string) {
  return useQuery({
    queryKey: ['orders', 'three-way-match', id],
    queryFn: async () => {
      const res = await apiClient.get(`/orders/${id}/three-way-match`);
      return res.data?.data || res.data;
    },
    enabled: !!id,
  });
}

/** 3-Way Matching Report Component */
function ThreeWayMatchReport({ orderId }: { orderId: string }) {
  const { data: match, isLoading } = useThreeWayMatch(orderId);
  if (isLoading || !match) return null;

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${match.matched ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Đối chiếu 3 bên (PO / GR / Hóa đơn)</span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${match.matched ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {match.matched ? 'Khớp' : 'Chênh lệch'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">SL đặt:</span>{' '}
          <span className="font-medium">{match.quantityOrdered}</span>
        </div>
        <div>
          <span className="text-muted-foreground">SL nhận:</span>{' '}
          <span className="font-medium">{match.quantityReceived}</span>
          {match.quantityVariancePercent !== 0 && (
            <span className={`ml-1 text-xs ${match.quantityVariancePercent > 5 ? 'text-red-600' : 'text-muted-foreground'}`}>
              ({match.quantityVariancePercent > 0 ? '+' : ''}{match.quantityVariancePercent}%)
            </span>
          )}
        </div>
        <div>
          <span className="text-muted-foreground">Tổng báo giá:</span>{' '}
          <span className="font-medium">{match.totalQuotedCNY?.toLocaleString()} CNY</span>
        </div>
        <div>
          <span className="text-muted-foreground">Tổng chi:</span>{' '}
          <span className="font-medium">{match.totalPaidCNY?.toLocaleString()} CNY</span>
          {match.paymentVariancePercent !== 0 && (
            <span className={`ml-1 text-xs ${match.paymentVariancePercent > 5 ? 'text-red-600' : 'text-muted-foreground'}`}>
              ({match.paymentVariancePercent > 0 ? '+' : ''}{match.paymentVariancePercent}%)
            </span>
          )}
        </div>
      </div>
      {match.discrepancies && match.discrepancies.length > 0 && (
        <div className="space-y-1">
          {match.discrepancies.map((d: string, i: number) => (
            <p key={i} className="text-xs text-red-700">* {d}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Fetch procurement gate status for an order */
function useProcurementGate(id: string) {
  return useQuery({
    queryKey: ['orders', 'procurement-gate', id],
    queryFn: async () => {
      const res = await apiClient.get(`/orders/${id}/procurement-gate`);
      return res.data?.data || res.data;
    },
    enabled: !!id,
  });
}

/** Deposit Gate Progress Component */
function DepositGateProgress({ orderId }: { orderId: string }) {
  const { data: gate } = useProcurementGate(orderId);
  if (!gate) return null;

  const percent = Math.min(100, gate.depositPaidPercent ?? 0);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Tiến độ cọc</span>
        {gate.isPriority && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            Ưu tiên
          </span>
        )}
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted relative">
        {/* 70% marker */}
        <div className="absolute h-full w-px bg-orange-500 z-10" style={{ left: '70%' }} />
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            percent >= 100
              ? 'bg-green-500'
              : percent >= 70
                ? 'bg-blue-500'
                : 'bg-orange-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>0%</span>
        <span className="text-orange-600 font-medium">70% (Mở khóa mua hàng)</span>
        <span>100%</span>
      </div>
      <p className="text-xs text-muted-foreground">{gate.message}</p>
    </div>
  );
}

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

// ---------------------------------------------------------------------------
// Fulfillment Progress
// ---------------------------------------------------------------------------

type FulfillmentStatus = 'NONE' | 'PARTIAL' | 'FULL';

const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  NONE: 'Chưa giao',
  PARTIAL: 'Giao một phần',
  FULL: 'Đã giao đủ',
};

const FULFILLMENT_COLORS: Record<FulfillmentStatus, string> = {
  NONE: 'bg-slate-100 text-slate-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  FULL: 'bg-green-100 text-green-700',
};

function FulfillmentProgress({ subOrder }: { subOrder: Order }) {
  const packages = (subOrder as any).packages as Array<{ id: string; deliveredAt: string | null }> | undefined;
  if (!packages || packages.length === 0) return null;

  const total = packages.length;
  const delivered = packages.filter((p) => p.deliveredAt != null).length;
  const percent = total > 0 ? Math.round((delivered / total) * 100) : 0;

  let fulfillment: FulfillmentStatus = 'NONE';
  if (delivered > 0 && delivered < total) fulfillment = 'PARTIAL';
  if (delivered >= total) fulfillment = 'FULL';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {delivered}/{total} kiện đã giao
          </span>
        </div>
        <StatusBadge
          label={FULFILLMENT_LABELS[fulfillment]}
          colorClass={FULFILLMENT_COLORS[fulfillment]}
        />
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            fulfillment === 'FULL'
              ? 'bg-green-500'
              : fulfillment === 'PARTIAL'
                ? 'bg-amber-500'
                : 'bg-slate-300'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Container Consolidation Panel (ghep kien vao container)
// ---------------------------------------------------------------------------

/** Statuses that indicate packages are in CN warehouse or being consolidated */
const CONSOLIDATION_ELIGIBLE_STATUSES: OrderStatus[] = [
  OrderStatusEnum.WAREHOUSE_CN,
  OrderStatusEnum.PACKING,
  OrderStatusEnum.CONSOLIDATION,
];

function ContainerConsolidationPanel({
  subOrder,
}: {
  subOrder: Order;
}) {
  const [showPanel, setShowPanel] = useState(false);

  // Get eligible packages: warehouseCNStatus PACKED and not yet in a container
  const allPackages = ((subOrder as any).packages ?? []) as Array<{
    id: string;
    code: string;
    warehouseCNStatus: string | null;
    containerId: string | null;
    chargeableWeight: number | null;
  }>;
  const eligiblePackages = allPackages.filter(
    (p) => p.warehouseCNStatus === 'PACKED' && !p.containerId,
  );
  const alreadyAssigned = allPackages.filter((p) => !!p.containerId);

  const subStatus = subOrder.status as OrderStatus;
  const isWarehouseCNOrBeyond = CONSOLIDATION_ELIGIBLE_STATUSES.includes(subStatus);
  const isChinhNgach = subOrder.clearanceType === ClearanceTypeEnum.CHINH_NGACH;

  // Show only if: (WAREHOUSE_CN+ or chinh ngach) AND has packages at all
  if (!(isWarehouseCNOrBeyond || isChinhNgach) || allPackages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-lg border bg-indigo-50/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Layers className="h-4 w-4 text-indigo-600" />
          <span>Ghep container</span>
          {alreadyAssigned.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({alreadyAssigned.length}/{allPackages.length} kien da ghep)
            </span>
          )}
        </div>
        {eligiblePackages.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowPanel((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Layers className="h-3.5 w-3.5" />
            Ghep {eligiblePackages.length} kien
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {allPackages.length > 0 && alreadyAssigned.length === allPackages.length
              ? 'Tat ca kien da duoc ghep'
              : 'Chua co kien PACKED de ghep'}
          </span>
        )}
      </div>

      {showPanel && eligiblePackages.length > 0 && (
        <ContainerSelector
          eligiblePackages={eligiblePackages}
          shippingRoute={subOrder.shippingRoute ?? undefined}
          onDone={() => setShowPanel(false)}
        />
      )}
    </div>
  );
}

function ContainerSelector({
  eligiblePackages,
  shippingRoute,
  onDone,
}: {
  eligiblePackages: Array<{ id: string; code: string; chargeableWeight: number | null }>;
  shippingRoute?: string;
  onDone: () => void;
}) {
  const { data: containers, isLoading } = useOpenContainers(shippingRoute);
  const addPackages = useAddPackages();

  const handleAdd = (containerId: string) => {
    const packageIds = eligiblePackages.map((p) => p.id);
    addPackages.mutate(
      { id: containerId, packageIds },
      { onSuccess: () => onDone() },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tải container...
      </div>
    );
  }

  if (!containers || containers.length === 0) {
    return (
      <div className="py-3 text-sm text-muted-foreground">
        Khong co container dang mo {shippingRoute ? `cho tuyen ${SHIPPING_ROUTE_LABELS[shippingRoute as ShippingRoute] || shippingRoute}` : ''}.
        Vui long tao container truoc.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Chon container de ghep {eligiblePackages.length} kien
        (tong {eligiblePackages.reduce((s, p) => s + (p.chargeableWeight ? Number(p.chargeableWeight) : 0), 0).toFixed(1)} kg):
      </p>
      <div className="max-h-48 overflow-y-auto space-y-1.5">
        {containers.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-md border bg-white px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-3">
              <span className="font-medium">{c.code}</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                c.status === 'PLANNING' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {c.status === 'PLANNING' ? 'Ke hoach' : 'Dang xep'}
              </span>
              <span className="text-muted-foreground">
                {c.totalPackages} kien | {c.totalWeight != null ? Number(c.totalWeight).toFixed(1) : 0} kg
              </span>
              {c.estimatedDepartureAt && (
                <span className="text-muted-foreground">
                  | Khoi hanh: {formatDate(c.estimatedDepartureAt)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleAdd(c.id)}
              disabled={addPackages.isPending}
              className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {addPackages.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Layers className="h-3 w-3" />
              )}
              Ghep
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-order detail panel (used inside the Goods tab for status management)
// ---------------------------------------------------------------------------

function SubOrderDetailPanel({
  subOrder,
  masterOrder,
  changeStatus,
  cancelOrder,
}: {
  subOrder: Order;
  masterOrder: any;
  changeStatus: ReturnType<typeof useChangeOrderStatus>;
  cancelOrder: ReturnType<typeof useCancelOrder>;
}) {
  const [cancellingSubOrderId, setCancellingSubOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [changingStatus, setChangingStatus] = useState<{ subOrderId: string; nextStatus: OrderStatus; currentCode: string } | null>(null);
  const [statusChangeNote, setStatusChangeNote] = useState('');

  const subStatus = subOrder.status as OrderStatus;

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      {subStatus !== OrderStatusEnum.COMPLETED && subStatus !== OrderStatusEnum.CANCELLED && (
        <div className="flex items-center gap-2 pb-2 border-b flex-wrap">
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
              onClick={() => { setCancellingSubOrderId(null); setCancelReason(''); }}
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
            <p className="text-xs font-medium text-blue-800">Ghi chú (tùy chọn)</p>
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
              onClick={() => { setChangingStatus(null); setStatusChangeNote(''); }}
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
          {CLEARANCE_TYPE_LABELS[subOrder.clearanceType as ClearanceType]}
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
            <span className="text-muted-foreground">Mã vận đơn:</span>{' '}
            <Link
              href={`/theo-doi?tracking=${(subOrder as any).trackingNumber}`}
              className="text-primary hover:underline font-medium"
            >
              {(subOrder as any).trackingNumber}
            </Link>
          </div>
        )}
      </div>

      {/* Fulfillment Progress */}
      <FulfillmentProgress subOrder={subOrder} />

      {/* Container Consolidation */}
      <ContainerConsolidationPanel subOrder={subOrder} />

      {/* Extra Charges */}
      <OrderExtraCharges orderId={subOrder.id} orderCode={subOrder.code} />

      {/* Items */}
      {subOrder.items && subOrder.items.length > 0 && (
        <OrderPackages items={subOrder.items} currency={subOrder.currency} />
      )}

      {/* MHH Sections */}
      {subOrder.serviceType === ServiceTypeEnum.MHH && (
        <div className="space-y-4 border-t pt-4">
          <ThreeWayMatchReport orderId={subOrder.id} />
          <DepositGateProgress orderId={subOrder.id} />
          <SupplierOrderSection orderId={subOrder.id} orderCode={subOrder.code} />
          <MHHIssueSection orderId={subOrder.id} />
          <MHHPriceCalculator
            defaultRoute={subOrder.shippingRoute ?? undefined}
            defaultCustomerTier={masterOrder.customer?.tier}
          />
        </div>
      )}

      {/* Status History */}
      {subOrder.statusHistory && subOrder.statusHistory.length > 0 && (
        <OrderTracking statusHistory={subOrder.statusHistory} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MasterOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: masterOrder, isLoading, isError } = useOrder360(id);
  const changeStatus = useChangeOrderStatus();
  const cancelOrder = useCancelOrder();
  const [expandedSubOrder, setExpandedSubOrder] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <OrderHeader masterOrder={masterOrder} />

      {/* Linked Documents — Contract & Quotation */}
      {(() => {
        // Collect contract/quotation from sub-orders
        const contracts = masterOrder.subOrders
          ?.map((so: any) => so.contract)
          .filter(Boolean)
          .filter((c: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === c.id) === i) ?? [];
        const quotations = contracts
          .map((c: any) => c.quotation)
          .filter(Boolean)
          .filter((q: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === q.id) === i);
        if (contracts.length === 0 && quotations.length === 0) return null;
        return (
          <div className="flex flex-wrap items-center gap-3">
            {quotations.map((q: any) => (
              <Link key={q.id} href={`/bao-gia/${q.id}`}
                className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary/30 hover:bg-primary/5 transition-colors group">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                  <FileTextIcon className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium group-hover:text-primary">Báo giá: {q.code}</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </Link>
            ))}
            {contracts.map((c: any) => (
              <Link key={c.id} href={`/hop-dong/${c.id}`}
                className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary/30 hover:bg-primary/5 transition-colors group">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-blue-700">
                  <FileSignature className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium group-hover:text-primary">Hợp đồng: {c.code}</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </Link>
            ))}
          </div>
        );
      })()}

      {/* Tabbed 360 View */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="goods">Hàng hóa</TabsTrigger>
          <TabsTrigger value="finance">Tài chính</TabsTrigger>
          <TabsTrigger value="operations">Vận hành</TabsTrigger>
          <TabsTrigger value="project">Dự án</TabsTrigger>
          <TabsTrigger value="documents">Tài liệu</TabsTrigger>
          <TabsTrigger value="audit">Nhật ký</TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview">
          <OrderSaleBlock order={masterOrder} />
        </TabsContent>

        {/* Tab 2: Goods - includes full sub-order management */}
        <TabsContent value="goods">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Đơn con ({masterOrder.subOrders?.length ?? 0})</h3>
            {masterOrder.subOrders?.map((subOrder: Order) => {
              const isExpanded = expandedSubOrder === subOrder.id;
              const subStatus = subOrder.status as OrderStatus;
              const clearance = subOrder.clearanceType as ClearanceType;

              return (
                <div key={subOrder.id} className="rounded-lg border bg-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedSubOrder(isExpanded ? null : subOrder.id)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
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

                  {isExpanded && (
                    <div className="border-t px-6 py-4">
                      <SubOrderDetailPanel
                        subOrder={subOrder}
                        masterOrder={masterOrder}
                        changeStatus={changeStatus}
                        cancelOrder={cancelOrder}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Also show goods-only summary */}
            <OrderGoodsBlock order={masterOrder} />
          </div>
        </TabsContent>

        {/* Tab 3: Finance */}
        <TabsContent value="finance">
          <OrderFinanceBlock order={masterOrder} />
        </TabsContent>

        {/* Tab 4: Operations */}
        <TabsContent value="operations">
          <OrderOperationsBlock order={masterOrder} />
        </TabsContent>

        {/* Tab 5: Project View */}
        <TabsContent value="project">
          <OrderProjectTab orderId={id} orderCode={masterOrder.code || id} />
        </TabsContent>

        {/* Tab 6: Documents */}
        <TabsContent value="documents">
          <OrderDocumentHub
            orderId={id}
            documents={masterOrder.documents || []}
          />
        </TabsContent>

        {/* Tab 6: Audit Log */}
        <TabsContent value="audit">
          <OrderAuditLog order={masterOrder} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
