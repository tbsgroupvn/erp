import { apiClient } from './client';

export type QuoteMode = 'VCT_QUICK' | 'MHH_QUICK' | 'FULL';
export type RateCardOrigin = 'YIWU' | 'PINGXIANG' | 'GUANGZHOU' | 'OTHER';
export type RateCardDestination = 'HANOI' | 'HOCHIMINH' | 'DANANG' | 'OTHER';
export type TransportMode = 'SEA' | 'ROAD' | 'AIR';
export type ServiceType = 'VCT' | 'MHH' | 'UTXNK' | 'LCLCN';

export interface QuickQuoteItem {
  productName: string;
  productDescription?: string;
  sourceUrl?: string;
  productImageUrl?: string;
  vendorId?: string;
  vendorName?: string;
  quantity: number;
  unit?: string;
  unitPriceCNY: number;
  domesticShippingCNY?: number;
  note?: string;
}

export interface QuickQuoteRequest {
  customerId: string;
  serviceType: ServiceType;
  origin: RateCardOrigin;
  destination: RateCardDestination;
  transportMode: TransportMode;
  items?: QuickQuoteItem[];
  cbm?: number;
  kg?: number;
  discountOverride?: number;
  notes?: string;
}

export interface QuickQuoteResult {
  quotation: {
    id: string;
    code: string;
    status: string;
    quoteMode: QuoteMode;
    customer: { id: string; code: string; fullName: string; tier: string };
    exchangeRateSnapshot?: number;
    items?: Array<{
      productName: string;
      quantity: number;
      unit?: string;
      unitPriceCNY: number;
      totalPriceVND?: number;
    }>;
    validUntil: string;
  };
  pricing: {
    exchangeRate: number;
    totalProductAmountCNY: number;
    totalProductAmountVND: number;
    serviceFeePercent: number;
    serviceFeeAmount: number;
    shippingAmount: number;
    surchargeAmount: number;
    discountPercent: number;
    discountAmount: number;
    totalAmount: number;
    depositRate: number;
    depositRequired: number;
    validityDays: number;
  };
  textSummary: string;
}

export interface RateCard {
  id: string;
  code: string;
  name: string;
  origin: RateCardOrigin;
  destination: RateCardDestination;
  transportMode: TransportMode;
  serviceType: ServiceType;
  pricePerCBM: number;
  pricePerKG: number;
  minChargeAmount?: number;
  validFrom: string;
  validTo?: string;
  isActive: boolean;
  surcharges: { name: string; amount: number; isPercent: boolean; percent?: number }[];
  discounts: { customerTier: string; discountPercent: number }[];
}

export interface CreateRateCardDto {
  code?: string;
  name: string;
  origin: RateCardOrigin;
  destination: RateCardDestination;
  transportMode: TransportMode;
  serviceType: ServiceType;
  pricePerCBM: number;
  pricePerKG: number;
  minChargeAmount?: number;
  validFrom: string;
  validTo?: string;
  isActive?: boolean;
  surcharges?: { name: string; amount: number; isPercent: boolean; percent?: number }[];
  discounts?: { customerTier: string; discountPercent: number }[];
}

export const quickQuoteApi = {
  create: (data: QuickQuoteRequest) =>
    apiClient.post<{ success: boolean; data: QuickQuoteResult }>('/quotations/quick', data),

  lookupRateCard: (params: {
    origin: RateCardOrigin;
    destination: RateCardDestination;
    transportMode: TransportMode;
    serviceType?: ServiceType;
    cbm?: number;
    kg?: number;
    customerTier?: string;
  }) => apiClient.get('/rate-cards/lookup', { params }),

  listRateCards: (params?: { isActive?: boolean }) =>
    apiClient.get<{ success: boolean; data: { data: RateCard[] } }>('/rate-cards', { params }),

  createRateCard: (data: CreateRateCardDto) =>
    apiClient.post<RateCard>('/rate-cards', data),
};
