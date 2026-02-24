import { QueryParams } from './common.types';
import {
  MHHIssueType,
  MHHIssueStatus,
  MHHIssueResolution,
  ComplaintSeverity,
  Currency,
} from './enums';

export interface MHHIssue {
  id: string;
  code: string;
  orderId: string;
  orderItemId: string | null;
  packageId: string | null;
  supplierOrderId: string | null;
  issueType: MHHIssueType;
  status: MHHIssueStatus;
  severity: ComplaintSeverity;
  description: string;
  resolution: MHHIssueResolution | null;
  resolutionNote: string | null;
  compensationAmount: number | null;
  compensationCurrency: Currency | null;
  customerDecision: string | null;
  customerDecisionAt: string | null;
  attachments: string[];
  evidenceUrls: string[];
  handlerId: string | null;
  assignedAt: string | null;
  resolvedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    code: string;
  };
  orderItem?: {
    id: string;
    productName: string;
  } | null;
  handler?: {
    id: string;
    fullName: string;
  } | null;
}

export interface CreateMHHIssueDto {
  orderId: string;
  orderItemId?: string;
  packageId?: string;
  supplierOrderId?: string;
  issueType: MHHIssueType;
  severity?: ComplaintSeverity;
  description: string;
  attachments?: string[];
  evidenceUrls?: string[];
}

export interface ResolveMHHIssueDto {
  resolution: MHHIssueResolution;
  resolutionNote?: string;
  compensationAmount?: number;
  compensationCurrency?: Currency;
}

export interface MHHIssueQueryParams extends QueryParams {
  status?: MHHIssueStatus;
  issueType?: MHHIssueType;
  severity?: ComplaintSeverity;
  orderId?: string;
  handlerId?: string;
}

export interface MHHPriceCalculateDto {
  productPriceCNY: number;
  quantity: number;
  domesticShippingCNY?: number;
  estimatedWeightKg?: number;
  shippingRoute?: 'SEA' | 'ROAD' | 'AIR';
  customerTier?: string;
}

export interface MHHPriceResult {
  perUnit: {
    productPriceCNY: number;
    serviceFeePercent: number;
    serviceFeeAmountCNY: number;
    domesticShippingCNY: number;
    subtotalCNY: number;
  };
  totals: {
    quantity: number;
    subtotalCNY: number;
    exchangeRate: number;
    subtotalVND: number;
    estimatedShippingVND: number;
    grandTotalVND: number;
  };
  shippingRoute: string | null;
  customerTier: string | null;
}
