import { registerAs } from '@nestjs/config';

export default registerAs('business', () => ({
  deposit: {
    NEW: parseFloat(process.env.DEPOSIT_RATE_NEW || '1.0'),
    REGULAR: parseFloat(process.env.DEPOSIT_RATE_REGULAR || '0.7'),
    VIP: parseFloat(process.env.DEPOSIT_RATE_VIP || '0.5'),
    STRATEGIC: parseFloat(process.env.DEPOSIT_RATE_STRATEGIC || '0.3'),
    autoCancelDays: parseInt(process.env.DEPOSIT_AUTO_CANCEL_DAYS || '3'),
  },
  tier: {
    regularMinOrders: parseInt(process.env.TIER_REGULAR_MIN_ORDERS || '10'),
    vipMinOrders: parseInt(process.env.TIER_VIP_MIN_ORDERS || '20'),
  },
  approval: {
    escalateAfterHours: parseInt(process.env.APPROVAL_ESCALATE_HOURS || '24'),
    discountLevel2: parseFloat(process.env.DISCOUNT_LEVEL2 || '0.03'),
    discountLevel3: parseFloat(process.env.DISCOUNT_LEVEL3 || '0.05'),
    highValueOrder: parseInt(process.env.HIGH_VALUE_ORDER || '100000000'),
  },
  sla: {
    cskhResponseMinutes: 15,
    saleContactHours: 2,
    quotationHours: 4,
    approvalHours: 2,
    warehouseReceiptHours: 24,
    deliveryDays: 3,
  },
  antifraud: {
    expensePercentThreshold: 0.9,
    miscExpenseThreshold: 5000000,
    maxVouchersPerDay: 5,
    minReasonLength: 20,
    businessHoursStart: 7,
    businessHoursEnd: 19,
  },
}));
