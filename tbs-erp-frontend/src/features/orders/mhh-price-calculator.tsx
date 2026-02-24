'use client';

import { useState, useEffect } from 'react';
import { Calculator, Loader2 } from 'lucide-react';
import { useCalculateMHHPrice } from '@/lib/hooks/use-mhh-issues';
import { SHIPPING_ROUTE_LABELS, CUSTOMER_TIER_LABELS } from '@/lib/utils/constants';
import { formatCurrency, formatPercent } from '@/lib/utils/format';
import { ShippingRoute, CustomerTier } from '@/lib/types/enums';
import type { MHHPriceCalculateDto, MHHPriceResult } from '@/lib/types';

interface MHHPriceCalculatorProps {
  /** Pre-fill shipping route from order */
  defaultRoute?: string;
  /** Pre-fill customer tier */
  defaultCustomerTier?: string;
  /** Callback when price is calculated */
  onPriceCalculated?: (result: MHHPriceResult) => void;
}

export function MHHPriceCalculator({
  defaultRoute,
  defaultCustomerTier,
  onPriceCalculated,
}: MHHPriceCalculatorProps) {
  const calculatePrice = useCalculateMHHPrice();

  const [form, setForm] = useState<MHHPriceCalculateDto>({
    productPriceCNY: 0,
    quantity: 1,
    domesticShippingCNY: 0,
    estimatedWeightKg: 0,
    shippingRoute: (defaultRoute as 'SEA' | 'ROAD' | 'AIR') || undefined,
    customerTier: defaultCustomerTier || undefined,
  });

  const [result, setResult] = useState<MHHPriceResult | null>(null);

  const handleCalculate = () => {
    if (form.productPriceCNY <= 0 || form.quantity <= 0) return;

    const payload: MHHPriceCalculateDto = {
      productPriceCNY: form.productPriceCNY,
      quantity: form.quantity,
      ...(form.domesticShippingCNY && form.domesticShippingCNY > 0 && { domesticShippingCNY: form.domesticShippingCNY }),
      ...(form.estimatedWeightKg && form.estimatedWeightKg > 0 && { estimatedWeightKg: form.estimatedWeightKg }),
      ...(form.shippingRoute && { shippingRoute: form.shippingRoute }),
      ...(form.customerTier && { customerTier: form.customerTier }),
    };

    calculatePrice.mutate(payload, {
      onSuccess: (data) => {
        setResult(data);
        onPriceCalculated?.(data);
      },
    });
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Calculator className="h-4 w-4" />
        Tính giá MHH
      </h4>

      {/* Input fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Giá sản phẩm (CNY) *</label>
          <input
            type="number"
            value={form.productPriceCNY || ''}
            onChange={(e) => setForm((p) => ({ ...p, productPriceCNY: Number(e.target.value) || 0 }))}
            placeholder="0"
            min={0}
            step={0.01}
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Số lượng *</label>
          <input
            type="number"
            value={form.quantity || ''}
            onChange={(e) => setForm((p) => ({ ...p, quantity: Number(e.target.value) || 0 }))}
            placeholder="1"
            min={1}
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Ship nội TQ (CNY)</label>
          <input
            type="number"
            value={form.domesticShippingCNY || ''}
            onChange={(e) => setForm((p) => ({ ...p, domesticShippingCNY: Number(e.target.value) || 0 }))}
            placeholder="0"
            min={0}
            step={0.01}
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">KL ước tính (kg)</label>
          <input
            type="number"
            value={form.estimatedWeightKg || ''}
            onChange={(e) => setForm((p) => ({ ...p, estimatedWeightKg: Number(e.target.value) || 0 }))}
            placeholder="0"
            min={0}
            step={0.1}
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Tuyến vận chuyển</label>
          <select
            value={form.shippingRoute || ''}
            onChange={(e) => setForm((p) => ({ ...p, shippingRoute: (e.target.value || undefined) as any }))}
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
          >
            <option value="">-- Chọn tuyến --</option>
            {Object.values(ShippingRoute).map((route) => (
              <option key={route} value={route}>
                {SHIPPING_ROUTE_LABELS[route]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Hạng khách</label>
          <select
            value={form.customerTier || ''}
            onChange={(e) => setForm((p) => ({ ...p, customerTier: e.target.value || undefined }))}
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
          >
            <option value="">-- Chọn hạng --</option>
            {Object.values(CustomerTier).map((tier) => (
              <option key={tier} value={tier}>
                {CUSTOMER_TIER_LABELS[tier]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={handleCalculate}
        disabled={form.productPriceCNY <= 0 || form.quantity <= 0 || calculatePrice.isPending}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {calculatePrice.isPending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tính...
          </span>
        ) : (
          'Tính giá'
        )}
      </button>

      {/* Result */}
      {result && (
        <div className="rounded-md border bg-muted/30 p-4 space-y-3">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chi tiết giá MHH</h5>

          {/* Per unit breakdown */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Đơn giá (1 SP)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="text-muted-foreground">Giá sản phẩm:</div>
              <div className="text-right">{formatCurrency(result.perUnit.productPriceCNY, 'CNY')}</div>
              <div className="text-muted-foreground">
                Phí dịch vụ ({formatPercent(result.perUnit.serviceFeePercent)}):
              </div>
              <div className="text-right">{formatCurrency(result.perUnit.serviceFeeAmountCNY, 'CNY')}</div>
              <div className="text-muted-foreground">Ship nội TQ:</div>
              <div className="text-right">{formatCurrency(result.perUnit.domesticShippingCNY, 'CNY')}</div>
              <div className="text-muted-foreground font-medium border-t pt-1">Đơn giá:</div>
              <div className="text-right font-medium border-t pt-1">{formatCurrency(result.perUnit.subtotalCNY, 'CNY')}</div>
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-1.5 border-t pt-3">
            <p className="text-xs font-medium">Tổng cộng ({result.totals.quantity} SP)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="text-muted-foreground">Tổng CNY:</div>
              <div className="text-right">{formatCurrency(result.totals.subtotalCNY, 'CNY')}</div>
              <div className="text-muted-foreground">Tỷ giá:</div>
              <div className="text-right">{result.totals.exchangeRate.toLocaleString('vi-VN')}</div>
              <div className="text-muted-foreground">Tổng VND (hàng):</div>
              <div className="text-right">{formatCurrency(result.totals.subtotalVND, 'VND')}</div>
              <div className="text-muted-foreground">Phí vận chuyển VN:</div>
              <div className="text-right">{formatCurrency(result.totals.estimatedShippingVND, 'VND')}</div>
              <div className="text-muted-foreground font-semibold border-t pt-1 text-foreground">TỔNG THANH TOÁN:</div>
              <div className="text-right font-bold text-lg border-t pt-1 text-primary">
                {formatCurrency(result.totals.grandTotalVND, 'VND')}
              </div>
            </div>
          </div>

          {/* Meta info */}
          {(result.shippingRoute || result.customerTier) && (
            <div className="flex gap-4 text-xs text-muted-foreground pt-1 border-t">
              {result.shippingRoute && (
                <span>Tuyến: {SHIPPING_ROUTE_LABELS[result.shippingRoute as ShippingRoute] || result.shippingRoute}</span>
              )}
              {result.customerTier && (
                <span>Hạng: {CUSTOMER_TIER_LABELS[result.customerTier as CustomerTier] || result.customerTier}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
