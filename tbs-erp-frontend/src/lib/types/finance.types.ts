// ============================================
// FINANCE TYPES — AR, AP, Voucher, Cash, Invoice, ExchangeRate, DebtNetting
// ============================================

import { ApprovalStatus, Currency, PaymentMethod } from './enums';

/** Account Receivable entity */
export interface AccountReceivable {
  id: string;
  code: string;
  customerId: string;
  orderId: string | null;
  amount: number;
  paidAmount: number;
  currency: Currency;
  dueDate: string;
  status: 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'NETTED';
  nettedAmount: number;
  note: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    code: string;
    fullName: string;
    companyName: string | null;
    phone: string | null;
  };
  order?: {
    id: string;
    code: string;
    status: string;
    totalAmount: number;
  } | null;
}

/** Per-customer outstanding debt summary */
export interface CustomerDebtSummary {
  customerId: string;
  customerCode: string;
  customerName: string;
  companyName: string | null;
  totalDebt: number;
  overdueDebt: number;
  arCount: number;
  oldestDueDate: string | null;
  /** Max days since any linked order completed — used for collection urgency */
  maxDaysSinceCompletion: number | null;
}

/** Account Payable entity */
export interface AccountPayable {
  id: string;
  code: string;
  vendorId: string | null;
  vendorName: string;
  amount: number;
  paidAmount: number;
  currency: Currency;
  dueDate: string;
  status: 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'NETTED';
  nettedAmount: number;
  note: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Payment voucher entity (receipt or payment) */
export interface PaymentVoucher {
  id: string;
  code: string;
  type: 'RECEIPT' | 'PAYMENT';
  orderId: string;
  amount: number;
  currency: Currency;
  paymentMethod: PaymentMethod;
  costType: string;
  beneficiary: string;
  reason: string;
  attachments: string[];
  status: ApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  exchangeRateAtOrder: number | null;
  exchangeRateAtPayment: number | null;
  exchangeRateDiff: number | null;
  isFlagged: boolean;
  flagReason: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Cash transaction record */
export interface CashTransaction {
  id: string;
  voucherId: string | null;
  type: 'IN' | 'OUT';
  amount: number;
  currency: Currency;
  paymentMethod: PaymentMethod;
  reference: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

/** Invoice entity */
export interface Invoice {
  id: string;
  code: string;
  orderId: string | null;
  customerId: string;
  type: 'GTGT' | 'DIEU_CHINH' | 'HUY';
  amount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  status: 'DRAFT' | 'ISSUED' | 'SENT_TAX' | 'CANCELLED' | 'ADJUSTED';
  issuedAt: string | null;
  sentToTaxAt: string | null;
  externalId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Exchange rate record */
export interface ExchangeRate {
  id: string;
  from: Currency;
  to: Currency;
  rate: number;
  source: string;
  date: string;
  createdAt: string;
}

/** Debt netting record */
export interface DebtNetting {
  id: string;
  code: string;
  partnerId: string;
  partnerName: string;
  arAmount: number;
  apAmount: number;
  netAmount: number;
  status: ApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

/** DTO for creating a payment voucher */
export interface CreateVoucherDto {
  type: 'RECEIPT' | 'PAYMENT';
  orderId: string;
  amount: number;
  currency?: Currency;
  paymentMethod: PaymentMethod;
  costType: string;
  beneficiary: string;
  reason: string;
  attachments?: string[];
  exchangeRateAtPayment?: number;
  bankTraceId?: string;
}

/** DTO for creating an invoice */
export interface CreateInvoiceDto {
  orderId?: string;
  customerId: string;
  type?: 'GTGT' | 'DIEU_CHINH' | 'HUY';
  amount: number;
  taxRate?: number;
}

/** Query params for voucher listing */
export interface VoucherQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  type?: 'RECEIPT' | 'PAYMENT';
  status?: ApprovalStatus;
  dateFrom?: string;
  dateTo?: string;
  isFlagged?: boolean;
}

/** Query params for invoice listing */
export interface InvoiceQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: Invoice['status'];
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
}
