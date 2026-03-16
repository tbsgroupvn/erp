'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';

type ServiceType = 'VCT' | 'MHH' | 'UTXNK' | 'LCLCN';
type ShippingRoute = 'SEA' | 'ROAD' | 'AIR';

interface PricingResult {
  shippingFee: number;
  customsFee: number;
  serviceFee: number;
  total: number;
  chargeableWeight: number;
}

interface ServiceFeeConfigItem {
  serviceType: string;
  name: string;
  customerTier: string | null;
  feePercent: string | number;
  minFeeAmount: string | number | null;
  maxFeeAmount: string | number | null;
  minOrderValue: string | number | null;
  maxOrderValue: string | number | null;
  minQuantity: number | null;
  productCategory: string | null;
  priority: number;
  note: string | null;
}

const serviceTypeLabels: Record<ServiceType, string> = {
  VCT: 'Vận chuyển thuần',
  MHH: 'Mua hàng hộ',
  UTXNK: 'Ủy thác xuất nhập khẩu',
  LCLCN: 'LCL chính ngạch',
};

const shippingRouteLabels: Record<ShippingRoute, string> = {
  SEA: 'Đường biển (chậm, rẻ)',
  ROAD: 'Đường bộ (nhanh, trung bình)',
  AIR: 'Đường hàng không (nhanh nhất, đắt)',
};

// Fallback pricing constants used when API is unavailable
const FALLBACK_PRICING_CONFIG = {
  baseRatePerKg: {
    VCT: 35000, // VND per kg
    MHH: 40000,
    UTXNK: 45000,
    LCLCN: 50000,
  },
  routeMultiplier: {
    SEA: 1.0,
    ROAD: 1.2,
    AIR: 2.5,
  },
  dimFactor: {
    SEA: 6000,
    ROAD: 5000,
    AIR: 5000,
  },
  serviceFee: {
    VCT: 100000,
    MHH: 150000,
    UTXNK: 200000,
    LCLCN: 250000,
  },
  customsRate: 0.1, // 10% of shipping fee
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/**
 * Build PRICING_CONFIG from backend ServiceFeeConfig records.
 * Each record has feePercent and minFeeAmount per serviceType.
 * We use the highest-priority config per serviceType (for customerTier=null, i.e. general).
 */
function buildPricingFromApi(
  configs: ServiceFeeConfigItem[],
): typeof FALLBACK_PRICING_CONFIG {
  const result = { ...FALLBACK_PRICING_CONFIG };
  const updated = { ...result.serviceFee };
  const updatedBase = { ...result.baseRatePerKg };

  // Group by serviceType, pick highest priority general config (customerTier is null)
  const generalConfigs = configs.filter((c) => c.customerTier === null);

  for (const cfg of generalConfigs) {
    const st = cfg.serviceType as ServiceType;
    if (st in updated) {
      // Use minFeeAmount as the flat service fee if available
      if (cfg.minFeeAmount != null) {
        updated[st] = Number(cfg.minFeeAmount);
      }
      // Use feePercent to derive base rate: feePercent represents % markup,
      // but we keep the baseRatePerKg from the config name convention or existing fallback
      // since ServiceFeeConfig is about service fee %, not shipping rate per kg.
    }
  }

  return {
    ...result,
    serviceFee: updated,
    baseRatePerKg: updatedBase,
  };
}

export default function PricingCalculator() {
  const [weight, setWeight] = useState<string>('');
  const [length, setLength] = useState<string>('');
  const [width, setWidth] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [serviceType, setServiceType] = useState<ServiceType>('VCT');
  const [shippingRoute, setShippingRoute] = useState<ShippingRoute>('SEA');
  const [result, setResult] = useState<PricingResult | null>(null);
  const [email, setEmail] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [pricingConfig, setPricingConfig] = useState(FALLBACK_PRICING_CONFIG);

  useEffect(() => {
    let cancelled = false;
    async function fetchServiceFees() {
      try {
        const res = await fetch(`${API_BASE_URL}/public/service-fees`);
        if (!res.ok) return;
        const json = await res.json();
        const configs: ServiceFeeConfigItem[] = json.data;
        if (!cancelled && Array.isArray(configs) && configs.length > 0) {
          setPricingConfig(buildPricingFromApi(configs));
        }
      } catch {
        // Silently fall back to hardcoded values
      }
    }
    fetchServiceFees();
    return () => { cancelled = true; };
  }, []);

  const calculatePrice = () => {
    const actualWeight = parseFloat(weight);
    const l = parseFloat(length);
    const w = parseFloat(width);
    const h = parseFloat(height);

    if (isNaN(actualWeight) || actualWeight <= 0) {
      alert('Vui lòng nhập trọng lượng hợp lệ');
      return;
    }

    // Calculate dimensional weight if dimensions are provided
    let dimensionalWeight = 0;
    if (l > 0 && w > 0 && h > 0) {
      const dimFactor = pricingConfig.dimFactor[shippingRoute];
      dimensionalWeight = (l * w * h) / dimFactor;
    }

    // Chargeable weight is the maximum of actual weight and dimensional weight
    const chargeableWeight = Math.max(actualWeight, dimensionalWeight);

    // Calculate shipping fee
    const baseRate = pricingConfig.baseRatePerKg[serviceType];
    const routeMultiplier = pricingConfig.routeMultiplier[shippingRoute];
    const shippingFee = chargeableWeight * baseRate * routeMultiplier;

    // Calculate customs fee (10% of shipping fee)
    const customsFee = shippingFee * pricingConfig.customsRate;

    // Service fee
    const serviceFee = pricingConfig.serviceFee[serviceType];

    // Total
    const total = shippingFee + customsFee + serviceFee;

    setResult({
      shippingFee,
      customsFee,
      serviceFee,
      total,
      chargeableWeight,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  const handleSendQuoteEmail = async () => {
    if (!result) {
      toast.error('Vui lòng tính phí trước khi gửi email');
      return;
    }

    if (!email || !email.includes('@')) {
      toast.error('Vui lòng nhập email hợp lệ');
      return;
    }

    setIsSendingEmail(true);

    try {
      const response = await fetch('/api/public/send-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          quote: {
            weight: parseFloat(weight),
            dimensions: {
              length: parseFloat(length) || 0,
              width: parseFloat(width) || 0,
              height: parseFloat(height) || 0,
            },
            serviceType: serviceTypeLabels[serviceType],
            shippingRoute: shippingRouteLabels[shippingRoute],
            chargeableWeight: result.chargeableWeight,
            shippingFee: result.shippingFee,
            customsFee: result.customsFee,
            serviceFee: result.serviceFee,
            total: result.total,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Không thể gửi email');
      }

      toast.success('Báo giá đã được gửi đến email của bạn!', {
        description: 'Vui lòng kiểm tra hộp thư đến hoặc spam.',
      });
      setEmail('');
    } catch (error) {
      toast.error('Có lỗi xảy ra khi gửi email', {
        description: 'Vui lòng thử lại sau hoặc liên hệ hotline.',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle>Thông tin hàng hóa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Service Type */}
          <div className="space-y-2">
            <Label htmlFor="serviceType">Loại dịch vụ</Label>
            <Select
              value={serviceType}
              onValueChange={(value) => setServiceType(value as ServiceType)}
            >
              <SelectTrigger id="serviceType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(serviceTypeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Shipping Route */}
          <div className="space-y-2">
            <Label htmlFor="shippingRoute">Tuyến vận chuyển</Label>
            <Select
              value={shippingRoute}
              onValueChange={(value) => setShippingRoute(value as ShippingRoute)}
            >
              <SelectTrigger id="shippingRoute">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(shippingRouteLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Weight */}
          <div className="space-y-2">
            <Label htmlFor="weight">Trọng lượng thực tế (kg)</Label>
            <Input
              id="weight"
              type="number"
              placeholder="Ví dụ: 50"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              min="0"
              step="0.1"
            />
          </div>

          {/* Dimensions */}
          <div className="space-y-2">
            <p className="text-sm font-medium leading-none">Kích thước (cm) - Tùy chọn</p>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                placeholder="Dài"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                min="0"
                step="0.1"
              />
              <Input
                type="number"
                placeholder="Rộng"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                min="0"
                step="0.1"
              />
              <Input
                type="number"
                placeholder="Cao"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                min="0"
                step="0.1"
              />
            </div>
            <p className="text-xs text-slate-500">
              Nhập kích thước để tính trọng lượng quy đổi
            </p>
          </div>

          <Button onClick={calculatePrice} className="w-full" size="lg">
            Tính phí vận chuyển
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      <Card>
        <CardHeader>
          <CardTitle>Báo giá ước tính</CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-6">
              {/* Chargeable Weight Info */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">
                    Trọng lượng tính phí:
                  </span>
                  <span className="text-lg font-bold text-blue-600">
                    {result.chargeableWeight.toFixed(2)} kg
                  </span>
                </div>
                {parseFloat(length) > 0 &&
                  parseFloat(width) > 0 &&
                  parseFloat(height) > 0 && (
                    <p className="text-xs text-slate-600 mt-2">
                      = Max(trọng lượng thực, trọng lượng quy đổi)
                    </p>
                  )}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-slate-700">Phí vận chuyển:</span>
                  <span className="font-semibold">
                    {formatCurrency(result.shippingFee)}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-slate-700">Phí hải quan (ước tính):</span>
                  <span className="font-semibold">
                    {formatCurrency(result.customsFee)}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-slate-700">Phí dịch vụ:</span>
                  <span className="font-semibold">
                    {formatCurrency(result.serviceFee)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-4 border-t-2 border-slate-300">
                  <span className="text-lg font-bold text-slate-900">
                    Tổng cộng:
                  </span>
                  <span className="text-2xl font-bold text-blue-600">
                    {formatCurrency(result.total)}
                  </span>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>Lưu ý:</strong> Đây chỉ là báo giá ước tính. Giá cuối
                  cùng sẽ được xác nhận sau khi kiểm tra hàng hóa thực tế tại
                  kho.
                </p>
              </div>

              {/* Email Quote */}
              <div className="pt-4 border-t space-y-3">
                <Label htmlFor="email">Nhận báo giá qua email</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Button
                    onClick={handleSendQuoteEmail}
                    disabled={isSendingEmail}
                  >
                    {isSendingEmail ? (
                      'Đang gửi...'
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Gửi
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* CTA */}
              <div className="pt-4">
                <Button className="w-full" size="lg" variant="outline">
                  Liên hệ nhận báo giá chính xác
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg
                className="w-16 h-16 text-slate-300 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <p className="text-slate-500">
                Nhập thông tin hàng hóa và nhấn tính phí để xem báo giá
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
