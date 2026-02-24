// ============================================
// CUSTOMS DECLARATION TYPES — Smart Customs Declaration module
// ============================================

import { QueryParams } from './common.types';

export type CustomsDeclarationStatus =
  | 'DRAFT'
  | 'READY'
  | 'SUBMITTED'
  | 'CHANNEL_ASSIGNED'
  | 'INSPECTING'
  | 'CLEARED'
  | 'REJECTED'
  | 'CANCELLED';

export type CustomsChannel = 'GREEN' | 'YELLOW' | 'RED';

export type ComplianceStatus = 'CLEAR' | 'WARNING' | 'BLOCKED';

/** Full Customs Declaration entity */
export interface CustomsDeclaration {
  id: string;
  code: string;
  containerId: string;
  declarationType: string;
  customsOfficeCode: string | null;
  importerTaxCode: string;
  importerName: string;
  importerAddress: string | null;
  shippingMethod: string | null;
  blAwbNumber: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  vesselName: string | null;
  declaredCurrency: string;
  declaredTotalValue: number;
  declaredFreight: number;
  declaredInsurance: number;
  totalImportDuty: number;
  totalVat: number;
  totalSpecialTax: number;
  totalEnvironmentalTax: number;
  totalAntiDumpingDuty: number;
  totalPayable: number;
  internalTotalValue: number;
  exchangeRateUsed: number | null;
  status: CustomsDeclarationStatus;
  channel: CustomsChannel | null;
  complianceStatus: ComplianceStatus;
  ecusDeclarationNumber: string | null;
  ecusSubmittedAt: string | null;
  channelAssignedAt: string | null;
  clearedAt: string | null;
  taxAllocated: boolean;
  taxAllocatedAt: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  container?: { id: string; code: string; status: string };
  lines?: CustomsDeclarationLine[];
  complianceAlerts?: ComplianceAlert[];
  taxAllocations?: CustomsTaxAllocation[];
  statusHistory?: CustomsStatusHistory[];
}

/** Line item within a customs declaration */
export interface CustomsDeclarationLine {
  id: string;
  declarationId: string;
  lineNumber: number;
  declaredHsCode: string;
  declaredDescription: string;
  declaredQuantity: number;
  declaredUnit: string;
  declaredUnitPrice: number;
  declaredTotalValue: number;
  declaredCountryOrigin: string;
  declaredNetWeight: number | null;
  declaredGrossWeight: number | null;
  internalDescription: string;
  internalQuantity: number;
  internalUnitPrice: number;
  internalTotalValue: number;
  importDutyRate: number;
  importDutyAmount: number;
  vatRate: number;
  vatAmount: number;
  specialTaxRate: number;
  specialTaxAmount: number;
  environmentalTax: number;
  antiDumpingDuty: number;
  lineTotalTax: number;
  complianceStatus: ComplianceStatus;
  requiresPermit: boolean;
  permitType: string | null;
  sourceItems?: CustomsLineSourceItem[];
}

/** Source item linking a declaration line to an order item */
export interface CustomsLineSourceItem {
  id: string;
  lineId: string;
  orderItemId: string;
  orderId: string;
  packageId: string | null;
  contributedQuantity: number;
  contributedValue: number;
}

/** HS Code search result */
export interface HSCodeResult {
  id: string;
  code: string;
  descriptionVi: string;
  descriptionEn: string | null;
  importDutyRate: number;
  vatRate: number;
  specialTaxRate: number;
  requiresPermit: boolean;
  permitType: string | null;
  isRestricted: boolean;
  isProhibited: boolean;
  unit: string;
  usageCount: number;
}

/** Compliance alert on a declaration or line */
export interface ComplianceAlert {
  id: string;
  declarationId: string;
  lineId: string | null;
  alertType: string;
  severity: string;
  message: string;
  hsCode: string | null;
  isAcknowledged: boolean;
  acknowledgedBy: string | null;
  createdAt: string;
}

/** Tax allocation record linking tax to an order */
export interface CustomsTaxAllocation {
  id: string;
  declarationId: string;
  orderId: string;
  importDuty: number;
  vat: number;
  specialTax: number;
  otherTax: number;
  totalAllocated: number;
  method: string;
  proportion: number;
}

/** Status history entry */
export interface CustomsStatusHistory {
  id: string;
  declarationId: string;
  fromStatus: string | null;
  toStatus: string;
  channel: CustomsChannel | null;
  note: string | null;
  changedBy: string;
  createdAt: string;
}

/** Grouping suggestion from the backend */
export interface GroupingSuggestion {
  hsCodePrefix: string;
  lineIds: string[];
  suggestedDescription: string;
  totalQuantity: number;
  totalValue: number;
}

/** Query params for customs declaration listing */
export interface CustomsDeclarationQueryParams extends QueryParams {
  status?: CustomsDeclarationStatus;
  channel?: CustomsChannel;
}
