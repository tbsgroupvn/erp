'use client';

import { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

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

interface ServiceComparisonItem {
  code: string;
  name: string;
  description: string;
  baseFee: string;
  serviceFee: string;
  features: { name: string; included: boolean }[];
  isPopular?: boolean;
}

const FALLBACK_SERVICES: ServiceComparisonItem[] = [
  {
    code: 'VCT',
    name: 'V\u1eadn chuy\u1ec3n thu\u1ea7n',
    description: 'Ch\u1ec9 v\u1eadn chuy\u1ec3n h\u00e0ng c\u00f3 s\u1eb5n',
    baseFee: '35,000\u0111/kg',
    serviceFee: '100,000\u0111',
    features: [
      { name: 'V\u1eadn chuy\u1ec3n h\u00e0ng h\u00f3a', included: true },
      { name: 'Mua h\u00e0ng h\u1ed9', included: false },
      { name: 'Khai b\u00e1o h\u1ea3i quan', included: false },
      { name: '\u0110\u00f3ng g\u00f3i', included: true },
      { name: 'B\u1ea3o hi\u1ec3m c\u01a1 b\u1ea3n', included: true },
      { name: 'T\u01b0 v\u1ea5n khai b\u00e1o', included: false },
    ],
  },
  {
    code: 'MHH',
    name: 'Mua h\u00e0ng h\u1ed9',
    description: 'Order h\u00e0ng + v\u1eadn chuy\u1ec3n',
    baseFee: '40,000\u0111/kg',
    serviceFee: '150,000\u0111',
    features: [
      { name: 'V\u1eadn chuy\u1ec3n h\u00e0ng h\u00f3a', included: true },
      { name: 'Mua h\u00e0ng h\u1ed9', included: true },
      { name: 'Khai b\u00e1o h\u1ea3i quan', included: false },
      { name: '\u0110\u00f3ng g\u00f3i', included: true },
      { name: 'B\u1ea3o hi\u1ec3m c\u01a1 b\u1ea3n', included: true },
      { name: 'T\u01b0 v\u1ea5n khai b\u00e1o', included: false },
    ],
  },
  {
    code: 'UTXNK',
    name: '\u1ee6y th\u00e1c XNK',
    description: 'D\u1ecbch v\u1ee5 to\u00e0n di\u1ec7n',
    baseFee: '45,000\u0111/kg',
    serviceFee: '200,000\u0111',
    features: [
      { name: 'V\u1eadn chuy\u1ec3n h\u00e0ng h\u00f3a', included: true },
      { name: 'Mua h\u00e0ng h\u1ed9', included: true },
      { name: 'Khai b\u00e1o h\u1ea3i quan', included: true },
      { name: '\u0110\u00f3ng g\u00f3i', included: true },
      { name: 'B\u1ea3o hi\u1ec3m c\u01a1 b\u1ea3n', included: true },
      { name: 'T\u01b0 v\u1ea5n khai b\u00e1o', included: true },
    ],
    isPopular: true,
  },
  {
    code: 'LCLCN',
    name: 'LCL ch\u00ednh ng\u1ea1ch',
    description: 'H\u00e0ng l\u1ebb ch\u00ednh ng\u1ea1ch',
    baseFee: '50,000\u0111/kg',
    serviceFee: '250,000\u0111',
    features: [
      { name: 'V\u1eadn chuy\u1ec3n h\u00e0ng h\u00f3a', included: true },
      { name: 'Mua h\u00e0ng h\u1ed9', included: true },
      { name: 'Khai b\u00e1o h\u1ea3i quan', included: true },
      { name: '\u0110\u00f3ng g\u00f3i', included: true },
      { name: 'B\u1ea3o hi\u1ec3m c\u01a1 b\u1ea3n', included: true },
      { name: 'T\u01b0 v\u1ea5n khai b\u00e1o', included: true },
    ],
  },
];

function formatVND(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value) + '\u0111';
}

function mergeApiIntoServices(
  configs: ServiceFeeConfigItem[],
  fallback: ServiceComparisonItem[],
): ServiceComparisonItem[] {
  const generalConfigs = configs.filter((c) => c.customerTier === null);
  const configMap = new Map<string, ServiceFeeConfigItem>();
  for (const cfg of generalConfigs) {
    const existing = configMap.get(cfg.serviceType);
    if (!existing || cfg.priority > existing.priority) {
      configMap.set(cfg.serviceType, cfg);
    }
  }

  return fallback.map((svc) => {
    const cfg = configMap.get(svc.code);
    if (!cfg) return svc;

    const minFee = cfg.minFeeAmount != null ? Number(cfg.minFeeAmount) : null;
    const feePercent = Number(cfg.feePercent);

    return {
      ...svc,
      serviceFee: minFee != null ? formatVND(minFee) : svc.serviceFee,
      baseFee: feePercent > 0 ? `${feePercent}%` : svc.baseFee,
    };
  });
}

export function ServiceComparison() {
  const [services, setServices] = useState<ServiceComparisonItem[]>(FALLBACK_SERVICES);

  useEffect(() => {
    let cancelled = false;
    async function fetchServiceFees() {
      try {
        const res = await fetch(`${API_BASE_URL}/public/service-fees`);
        if (!res.ok) return;
        const json = await res.json();
        const configs: ServiceFeeConfigItem[] = json.data;
        if (!cancelled && Array.isArray(configs) && configs.length > 0) {
          setServices(mergeApiIntoServices(configs, FALLBACK_SERVICES));
        }
      } catch {
        // Silently fall back to hardcoded values
      }
    }
    fetchServiceFees();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {services.map((service) => (
        <Card
          key={service.code}
          className={
            service.isPopular
              ? 'border-2 border-blue-500 shadow-lg relative'
              : 'hover:shadow-lg transition-shadow'
          }
        >
          {service.isPopular && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-blue-600">Ph\u1ed5 bi\u1ebfn nh\u1ea5t</Badge>
            </div>
          )}
          <CardHeader>
            <div className="text-center">
              <Badge variant="outline" className="mb-3">
                {service.code}
              </Badge>
              <CardTitle className="text-xl mb-2">
                {service.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {service.description}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {service.baseFee}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ph\u00ed d\u1ecbch v\u1ee5: {service.serviceFee}
              </p>
            </div>

            <div className="space-y-3">
              {service.features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm">{feature.name}</span>
                  {feature.included ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <X className="h-5 w-5 text-gray-300" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
