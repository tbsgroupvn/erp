import { registerAs } from '@nestjs/config';

export default registerAs('business', () => ({
  // ─── Deposit Rates ───
  deposit: {
    NEW: parseFloat(process.env.DEPOSIT_RATE_NEW || '1.0'),
    REGULAR: parseFloat(process.env.DEPOSIT_RATE_REGULAR || '0.7'),
    VIP: parseFloat(process.env.DEPOSIT_RATE_VIP || '0.5'),
    STRATEGIC: parseFloat(process.env.DEPOSIT_RATE_STRATEGIC || '0.3'),
    autoCancelDays: parseInt(process.env.DEPOSIT_AUTO_CANCEL_DAYS || '3'),
  },

  // ─── Customer Tier Thresholds ───
  tier: {
    regularMinOrders: parseInt(process.env.TIER_REGULAR_MIN_ORDERS || '10'),
    vipMinOrders: parseInt(process.env.TIER_VIP_MIN_ORDERS || '20'),
  },

  // ─── Approval Workflow ───
  approval: {
    escalateAfterHours: parseInt(process.env.APPROVAL_ESCALATE_HOURS || '24'),
    discountLevel2: parseFloat(process.env.DISCOUNT_LEVEL2 || '0.03'),
    discountLevel3: parseFloat(process.env.DISCOUNT_LEVEL3 || '0.05'),
    highValueOrder: parseInt(process.env.HIGH_VALUE_ORDER || '100000000'),
  },

  // ─── SLA Targets ───
  sla: {
    cskhResponseMinutes: 15,
    saleContactHours: 2,
    quotationHours: 4,
    approvalHours: 2,
    warehouseReceiptHours: 24,
    deliveryDays: 3,
  },

  // ─── Anti-Fraud Rules ───
  antifraud: {
    expensePercentThreshold: 0.9,
    miscExpenseThreshold: 5000000,
    maxVouchersPerDay: 5,
    minReasonLength: 20,
    businessHoursStart: 7,
    businessHoursEnd: 19,
  },

  // ─── Order Thresholds ───
  order: {
    overdueThresholdDays: parseInt(process.env.OVERDUE_THRESHOLD_DAYS || '15', 10),
    maxItemsPerOrder: parseInt(process.env.MAX_ORDER_ITEMS || '100', 10),
  },

  // ─── Financial Limits ───
  finance: {
    maxPaymentVoucherAmount: parseFloat(process.env.MAX_VOUCHER_AMOUNT || '500000000'), // 500M VND
    minPaymentReasonLength: parseInt(process.env.MIN_REASON_LENGTH || '20', 10),
    arDueDateDays: parseInt(process.env.AR_DUE_DATE_DAYS || '30', 10),
  },

  // ─── Complaint Compensation Thresholds ───
  complaint: {
    compensationGdKdThreshold: parseFloat(process.env.COMPENSATION_GD_KD_THRESHOLD || '5000000'), // 5M VND - requires GD KD approval
    compensationBgdThreshold: parseFloat(process.env.COMPENSATION_BGD_THRESHOLD || '20000000'), // 20M VND - requires BGD approval
  },

  // ─── Commission ───
  commission: {
    defaultRate: parseFloat(process.env.DEFAULT_COMMISSION_RATE || '0.03'), // 3%
    autoApproveThreshold: parseFloat(process.env.COMMISSION_AUTO_APPROVE || '1000000'), // 1M VND
  },

  // ─── COD ───
  cod: {
    shortageTolerance: parseFloat(process.env.COD_SHORTAGE_TOLERANCE || '0.01'),
    enforcementHours: parseInt(process.env.COD_ENFORCEMENT_HOURS || '24', 10),
  },

  // ─── Debt Netting ───
  debtNetting: {
    minAmount: parseFloat(process.env.DEBT_NETTING_MIN || '100000'), // 100K VND
  },

  // ─── Customer Portal ───
  customerPortal: {
    walletTopupMinAmount: parseFloat(process.env.WALLET_TOPUP_MIN || '100000'),
    walletTopupMaxAmount: parseFloat(process.env.WALLET_TOPUP_MAX || '100000000'),
  },

  // ─── Payroll ───
  payroll: {
    personalDeductionVND: parseFloat(process.env.PERSONAL_DEDUCTION || '11000000'), // 11M VND
    dependentDeductionVND: parseFloat(process.env.DEPENDENT_DEDUCTION || '4400000'), // 4.4M VND
    insuranceRate: parseFloat(process.env.INSURANCE_RATE || '0.105'), // 10.5%
  },

  // ─── Rate Limiting (as config, not just decorator) ───
  rateLimit: {
    login: parseInt(process.env.LOGIN_RATE_LIMIT || '5', 10),
    api: parseInt(process.env.API_RATE_LIMIT || '100', 10),
  },

  // ─── Weight Variance ───
  weight: {
    varianceThresholdPercent: parseFloat(process.env.WEIGHT_VARIANCE_THRESHOLD || '5'),
  },

  // ─── RTO (Return to Origin) ───
  rto: {
    dailyStorageRate: parseFloat(process.env.RTO_DAILY_STORAGE_RATE || '10000'), // VND/day
  },

  // ─── Exchange Rate ───
  exchangeRate: {
    defaultMode: process.env.EXCHANGE_RATE_DEFAULT_MODE || 'FLOATING', // FIXED | FLOATING
  },

  // ─── Overdraft ───
  overdraft: {
    defaultExpiryHours: parseInt(process.env.OVERDRAFT_EXPIRY_HOURS || '24', 10),
  },

  // ─── Cache TTLs (in seconds) ───
  cacheTtl: {
    exchangeRate: parseInt(process.env.CACHE_TTL_EXCHANGE || '3600', 10),
    dashboard: parseInt(process.env.CACHE_TTL_DASHBOARD || '300', 10),
    commissionRules: parseInt(process.env.CACHE_TTL_COMMISSION || '1800', 10),
  },
}));
