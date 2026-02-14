'use client';

import { useState, useMemo, useCallback } from 'react';
import { Loader2, Copy, Calculator, Check, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { ShippingRoute, CustomerTier } from '@/lib/types';
import { SHIPPING_ROUTE_LABELS, CUSTOMER_TIER_LABELS } from '@/lib/utils/constants';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Default rates for local (offline) calculation
// ---------------------------------------------------------------------------
const DEFAULT_EXCHANGE_RATE = 3500; // VND per CNY
const DEFAULT_SERVICE_FEE_PERCENT = 5; // %

const SHIPPING_VN_RATES: Record<ShippingRoute, number> = {
  [ShippingRoute.SEA]: 18_000,   // VND/kg
  [ShippingRoute.ROAD]: 25_000,  // VND/kg
  [ShippingRoute.AIR]: 80_000,   // VND/kg
};

// Discount by customer tier (applied on service fee)
const TIER_DISCOUNT: Record<CustomerTier, number> = {
  [CustomerTier.NEW]: 0,
  [CustomerTier.REGULAR]: 0,
  [CustomerTier.VIP]: 0.5,       // 0.5% off service fee
  [CustomerTier.STRATEGIC]: 1,   // 1% off service fee
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CalculationResult {
  productPriceCNY: number;
  serviceFeeCNY: number;
  serviceFeePercent: number;
  shipCNCNY: number;
  totalPerItemCNY: number;
  quantity: number;
  totalCNY: number;
  exchangeRate: number;
  totalVND: number;
  estimatedWeight: number;
  shippingVNRate: number;
  shippingVNTotal: number;
  grandTotalVND: number;
  tierDiscount: number;
}

interface MHHPriceCalculatorProps {
  /** When embedded in a form, callback to pass the calculated result */
  onCalculated?: (result: CalculationResult) => void;
  /** Additional CSS class for the wrapper */
  className?: string;
  /** Compact mode for embedding in order form */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function MHHPriceCalculator({
  onCalculated,
  className,
  compact = false,
}: MHHPriceCalculatorProps) {
  // --- Input state ---
  const [productPrice, setProductPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [shipCN, setShipCN] = useState<string>('0');
  const [estimatedWeight, setEstimatedWeight] = useState<string>('');
  const [shippingRoute, setShippingRoute] = useState<ShippingRoute>(ShippingRoute.ROAD);
  const [customerTier, setCustomerTier] = useState<CustomerTier | ''>('');

  // --- API state ---
  const [isCalculating, setIsCalculating] = useState(false);
  const [apiResult, setApiResult] = useState<CalculationResult | null>(null);
  const [copied, setCopied] = useState(false);

  // --- Derived values (local real-time calculation) ---
  const localResult = useMemo<CalculationResult | null>(() => {
    const price = parseFloat(productPrice) || 0;
    const qty = parseInt(quantity) || 0;
    const ship = parseFloat(shipCN) || 0;
    const weight = parseFloat(estimatedWeight) || 0;

    if (price <= 0 || qty <= 0) return null;

    const tierKey = customerTier || null;
    const tierDiscountPct = tierKey ? (TIER_DISCOUNT[tierKey] ?? 0) : 0;
    const effectiveServicePct = DEFAULT_SERVICE_FEE_PERCENT - tierDiscountPct;

    const serviceFeeCNY = price * (effectiveServicePct / 100);
    const totalPerItemCNY = price + serviceFeeCNY + ship;
    const totalCNY = totalPerItemCNY * qty;
    const totalVND = totalCNY * DEFAULT_EXCHANGE_RATE;

    const shippingVNRate = SHIPPING_VN_RATES[shippingRoute];
    const shippingVNTotal = weight * shippingVNRate;
    const grandTotalVND = totalVND + shippingVNTotal;

    return {
      productPriceCNY: price,
      serviceFeeCNY,
      serviceFeePercent: effectiveServicePct,
      shipCNCNY: ship,
      totalPerItemCNY,
      quantity: qty,
      totalCNY,
      exchangeRate: DEFAULT_EXCHANGE_RATE,
      totalVND,
      estimatedWeight: weight,
      shippingVNRate,
      shippingVNTotal,
      grandTotalVND,
      tierDiscount: tierDiscountPct,
    };
  }, [productPrice, quantity, shipCN, estimatedWeight, shippingRoute, customerTier]);

  // The result to display: prefer API result, fallback to local
  const displayResult = apiResult ?? localResult;

  // --- API calculation ---
  const handleCalculate = useCallback(async () => {
    const price = parseFloat(productPrice) || 0;
    const qty = parseInt(quantity) || 0;
    const weight = parseFloat(estimatedWeight) || 0;

    if (price <= 0 || qty <= 0) {
      toast.error('Vui l\u00F2ng nh\u1EADp gi\u00E1 s\u1EA3n ph\u1EA9m v\u00E0 s\u1ED1 l\u01B0\u1EE3ng');
      return;
    }

    setIsCalculating(true);
    try {
      const { data } = await apiClient.post('/orders/calculate-mhh-price', {
        productPriceCNY: price,
        quantity: qty,
        domesticShippingCNY: parseFloat(shipCN) || 0,
        estimatedWeightKg: weight,
        shippingRoute,
        customerTier: customerTier || undefined,
      });

      const result: CalculationResult = data.data ?? data;
      setApiResult(result);
      onCalculated?.(result);
      toast.success('\u0110\u00E3 t\u00EDnh gi\u00E1 v\u1EDBi t\u1EF7 gi\u00E1 th\u1EF1c t\u1EBF');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'L\u1ED7i t\u00EDnh gi\u00E1. \u0110ang d\u00F9ng t\u1EF7 gi\u00E1 m\u1EB7c \u0111\u1ECBnh.');
    } finally {
      setIsCalculating(false);
    }
  }, [productPrice, quantity, shipCN, estimatedWeight, shippingRoute, customerTier, onCalculated]);

  // --- Copy to clipboard ---
  const handleCopy = useCallback(() => {
    if (!displayResult) return;

    const r = displayResult;
    const text = [
      '=== T\u00CDNH GI\u00C1 MHH ===',
      `Gi\u00E1 SP:        ${formatNum(r.productPriceCNY)} CNY`,
      `+ Ph\u00ED DV (${r.serviceFeePercent}%): ${formatNum(r.serviceFeeCNY)} CNY`,
      `+ Ship TQ:     ${formatNum(r.shipCNCNY)} CNY`,
      `= T\u1ED5ng/sp:     ${formatNum(r.totalPerItemCNY)} CNY`,
      `\u00D7 S\u1ED1 l\u01B0\u1EE3ng:    \u00D7${r.quantity}`,
      `= T\u1ED5ng CNY:    ${formatNum(r.totalCNY)} CNY`,
      '',
      `T\u1EF7 gi\u00E1:        ${r.exchangeRate.toLocaleString('vi-VN')} VND/CNY`,
      `= T\u1ED5ng VND:    ${r.totalVND.toLocaleString('vi-VN')} VND`,
      '',
      `+ Ship VN (~${r.estimatedWeight}kg \u00D7 ${r.shippingVNRate.toLocaleString('vi-VN')}): ${r.shippingVNTotal.toLocaleString('vi-VN')} VND`,
      '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550',
      `T\u1ED4NG \u01AF\u1EDCC T\u00CDNH: ${r.grandTotalVND.toLocaleString('vi-VN')} VND`,
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('\u0110\u00E3 copy k\u1EBFt qu\u1EA3');
      setTimeout(() => setCopied(false), 2000);
    });
  }, [displayResult]);

  // --- Reset ---
  const handleReset = useCallback(() => {
    setProductPrice('');
    setQuantity('1');
    setShipCN('0');
    setEstimatedWeight('');
    setShippingRoute(ShippingRoute.ROAD);
    setCustomerTier('');
    setApiResult(null);
  }, []);

  return (
    <div className={cn('space-y-6', className)}>
      {/* ---- Input Form ---- */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className={cn('font-semibold', compact ? 'text-base' : 'text-lg')}>
            Nh\u1EADp th\u00F4ng tin s\u1EA3n ph\u1EA9m
          </h3>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
          >
            <RotateCcw className="h-3 w-3" />
            L\u00E0m m\u1EDBi
          </button>
        </div>

        <div className={cn('grid gap-4', compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
          {/* Gi\u00E1 s\u1EA3n ph\u1EA9m (CNY) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Gi\u00E1 s\u1EA3n ph\u1EA9m (CNY) <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={productPrice}
              onChange={(e) => { setProductPrice(e.target.value); setApiResult(null); }}
              placeholder="VD: 100"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* S\u1ED1 l\u01B0\u1EE3ng */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              S\u1ED1 l\u01B0\u1EE3ng <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => { setQuantity(e.target.value); setApiResult(null); }}
              placeholder="1"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Ph\u00ED ship n\u1ED9i TQ */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Ph\u00ED ship n\u1ED9i TQ (CNY)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={shipCN}
              onChange={(e) => { setShipCN(e.target.value); setApiResult(null); }}
              placeholder="0"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* C\u00E2n n\u1EB7ng \u01B0\u1EDBc t\u00EDnh */}
          <div className="space-y-2">
            <label className="text-sm font-medium">C\u00E2n n\u1EB7ng \u01B0\u1EDBc t\u00EDnh (kg)</label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={estimatedWeight}
              onChange={(e) => { setEstimatedWeight(e.target.value); setApiResult(null); }}
              placeholder="VD: 2"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Tuy\u1EBFn v\u1EADn chuy\u1EC3n */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tuy\u1EBFn v\u1EADn chuy\u1EC3n</label>
            <select
              value={shippingRoute}
              onChange={(e) => { setShippingRoute(e.target.value as ShippingRoute); setApiResult(null); }}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {Object.entries(SHIPPING_ROUTE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* H\u1EA1ng KH */}
          <div className="space-y-2">
            <label className="text-sm font-medium">H\u1EA1ng KH</label>
            <select
              value={customerTier}
              onChange={(e) => { setCustomerTier(e.target.value as CustomerTier | ''); setApiResult(null); }}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">-- Kh\u00F4ng ch\u1ECDn --</option>
              {Object.entries(CUSTOMER_TIER_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ---- Calculation Result ---- */}
      {displayResult && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className={cn('font-semibold', compact ? 'text-base' : 'text-lg')}>
              K\u1EBFt qu\u1EA3 \u01B0\u1EDBc t\u00EDnh
            </h3>
            {apiResult && (
              <span className="inline-flex items-center rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                T\u1EF7 gi\u00E1 th\u1EF1c t\u1EBF
              </span>
            )}
            {!apiResult && (
              <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                T\u1EF7 gi\u00E1 m\u1EB7c \u0111\u1ECBnh
              </span>
            )}
          </div>

          {/* Breakdown table */}
          <div className="rounded-md border bg-muted/30 p-4 font-mono text-sm space-y-1">
            <Row label="Gi\u00E1 SP:" value={`${formatNum(displayResult.productPriceCNY)} CNY`} />
            <Row
              label={`+ Ph\u00ED DV (${displayResult.serviceFeePercent}%):`}
              value={`${formatNum(displayResult.serviceFeeCNY)} CNY`}
              muted
            />
            {displayResult.tierDiscount > 0 && (
              <Row
                label={`  (gi\u1EA3m ${displayResult.tierDiscount}% cho h\u1EA1ng KH)`}
                value=""
                muted
                small
              />
            )}
            <Row
              label="+ Ship TQ:"
              value={`${formatNum(displayResult.shipCNCNY)} CNY`}
              muted
            />
            <Divider />
            <Row
              label="= T\u1ED5ng/sp:"
              value={`${formatNum(displayResult.totalPerItemCNY)} CNY`}
              bold
            />
            <Row
              label={'\u00D7 S\u1ED1 l\u01B0\u1EE3ng:'}
              value={`\u00D7${displayResult.quantity}`}
            />
            <Row
              label="= T\u1ED5ng CNY:"
              value={`${formatNum(displayResult.totalCNY)} CNY`}
              bold
            />

            <div className="my-2" />

            <Row
              label="T\u1EF7 gi\u00E1:"
              value={`${displayResult.exchangeRate.toLocaleString('vi-VN')} VND/CNY`}
            />
            <Row
              label="= T\u1ED5ng VND:"
              value={`${displayResult.totalVND.toLocaleString('vi-VN')} VND`}
              bold
            />

            <div className="my-2" />

            {displayResult.estimatedWeight > 0 && (
              <Row
                label={`+ Ship VN (~${displayResult.estimatedWeight}kg \u00D7 ${displayResult.shippingVNRate.toLocaleString('vi-VN')}):`}
                value={`${displayResult.shippingVNTotal.toLocaleString('vi-VN')} VND`}
                muted
              />
            )}

            <div className="border-t-2 border-foreground/20 my-2" />

            <div className="flex justify-between items-center pt-1">
              <span className="font-bold text-base">T\u1ED4NG \u01AF\u1EDCC T\u00CDNH:</span>
              <span className="font-bold text-base text-primary">
                {displayResult.grandTotalVND.toLocaleString('vi-VN')} VND
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ---- Action buttons ---- */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleCalculate}
          disabled={isCalculating || !productPrice || !quantity}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 sm:px-4 sm:py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 touch-manipulation min-h-[44px]"
        >
          {isCalculating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Calculator className="h-4 w-4" />
          )}
          T\u00EDnh gi\u00E1 (t\u1EF7 gi\u00E1 th\u1EF1c t\u1EBF)
        </button>

        {displayResult && (
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 rounded-md border px-6 py-3 sm:px-4 sm:py-2 text-sm hover:bg-accent touch-manipulation min-h-[44px]"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? '\u0110\u00E3 copy!' : 'Copy k\u1EBFt qu\u1EA3'}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility sub-components
// ---------------------------------------------------------------------------

function Row({
  label,
  value,
  bold,
  muted,
  small,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  small?: boolean;
}) {
  return (
    <div className={cn('flex justify-between gap-4', small && 'text-xs')}>
      <span className={cn(muted && 'text-muted-foreground', bold && 'font-semibold')}>
        {label}
      </span>
      {value && (
        <span className={cn('text-right whitespace-nowrap', bold && 'font-semibold')}>
          {value}
        </span>
      )}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-dashed border-foreground/10 my-1" />;
}

function formatNum(n: number): string {
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default MHHPriceCalculator;
