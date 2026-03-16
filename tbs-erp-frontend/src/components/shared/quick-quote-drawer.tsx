'use client';

import { useState, useCallback } from 'react';
import { X, Plus, Trash2, Copy, Check, Zap, ShoppingCart, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  quickQuoteApi,
  type QuickQuoteRequest,
  type QuickQuoteItem,
  type QuickQuoteResult,
  type RateCardOrigin,
  type RateCardDestination,
  type TransportMode,
  type ServiceType,
} from '@/lib/api/quick-quote.api';
import { useCustomers } from '@/lib/hooks/use-customers';
import type { Customer } from '@/lib/types';
import { cn } from '@/lib/utils/cn';

// ─── Constants ───────────────────────────────────────────────
const ORIGINS: { value: RateCardOrigin; label: string }[] = [
  { value: 'YIWU', label: 'Nghĩa Ô (Yiwu)' },
  { value: 'PINGXIANG', label: 'Bằng Tường (Pingxiang)' },
  { value: 'GUANGZHOU', label: 'Quảng Châu (Guangzhou)' },
  { value: 'OTHER', label: 'Khác' },
];

const DESTINATIONS: { value: RateCardDestination; label: string }[] = [
  { value: 'HANOI', label: 'Hà Nội' },
  { value: 'HOCHIMINH', label: 'Hồ Chí Minh' },
  { value: 'DANANG', label: 'Đà Nẵng' },
  { value: 'OTHER', label: 'Khác' },
];

const TRANSPORT_MODES: { value: TransportMode; label: string }[] = [
  { value: 'SEA', label: '🚢 Đường biển' },
  { value: 'ROAD', label: '🚛 Đường bộ' },
  { value: 'AIR', label: '✈️ Đường hàng không' },
];

const SERVICE_TYPES: { value: ServiceType; label: string; icon: string }[] = [
  { value: 'VCT', label: 'Vận chuyển thuần', icon: '🚛' },
  { value: 'MHH', label: 'Mua hàng hộ', icon: '🛒' },
];

const UNITS = ['cái', 'bộ', 'kg', 'thùng', 'mét', 'lốc', 'cuộn', 'tấm', 'chiếc', 'đôi'];

// ─── Helpers ─────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

const fmtNum = (n: number) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(n));

// ─── Types ───────────────────────────────────────────────────
interface ItemForm {
  productName: string;
  sourceUrl: string;
  vendorName: string;
  quantity: number;
  unit: string;
  unitPriceCNY: number;
  domesticShippingCNY: number;
  note: string;
}

const emptyItem = (): ItemForm => ({
  productName: '',
  sourceUrl: '',
  vendorName: '',
  quantity: 1,
  unit: 'cái',
  unitPriceCNY: 0,
  domesticShippingCNY: 0,
  note: '',
});

// ─── Props ───────────────────────────────────────────────────
interface QuickQuoteDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: QuickQuoteResult) => void;
}

// ─── Main Component ──────────────────────────────────────────
export function QuickQuoteDrawer({ open, onClose, onSuccess }: QuickQuoteDrawerProps) {
  const { data: customersData } = useCustomers({ limit: 200 });
  const customers = customersData?.data ?? [];

  // Form state
  const [serviceType, setServiceType] = useState<ServiceType>('VCT');
  const [customerId, setCustomerId] = useState('');
  const [origin, setOrigin] = useState<RateCardOrigin>('YIWU');
  const [destination, setDestination] = useState<RateCardDestination>('HANOI');
  const [transportMode, setTransportMode] = useState<TransportMode>('SEA');
  const [cbm, setCbm] = useState('');
  const [kg, setKg] = useState('');
  const [discountOverride, setDiscountOverride] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuickQuoteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const isMHH = serviceType === 'MHH';

  // ─── Item management ────
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof ItemForm, value: string | number) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  // ─── Live preview calculation ────
  const exchangeRateHint = 3520; // placeholder until actual rate
  const itemTotals = items.map((item) => ({
    totalCNY: item.unitPriceCNY * item.quantity + item.domesticShippingCNY * item.quantity,
    totalVND: Math.round((item.unitPriceCNY * item.quantity + item.domesticShippingCNY * item.quantity) * exchangeRateHint),
  }));
  const totalProductVND = itemTotals.reduce((s, t) => s + t.totalVND, 0);

  // ─── Submit ────
  const handleSubmit = async () => {
    if (!customerId) { setError('Vui lòng chọn khách hàng'); return; }
    if (!origin || !destination || !transportMode) { setError('Vui lòng chọn tuyến vận chuyển'); return; }
    if (isMHH && items.some((i) => !i.productName || i.unitPriceCNY <= 0)) {
      setError('MHH: Vui lòng nhập đủ tên sản phẩm và giá CNY'); return;
    }

    setError('');
    setLoading(true);
    try {
      const payload: QuickQuoteRequest = {
        customerId,
        serviceType,
        origin,
        destination,
        transportMode,
        cbm: cbm ? parseFloat(cbm) : undefined,
        kg: kg ? parseFloat(kg) : undefined,
        discountOverride: discountOverride ? parseFloat(discountOverride) : undefined,
        notes: notes || undefined,
        items: isMHH ? items.filter((i) => i.productName).map((i) => ({
          productName: i.productName,
          sourceUrl: i.sourceUrl || undefined,
          vendorName: i.vendorName || undefined,
          quantity: i.quantity,
          unit: i.unit,
          unitPriceCNY: i.unitPriceCNY,
          domesticShippingCNY: i.domesticShippingCNY || undefined,
          note: i.note || undefined,
        })) : undefined,
      };

      const res = await quickQuoteApi.create(payload);
      const qResult = res.data.data;
      setResult(qResult);
      onSuccess?.(qResult);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Lỗi tạo báo giá. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.textSummary) return;
    navigator.clipboard.writeText(result.textSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setResult(null);
    setError('');
    setServiceType('VCT');
    setCustomerId('');
    setOrigin('YIWU');
    setDestination('HANOI');
    setTransportMode('SEA');
    setCbm('');
    setKg('');
    setDiscountOverride('');
    setNotes('');
    setItems([emptyItem()]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-primary px-6 py-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary-foreground" />
            <h2 className="text-lg font-semibold text-primary-foreground">Báo giá nhanh</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-primary-foreground hover:bg-primary/80">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Service Type Selector */}
        {!result && (
          <div className="flex border-b">
            {SERVICE_TYPES.map((st) => (
              <button
                key={st.value}
                onClick={() => setServiceType(st.value)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
                  serviceType === st.value
                    ? 'border-b-2 border-primary bg-primary/5 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span>{st.icon}</span>
                {st.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {result ? (
            // ── Result View ──
            <ResultView result={result} onCopy={handleCopy} copied={copied} onNew={handleReset} onClose={onClose} />
          ) : (
            // ── Form View ──
            <>
              {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Khách hàng */}
              <div className="space-y-2">
                <Label>Khách hàng <span className="text-destructive">*</span></Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">-- Chọn khách hàng --</option>
                  {customers.map((c: Customer) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.code}) — {c.tier}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tuyến vận chuyển */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Điểm xuất phát</Label>
                  <Select value={origin} onValueChange={(v) => setOrigin(v as RateCardOrigin)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ORIGINS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Điểm đến</Label>
                  <Select value={destination} onValueChange={(v) => setDestination(v as RateCardDestination)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DESTINATIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Phương thức VC</Label>
                  <Select value={transportMode} onValueChange={(v) => setTransportMode(v as TransportMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRANSPORT_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sản phẩm (MHH only) */}
              {isMHH && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Sản phẩm & Giá NCC</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
                      <Plus className="h-3 w-3" /> Thêm SP
                    </Button>
                  </div>

                  {items.map((item, idx) => (
                    <div key={idx} className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">#{idx + 1}</span>
                        {items.length > 1 && (
                          <button onClick={() => removeItem(idx)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Tên sản phẩm *</Label>
                        <Input
                          placeholder="VD: Bình giữ nhiệt 500ml"
                          value={item.productName}
                          onChange={(e) => updateItem(idx, 'productName', e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Link NCC (1688/Taobao)</Label>
                        <Input
                          placeholder="https://detail.1688.com/..."
                          value={item.sourceUrl}
                          onChange={(e) => updateItem(idx, 'sourceUrl', e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Tên NCC</Label>
                        <Input
                          placeholder="VD: Yiwu Bottle Co."
                          value={item.vendorName}
                          onChange={(e) => updateItem(idx, 'vendorName', e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Số lượng *</Label>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Đơn vị</Label>
                          <select
                            className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                            value={item.unit}
                            onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                          >
                            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Giá NCC (CNY) *</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.unitPriceCNY || ''}
                            onChange={(e) => updateItem(idx, 'unitPriceCNY', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Phí ship nội địa TQ (CNY/item)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.1}
                          value={item.domesticShippingCNY || ''}
                          onChange={(e) => updateItem(idx, 'domesticShippingCNY', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      {item.unitPriceCNY > 0 && (
                        <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
                          Thành tiền: ~{fmtNum(item.unitPriceCNY * item.quantity * exchangeRateHint)} VND
                          <span className="text-blue-500 ml-1">(tỷ giá tham khảo {fmtNum(exchangeRateHint)}/CNY)</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {totalProductVND > 0 && (
                    <div className="rounded-md border bg-primary/5 px-4 py-2 text-sm">
                      <span className="text-muted-foreground">Tổng giá hàng (ước tính):</span>
                      <span className="ml-2 font-semibold">{fmt(totalProductVND)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* CBM / KG */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">
                  {isMHH ? 'CBM/KG ước tính' : 'Thể tích & Trọng lượng'}
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">CBM (m³)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder="VD: 2.5"
                      value={cbm}
                      onChange={(e) => setCbm(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">KG</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="VD: 100"
                      value={kg}
                      onChange={(e) => setKg(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Hệ thống tự tính chargeable weight: CBM × {transportMode === 'SEA' ? '6000' : '5000'} vs KG → lấy giá lớn hơn
                </p>
              </div>

              {/* Chiết khấu & ghi chú */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Chiết khấu override (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="Để trống = tự động"
                    value={discountOverride}
                    onChange={(e) => setDiscountOverride(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ghi chú</Label>
                  <Input
                    placeholder="Ghi chú thêm..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <div className="border-t bg-background px-6 py-4">
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">Huỷ</Button>
              <Button onClick={handleSubmit} disabled={loading} className="flex-1 gap-2">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Đang tính...
                  </span>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Tạo báo giá nhanh
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Result View ─────────────────────────────────────────────
function ResultView({
  result,
  onCopy,
  copied,
  onNew,
  onClose,
}: {
  result: QuickQuoteResult;
  onCopy: () => void;
  copied: boolean;
  onNew: () => void;
  onClose: () => void;
}) {
  const { quotation, pricing, textSummary } = result;
  const isMHH = quotation.quoteMode === 'MHH_QUICK';

  return (
    <div className="space-y-5">
      {/* Success badge */}
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <Check className="h-5 w-5 text-green-600" />
        <div>
          <p className="font-semibold text-green-800">Báo giá tạo thành công</p>
          <p className="text-sm text-green-600">{quotation.code} • {quotation.customer.fullName}</p>
        </div>
        <Badge variant="outline" className="ml-auto">{isMHH ? 'MHH' : 'VCT'}</Badge>
      </div>

      {/* Items (MHH) */}
      {isMHH && quotation.items && quotation.items.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sản phẩm</p>
          <div className="divide-y rounded-lg border">
            {quotation.items.map((item, i: number) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">{item.quantity} {item.unit} × {item.unitPriceCNY} CNY</p>
                </div>
                <span className="font-semibold">{fmtNum(Number(item.totalPriceVND))} đ</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pricing breakdown */}
      <div className="rounded-lg border p-4 space-y-2 text-sm">
        <p className="font-semibold text-muted-foreground uppercase tracking-wide text-xs mb-3">Chi tiết giá</p>

        {isMHH && pricing.totalProductAmountVND > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tổng giá hàng</span>
            <span>{fmtNum(pricing.totalProductAmountVND)} đ</span>
          </div>
        )}
        {isMHH && pricing.serviceFeeAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phí dịch vụ MHH ({pricing.serviceFeePercent}%)</span>
            <span>{fmtNum(pricing.serviceFeeAmount)} đ</span>
          </div>
        )}
        {pricing.shippingAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cước vận chuyển</span>
            <span>{fmtNum(pricing.shippingAmount)} đ</span>
          </div>
        )}
        {pricing.surchargeAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phụ phí</span>
            <span>{fmtNum(pricing.surchargeAmount)} đ</span>
          </div>
        )}
        {pricing.discountAmount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Chiết khấu ({pricing.discountPercent}%)</span>
            <span>-{fmtNum(pricing.discountAmount)} đ</span>
          </div>
        )}

        <Separator />
        <div className="flex justify-between text-base font-bold">
          <span>TỔNG BÁO GIÁ</span>
          <span className="text-primary">{fmtNum(pricing.totalAmount)} đ</span>
        </div>
        {pricing.depositRequired > 0 && (
          <div className="flex justify-between text-sm font-medium text-orange-600">
            <span>Cọc yêu cầu ({Math.round(pricing.depositRate * 100)}%)</span>
            <span>{fmtNum(pricing.depositRequired)} đ</span>
          </div>
        )}

        {isMHH && pricing.exchangeRate > 0 && (
          <p className="text-xs text-muted-foreground pt-1">
            Tỷ giá: 1 CNY = {fmtNum(pricing.exchangeRate)} VND • Hiệu lực: {pricing.validityDays} ngày
          </p>
        )}
      </div>

      {/* Text summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Nội dung gửi Zalo/WeChat</p>
          <Button variant="outline" size="sm" onClick={onCopy} className="gap-1">
            {copied ? <><Check className="h-3 w-3" /> Đã copy</> : <><Copy className="h-3 w-3" /> Copy</>}
          </Button>
        </div>
        <pre className="w-full rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap font-mono leading-relaxed">
          {textSummary}
        </pre>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onNew} className="flex-1">+ Báo giá mới</Button>
        <Button variant="outline" asChild className="flex-1">
          <a href={`/bao-gia/${quotation.id}`}>Xem chi tiết →</a>
        </Button>
        <Button onClick={onClose} className="flex-1">Đóng</Button>
      </div>
    </div>
  );
}
