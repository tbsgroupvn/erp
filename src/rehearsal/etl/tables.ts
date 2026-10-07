/**
 * Thứ tự nạp (§5 mỗi tài liệu): 09b (FundAccount → TreasuryEntry) → 09c
 * (FxFeeRate → FxTransfer → FxAdjustment → FundAccountChangelog →
 * BankTransaction → BankTransactionDetail → BankChiMatch → BankReconcileLink) →
 * 09a (PaymentSource → SupplierPayment → SupplierPaymentOrder →
 * SupplierPaymentLog) → 04b (ReturnConfig → ReturnConfigField → ReturnState,
 * ReturnState payment nạp CÙNG đợt với tbl_payment — 09a §5.5). setval SAU CÙNG.
 */
import { FX_BANK_SPECS } from './fx-bank';
import { RETURN_SPECS } from './return-state';
import { TableSpec } from './spec';
import { SUPPLIER_PAYMENT_SPECS } from './supplier-payment';
import { TREASURY_SPECS } from './treasury';

export const TABLES: readonly TableSpec[] = [
  ...TREASURY_SPECS,
  ...FX_BANK_SPECS,
  ...SUPPLIER_PAYMENT_SPECS,
  ...RETURN_SPECS,
];
