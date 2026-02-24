'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, ChevronDown, ChevronRight, XCircle, ArrowRightCircle, Copy, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useMasterOrder, useChangeOrderStatus, useCancelOrder } from '@/lib/hooks/use-orders';
import { SupplierOrderSection } from '@/features/orders/supplier-order-section';
import { MHHIssueSection } from '@/features/orders/mhh-issue-section';
import { MHHPriceCalculator } from '@/features/orders/mhh-price-calculator';
import { OrderSaleBlock } from '@/features/orders/order-sale-block';
import { OrderGoodsBlock } from '@/features/orders/order-goods-block';
import { OrderFinanceBlock } from '@/features/orders/order-finance-block';
import { OrderOperationsBlock } from '@/features/orders/order-operations-block';
import { OrderDocumentHub } from '@/features/orders/order-document-hub';
import { OrderAuditLog } from '@/features/orders/order-audit-log';
import { OrderExtraCharges } from '@/features/orders/order-extra-charges';
import { apiClient } from '@/lib/api/client';
import { OrderStatus as OrderStatusEnum, ServiceType as ServiceTypeEnum } from '@/lib/types/enums';
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
        <span className="text-sm font-medium">3-Way Match (PO / GR / Invoice)</span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${match.matched ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {match.matched ? 'Khop' : 'Chenh lech'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">SL dat:</span>{' '}
          <span className="font-medium">{match.quantityOrdered}</span>
        </div>
        <div>
          <span className="text-muted-foreground">SL nhan:</span>{' '}
          <span className="font-medium">{match.quantityReceived}</span>
          {match.quantityVariancePercent !== 0 && (
            <span className={`ml-1 text-xs ${match.quantityVariancePercent > 5 ? 'text-red-600' : 'text-muted-foreground'}`}>
              ({match.quantityVariancePercent > 0 ? '+' : ''}{match.quantityVariancePercent}%)
            </span>
          )}
        </div>
        <div>
          <span className="text-muted-foreground">Tong bao gia:</span>{' '}
          <span className="font-medium">{match.totalQuotedCNY?.toLocaleString()} CNY</span>
        </div>
        <div>
          <span className="text-muted-foreground">Tong chi:</span>{' '}
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
        <span className="text-sm font-medium">Tien do coc</span>
        {gate.isPriority && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            Priority
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
        <span className="text-orange-600 font-medium">70% (Mo khoa mua hang)</span>
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
  NONE: 'Chua giao',
  PARTIAL: 'Giao mot phan',
  FULL: 'Da giao du',
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
            {delivered}/{total} kien da giao
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
            Huy don
          </button>
        </div>
      )}

      {/* Cancel dialog */}
      {cancellingSubOrderId === subOrder.id && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-3">
          <p className="text-sm font-medium text-red-800">Xac nhan huy don {subOrder.code}?</p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Nhap ly do huy don..."
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
              {cancelOrder.isPending ? 'Dang huy...' : 'Xac nhan huy'}
            </button>
            <button
              type="button"
              onClick={() => { setCancellingSubOrderId(null); setCancelReason(''); }}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Dong
            </button>
          </div>
        </div>
      )}

      {/* Status Change Confirm Dialog */}
      {changingStatus && changingStatus.subOrderId === subOrder.id && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 space-y-3">
          <p className="text-sm font-medium text-blue-800">
            Xac nhan chuyen trang thai don {changingStatus.currentCode} sang{' '}
            <span className="font-bold">{ORDER_STATUS_LABELS[changingStatus.nextStatus]}</span>?
          </p>
          <div className="space-y-2">
            <label className="text-xs font-medium text-blue-800">Ghi chu (tuy chon)</label>
            <textarea
              value={statusChangeNote}
              onChange={(e) => setStatusChangeNote(e.target.value)}
              placeholder="Nhap ghi chu khi chuyen trang thai..."
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
              {changeStatus.isPending ? 'Dang xu ly...' : 'Xac nhan'}
            </button>
            <button
              type="button"
              onClick={() => { setChangingStatus(null); setStatusChangeNote(''); }}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Huy
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Loai dich vu:</span>{' '}
          {SERVICE_TYPE_LABELS[subOrder.serviceType as ServiceType]}
        </div>
        <div>
          <span className="text-muted-foreground">Thong quan:</span>{' '}
          {CLEARANCE_TYPE_LABELS[subOrder.clearanceType as ClearanceType]}
        </div>
        <div>
          <span className="text-muted-foreground">Tuyen:</span>{' '}
          {subOrder.shippingRoute ? SHIPPING_ROUTE_LABELS[subOrder.shippingRoute as ShippingRoute] : '---'}
        </div>
        <div>
          <span className="text-muted-foreground">Dat coc:</span>{' '}
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

      {/* Fulfillment Progress */}
      <FulfillmentProgress subOrder={subOrder} />

      {/* Extra Charges */}
      <OrderExtraCharges orderId={subOrder.id} orderCode={subOrder.code} />

      {/* Items */}
      {subOrder.items && subOrder.items.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Hang hoa</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">San pham</th>
                <th className="pb-2 font-medium">SL</th>
                <th className="pb-2 font-medium text-right">Don gia</th>
                <th className="pb-2 font-medium text-right">Thanh tien</th>
              </tr>
            </thead>
            <tbody>
              {subOrder.items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">
                    <p>{item.productName}</p>
                    {item.productUrl && (
                      <a href={item.productUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        Link san pham
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
        <div>
          <h4 className="text-sm font-semibold mb-2">Lich su trang thai</h4>
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
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MasterOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: masterOrder, isLoading, isError } = useOrder360(id);
  const changeStatus = useChangeOrderStatus();
  const cancelOrder = useCancelOrder();
  const [expandedSubOrder, setExpandedSubOrder] = useState<string | null>(null);

  if (isLoading) return <LoadingOverlay className="h-[60vh]" />;
  if (isError) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive font-medium">Loi tai du lieu</p>
        <p className="text-sm text-muted-foreground mt-1">Khong the tai thong tin don hang. Vui long thu lai.</p>
        <Link href="/don-hang" className="text-primary hover:underline mt-2 inline-block">
          Quay lai danh sach
        </Link>
      </div>
    );
  }
  if (!masterOrder) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Khong tim thay don hang</p>
        <Link href="/don-hang" className="text-primary hover:underline mt-2 inline-block">
          Quay lai danh sach
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
            Tao luc {formatDateTime(masterOrder.createdAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            try {
              if (typeof window === 'undefined') return;
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
              toast?.error('Khong the chuan bi du lieu sao chep');
            }
          }}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          <Copy className="h-4 w-4" />
          Tao don tuong tu
        </button>
      </div>

      {/* Tabbed 360 View */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview">Tong quan</TabsTrigger>
          <TabsTrigger value="goods">Hang hoa</TabsTrigger>
          <TabsTrigger value="finance">Tai chinh</TabsTrigger>
          <TabsTrigger value="operations">Van hanh</TabsTrigger>
          <TabsTrigger value="documents">Tai lieu</TabsTrigger>
          <TabsTrigger value="audit">Nhat ky</TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview">
          <OrderSaleBlock order={masterOrder} />
        </TabsContent>

        {/* Tab 2: Goods - includes full sub-order management */}
        <TabsContent value="goods">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Don con ({masterOrder.subOrders?.length ?? 0})</h3>
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

        {/* Tab 5: Documents */}
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
