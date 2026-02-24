/**
 * Response returned after submitting a customs declaration to VNACCS.
 */
export interface CustomsResponse {
  /** Reference ID assigned by VNACCS */
  referenceId: string;
  /** Declaration number */
  declarationNumber: string;
  /** Status of the submission */
  status: 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'PENDING';
  /** Timestamp of submission */
  submittedAt: Date;
  /** Any messages from the VNACCS system */
  messages: string[];
}

/**
 * Current status of a customs declaration in the VNACCS/VCIS system.
 */
export interface DeclarationStatus {
  /** Declaration ID */
  declarationId: string;
  /** Declaration number from VNACCS */
  declarationNumber: string;
  /** Current status */
  status:
    | 'DRAFT'
    | 'SUBMITTED'
    | 'UNDER_REVIEW'
    | 'APPROVED'
    | 'REJECTED'
    | 'RELEASED'
    | 'CANCELLED';
  /** Channel assigned (GREEN, YELLOW, RED) */
  channel?: 'GREEN' | 'YELLOW' | 'RED';
  /** Customs office code */
  customsOffice?: string;
  /** Tax amount calculated */
  taxAmount?: number;
  /** Duty amount calculated */
  dutyAmount?: number;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Status remarks */
  remarks?: string;
}

/**
 * Result from HS (Harmonized System) code lookup.
 */
export interface HSCodeResult {
  /** HS code (e.g., "8471.30.00") */
  code: string;
  /** Vietnamese description */
  descriptionVi: string;
  /** English description */
  descriptionEn: string;
  /** Import duty rate percentage */
  importDutyRate: number;
  /** VAT rate percentage */
  vatRate: number;
  /** Special preferential tariff rate (if applicable) */
  specialTariffRate?: number;
  /** Unit of measurement */
  unit: string;
  /** Whether goods require special permits */
  requiresPermit: boolean;
}

/**
 * Response from manifest submission to customs.
 */
export interface ManifestResponse {
  /** Reference ID for the manifest */
  referenceId: string;
  /** Manifest number assigned by customs */
  manifestNumber: string;
  /** Submission status */
  status: 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';
  /** Number of items in the manifest */
  totalItems: number;
  /** Submission timestamp */
  submittedAt: Date;
  /** Error messages if any */
  errors: string[];
}

/**
 * Result of duty/tax calculation for an import shipment.
 */
export interface DutyResult {
  /** HS code used for calculation */
  hsCode: string;
  /** CIF value (Cost, Insurance, Freight) in VND */
  cifValueVnd: number;
  /** Import duty amount */
  importDuty: number;
  /** Import duty rate applied */
  importDutyRate: number;
  /** Special consumption tax (if applicable) */
  specialConsumptionTax: number;
  /** VAT amount */
  vat: number;
  /** VAT rate applied */
  vatRate: number;
  /** Environmental protection tax (if applicable) */
  environmentalTax: number;
  /** Anti-dumping duty (if applicable) */
  antiDumpingDuty: number;
  /** Total taxes and duties payable */
  totalPayable: number;
  /** Exchange rate used (if original currency is not VND) */
  exchangeRate?: number;
  /** Original currency */
  originalCurrency?: string;
  /** Original CIF value */
  originalCifValue?: number;
}
