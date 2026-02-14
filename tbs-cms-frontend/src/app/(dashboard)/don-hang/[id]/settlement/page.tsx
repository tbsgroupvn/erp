'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Banknote, Receipt, Truck } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { useMasterOrder } from '@/lib/hooks/use-orders';
import { useSupplierOrdersByOrder } from '@/lib/hooks/use-supplier-orders';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  BRANCH_LABELS,
} from '@/lib/utils/constants';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format';
import { Currency } from '@/lib/types/enums';
import type { OrderStatus, ServiceType, Branch, Order, OrderItem } from '@/lib/types';
import type { SupplierOrder } from '@/lib/types/supplier-order.types';

// ---------------------------------------------------------------------------
// Local label maps for supplier order statuses
// ---------------------------------------------------------------------------
const SUPPLIER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  QUOTED: 'Đã báo giá',
  ORDERED: 'Đã đặt',
  CONFIRMED: 'Đã xác nhận',
  PARTIALLY_SHIPPED: 'Giao 1 phần',
  SHIPPED_CN: 'Đã giao (TQ)',
  RECEIVED_CN: 'Đã nhận (TQ)',
  CANCELLED: 'Đã hủy',
  ISSUE: 'Có vấn đề',
};

const SUPPLIER_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  QUOTED: 'bg-blue-100 text-blue-700',
  ORDERED: 'bg-indigo-100 text-indigo-700',
  CONFIRMED: 'bg-purple-100 text-purple-700',
  PARTIALLY_SHIPPED: 'bg-amber-100 text-amber-700',
  SHIPPED_CN: 'bg-cyan-100 text-cyan-700',
  RECEIVED_CN: 'bg-teal-100 text-teal-700',
  CANCELLED: 'bg-red-100 text-red-700',
  ISSUE: 'bg-destructive/10 text-destructive',
};

// ---------------------------------------------------------------------------
// Payment allocation type (potentially embedded in order response)
// ---------------------------------------------------------------------------
interface PaymentAllocation {
  id: string;
  amount: number;
  currency: Currency;
  paymentMethod: string;
  reference: string | null;
  note: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default function SettlementPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: masterOrder, isLoading: loadingOrder, isError: errorOrder } = useMasterOrder(id);
  const { data: supplierOrders, isLoading: loadingSupplier } = useSupplierOrdersByOrder(id);

  // Determine the primary sub-order (first MHH sub-order, or just the first)
  const subOrder: Order | undefined = useMemo(() => {
    if (!masterOrder?.subOrders?.length) return undefined;
    return (
      masterOrder.subOrders.find((so: Order) => so.serviceType === 'MHH') ??
      masterOrder.subOrders[0]
    );
  }, [masterOrder]);

  // Build a lookup from order item to its matching supplier order actual price
  const supplierActualMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!supplierOrders?.length || !subOrder?.items?.length) return map;

    // SupplierOrder is 1:1 with an order. Distribute actual cost proportionally
    // across items based on their quoted price weight.
    const totalQuoted = (supplierOrders as SupplierOrder[]).reduce(
      (s, so) => s + (so.quotedPriceCNY ?? 0),
      0,
    );
    const totalActual = (supplierOrders as SupplierOrder[]).reduce(
      (s, so) => s + (so.actualPriceCNY ?? so.quotedPriceCNY ?? 0),
      0,
    );

    // Store aggregate totals for the financial summary section
    map.set('__totalQuoted__', totalQuoted);
    map.set('__totalActual__', totalActual);

    return map;
  }, [supplierOrders, subOrder]);

  // Build per-item comparison rows
  const comparisonRows = useMemo(() => {
    if (!subOrder?.items?.length) return [];

    const totalActualCNY = supplierActualMap.get('__totalActual__') ?? 0;
    const itemsTotal = subOrder.items.reduce((s, it) => s + it.totalPrice, 0);

    return subOrder.items.map((item: OrderItem) => {
      const serviceFee = (item as any).serviceFeeAmount ?? 0;
      const domesticShippingCN = (item as any).domesticShippingCN ?? 0;

      // Proportional actual cost based on item weight in the order
      const weight = itemsTotal > 0 ? item.totalPrice / itemsTotal : 0;
      const actualSupplierPrice =
        (item as any).actualSupplierPrice ?? totalActualCNY * weight;

      const customerCostPerItem = item.unitPrice + serviceFee + domesticShippingCN;
      const diff = customerCostPerItem * item.quantity - actualSupplierPrice;

      return {
        id: item.id,
        productName: item.productName,
        productUrl: item.productUrl,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        serviceFee,
        domesticShippingCN,
        quotedTotal: item.totalPrice,
        actualSupplierPrice,
        diff,
        currency: item.currency,
      };
    });
  }, [subOrder, supplierActualMap]);

  // Subtotals
  const subtotals = useMemo(() => {
    const totQuoted = comparisonRows.reduce((s, r) => s + r.quotedTotal, 0);
    const totServiceFee = comparisonRows.reduce((s, r) => s + r.serviceFee * r.quantity, 0);
    const totShipCN = comparisonRows.reduce((s, r) => s + r.domesticShippingCN * r.quantity, 0);
    const totActual = comparisonRows.reduce((s, r) => s + r.actualSupplierPrice, 0);
    const totDiff = comparisonRows.reduce((s, r) => s + r.diff, 0);
    return { totQuoted, totServiceFee, totShipCN, totActual, totDiff };
  }, [comparisonRows]);

  // Exchange rate & financial summary
  const exchangeRate = (subOrder as any)?.exchangeRate ?? (masterOrder as any)?.exchangeRate ?? 0;
  const currency = subOrder?.currency ?? Currency.CNY;

  const totalOrderValueVND = subOrder?.totalAmount
    ? currency === Currency.CNY
      ? subOrder.totalAmount * (exchangeRate || 1)
      : subOrder.totalAmount
    : 0;

  const depositPaid = subOrder?.depositPaid ?? 0;
  const depositPaidVND = currency === Currency.CNY ? depositPaid * (exchangeRate || 1) : depositPaid;

  const remainingBalance = totalOrderValueVND - depositPaidVND;

  // Supplier cost totals (using actual fields from SupplierOrder type)
  const totalSupplierCostCNY = (supplierOrders as SupplierOrder[] | undefined)?.reduce(
    (s, so) => s + (so.actualPriceCNY ?? so.quotedPriceCNY ?? 0),
    0,
  ) ?? 0;
  const totalSupplierCostVND = totalSupplierCostCNY * (exchangeRate || 1);

  const profit = totalOrderValueVND - totalSupplierCostVND;
  const marginPercent = totalOrderValueVND > 0 ? (profit / totalOrderValueVND) * 100 : 0;

  // Payment history (optionally populated on the sub-order by the API)
  const payments: PaymentAllocation[] = (subOrder as any)?.payments ?? [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loadingOrder || loadingSupplier) return <LoadingOverlay className="h-[60vh]" />;

  if (errorOrder) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive font-medium">Lỗi tải dữ liệu</p>
        <p className="text-sm text-muted-foreground mt-1">
          Không thể tải thông tin quyết toán. Vui lòng thử lại.
        </p>
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
      {/* ------------------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-4">
        <Link
          href={`/don-hang/${id}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <PageHeader
            title={`Quyết toán - ${masterOrder.code}`}
            description="So sánh giá báo khách hàng với chi phí thực tế NCC"
            className="pb-0 border-b-0 mb-0"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 1. Order Summary Header */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Thông tin đơn hàng</h3>
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          <dl className="space-y-1 text-sm">
            <dt className="text-muted-foreground">Mã đơn</dt>
            <dd className="font-medium">
              <Link href={`/don-hang/${id}`} className="text-primary hover:underline">
                {masterOrder.code}
              </Link>
            </dd>
          </dl>
          <dl className="space-y-1 text-sm">
            <dt className="text-muted-foreground">Khách hàng</dt>
            <dd className="font-medium">{masterOrder.customer?.fullName ?? '---'}</dd>
          </dl>
          <dl className="space-y-1 text-sm">
            <dt className="text-muted-foreground">Loại dịch vụ</dt>
            <dd>
              {subOrder ? (
                <StatusBadge
                  label={SERVICE_TYPE_LABELS[subOrder.serviceType as ServiceType] || subOrder.serviceType}
                  colorClass="bg-blue-50 text-blue-700"
                />
              ) : (
                '---'
              )}
            </dd>
          </dl>
          <dl className="space-y-1 text-sm">
            <dt className="text-muted-foreground">Trạng thái</dt>
            <dd>
              {subOrder ? (
                <StatusBadge
                  label={ORDER_STATUS_LABELS[subOrder.status as OrderStatus] || subOrder.status}
                  colorClass={ORDER_STATUS_COLORS[subOrder.status as OrderStatus] || 'bg-gray-100 text-gray-700'}
                />
              ) : (
                '---'
              )}
            </dd>
          </dl>
          <dl className="space-y-1 text-sm">
            <dt className="text-muted-foreground">Chi nhánh</dt>
            <dd>{BRANCH_LABELS[masterOrder.branch as Branch] || masterOrder.branch}</dd>
          </dl>
          <dl className="space-y-1 text-sm">
            <dt className="text-muted-foreground">Sale</dt>
            <dd>{masterOrder.sale?.fullName ?? '---'}</dd>
          </dl>
          <dl className="space-y-1 text-sm">
            <dt className="text-muted-foreground">Ngày tạo</dt>
            <dd>{formatDateTime(masterOrder.createdAt)}</dd>
          </dl>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Bảng so sánh giá (Price Comparison Table) */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Bảng so sánh giá</h3>
        {comparisonRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có sản phẩm nào trong đơn.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Sản phẩm</th>
                  <th className="pb-2 font-medium text-right">SL</th>
                  <th className="pb-2 font-medium text-right">Giá báo KH (CNY)</th>
                  <th className="pb-2 font-medium text-right">Phí DV (CNY)</th>
                  <th className="pb-2 font-medium text-right">Ship TQ (CNY)</th>
                  <th className="pb-2 font-medium text-right">Giá thực mua (CNY)</th>
                  <th className="pb-2 font-medium text-right">Chênh lệch (CNY)</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="py-2">
                      <p>{row.productName}</p>
                      {row.productUrl && (
                        <a
                          href={row.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Link sản phẩm
                        </a>
                      )}
                    </td>
                    <td className="py-2 text-right">{row.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(row.unitPrice, Currency.CNY)}</td>
                    <td className="py-2 text-right">{formatCurrency(row.serviceFee, Currency.CNY)}</td>
                    <td className="py-2 text-right">{formatCurrency(row.domesticShippingCN, Currency.CNY)}</td>
                    <td className="py-2 text-right">{formatCurrency(row.actualSupplierPrice, Currency.CNY)}</td>
                    <td className={`py-2 text-right font-medium ${row.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.diff >= 0 ? '+' : ''}
                      {formatCurrency(row.diff, Currency.CNY)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-semibold">
                  <td className="pt-3" colSpan={2}>
                    Tổng cộng
                  </td>
                  <td className="pt-3 text-right">
                    {formatCurrency(
                      comparisonRows.reduce((s, r) => s + r.unitPrice * r.quantity, 0),
                      Currency.CNY,
                    )}
                  </td>
                  <td className="pt-3 text-right">{formatCurrency(subtotals.totServiceFee, Currency.CNY)}</td>
                  <td className="pt-3 text-right">{formatCurrency(subtotals.totShipCN, Currency.CNY)}</td>
                  <td className="pt-3 text-right">{formatCurrency(subtotals.totActual, Currency.CNY)}</td>
                  <td
                    className={`pt-3 text-right ${subtotals.totDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {subtotals.totDiff >= 0 ? '+' : ''}
                    {formatCurrency(subtotals.totDiff, Currency.CNY)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Tỷ giá & Quy đổi (Exchange Rate Section) */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Tỷ giá & Quy đổi</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <dl className="space-y-1 text-sm">
            <dt className="text-muted-foreground">Tỷ giá áp dụng</dt>
            <dd className="text-lg font-semibold">
              {exchangeRate > 0
                ? `1 CNY = ${new Intl.NumberFormat('vi-VN').format(exchangeRate)} VND`
                : 'Chưa có tỷ giá'}
            </dd>
          </dl>
          <dl className="space-y-1 text-sm">
            <dt className="text-muted-foreground">Tổng CNY</dt>
            <dd className="text-lg font-semibold">{formatCurrency(subOrder?.totalAmount ?? 0, Currency.CNY)}</dd>
          </dl>
          <dl className="space-y-1 text-sm">
            <dt className="text-muted-foreground">Quy đổi VND</dt>
            <dd className="text-lg font-semibold">{formatCurrency(totalOrderValueVND, Currency.VND)}</dd>
          </dl>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Tổng kết tài chính (Financial Summary) */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Tổng kết tài chính</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Tổng giá trị đơn */}
          <div className="rounded-lg border p-4 flex items-start gap-3">
            <div className="rounded-md bg-blue-50 p-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tổng giá trị đơn (VND)</p>
              <p className="text-lg font-bold">{formatCurrency(totalOrderValueVND, Currency.VND)}</p>
            </div>
          </div>

          {/* Đã đặt cọc */}
          <div className="rounded-lg border p-4 flex items-start gap-3">
            <div className="rounded-md bg-green-50 p-2">
              <Banknote className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Đã đặt cọc (VND)</p>
              <p className="text-lg font-bold">{formatCurrency(depositPaidVND, Currency.VND)}</p>
            </div>
          </div>

          {/* Còn phải thu */}
          <div className="rounded-lg border p-4 flex items-start gap-3">
            <div className="rounded-md bg-amber-50 p-2">
              <Receipt className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Còn phải thu (VND)</p>
              <p className={`text-lg font-bold ${remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(remainingBalance, Currency.VND)}
              </p>
            </div>
          </div>

          {/* Chi phí thực tế */}
          <div className="rounded-lg border p-4 flex items-start gap-3">
            <div className="rounded-md bg-purple-50 p-2">
              <Truck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Chi phí thực tế (VND)</p>
              <p className="text-lg font-bold">{formatCurrency(totalSupplierCostVND, Currency.VND)}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(totalSupplierCostCNY, Currency.CNY)}
              </p>
            </div>
          </div>

          {/* Lợi nhuận */}
          <div className="rounded-lg border p-4 flex items-start gap-3">
            <div className={`rounded-md p-2 ${profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              {profit >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lợi nhuận (VND)</p>
              <p className={`text-lg font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {profit >= 0 ? '+' : ''}
                {formatCurrency(profit, Currency.VND)}
              </p>
            </div>
          </div>

          {/* Margin % */}
          <div className="rounded-lg border p-4 flex items-start gap-3">
            <div className={`rounded-md p-2 ${marginPercent >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              {marginPercent >= 0 ? (
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Margin</p>
              <p className={`text-lg font-bold ${marginPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {marginPercent.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 5. Lịch sử thanh toán (Payment History) */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Lịch sử thanh toán</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có lịch sử thanh toán.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Thời gian</th>
                  <th className="pb-2 font-medium text-right">Số tiền</th>
                  <th className="pb-2 font-medium">Phương thức</th>
                  <th className="pb-2 font-medium">Mã tham chiếu</th>
                  <th className="pb-2 font-medium">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2">{formatDateTime(p.createdAt)}</td>
                    <td className="py-2 text-right font-medium">
                      {formatCurrency(p.amount, p.currency ?? Currency.VND)}
                    </td>
                    <td className="py-2">
                      {PAYMENT_METHOD_LABELS[p.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? p.paymentMethod}
                    </td>
                    <td className="py-2">{p.reference ?? '---'}</td>
                    <td className="py-2">{p.note ?? '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 6. Đơn NCC (Supplier Orders) */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">
          Đơn NCC ({(supplierOrders as SupplierOrder[] | undefined)?.length ?? 0})
        </h3>
        {!supplierOrders || (supplierOrders as SupplierOrder[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có đơn NCC nào.</p>
        ) : (
          <div className="space-y-4">
            {(supplierOrders as SupplierOrder[]).map((so) => (
              <div key={so.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{so.code}</span>
                    <StatusBadge
                      label={SUPPLIER_STATUS_LABELS[so.status] || so.status}
                      colorClass={SUPPLIER_STATUS_COLORS[so.status] || 'bg-gray-100 text-gray-700'}
                    />
                  </div>
                  <span className="font-medium text-sm">
                    {formatCurrency(so.actualPriceCNY ?? so.quotedPriceCNY ?? 0, Currency.CNY)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <span className="text-muted-foreground">NCC:</span>{' '}
                    <span className="font-medium">{so.supplierName}</span>
                  </div>
                  {so.supplierPlatform && (
                    <div>
                      <span className="text-muted-foreground">Nền tảng:</span>{' '}
                      <span className="font-medium">{so.supplierPlatform}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Giá báo (CNY):</span>{' '}
                    <span className="font-medium">{formatCurrency(so.quotedPriceCNY ?? 0, Currency.CNY)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Giá thực (CNY):</span>{' '}
                    <span className="font-medium">
                      {so.actualPriceCNY != null
                        ? formatCurrency(so.actualPriceCNY, Currency.CNY)
                        : '---'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">SL đặt:</span>{' '}
                    <span className="font-medium">{so.quantityOrdered}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">SL nhận:</span>{' '}
                    <span className={`font-medium ${so.quantityReceived < so.quantityOrdered ? 'text-amber-600' : ''}`}>
                      {so.quantityReceived}
                    </span>
                  </div>
                  {so.trackingNumberCN && (
                    <div>
                      <span className="text-muted-foreground">Tracking TQ:</span>{' '}
                      <span className="font-medium">{so.trackingNumberCN}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Ngày tạo:</span>{' '}
                    <span>{formatDate(so.createdAt)}</span>
                  </div>
                </div>
                {so.note && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Ghi chú: {so.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
