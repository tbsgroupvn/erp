-- Finance FK Relations and Audit Fields
-- Fixes: missing @relation constraints + missing audit trail fields

-- =============================================================================
-- 1. PaymentAllocationDetail: Add FK to AccountReceivable
-- =============================================================================
ALTER TABLE "payment_allocation_details"
  ADD CONSTRAINT "payment_allocation_details_ar_id_fkey"
  FOREIGN KEY ("ar_id") REFERENCES "accounts_receivable"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- 2. UnallocatedFundClaim: Add FK to Order and Contract
-- =============================================================================
ALTER TABLE "unallocated_fund_claims"
  ADD CONSTRAINT "unallocated_fund_claims_target_order_id_fkey"
  FOREIGN KEY ("target_order_id") REFERENCES "orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "unallocated_fund_claims"
  ADD CONSTRAINT "unallocated_fund_claims_target_contract_id_fkey"
  FOREIGN KEY ("target_contract_id") REFERENCES "contracts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "unallocated_fund_claims_target_order_id_idx"
  ON "unallocated_fund_claims"("target_order_id");

CREATE INDEX IF NOT EXISTS "unallocated_fund_claims_target_contract_id_idx"
  ON "unallocated_fund_claims"("target_contract_id");

-- =============================================================================
-- 3. BankWebhookTransaction: Add FK to Customer and WalletTransaction
-- =============================================================================
ALTER TABLE "bank_webhook_transactions"
  ADD CONSTRAINT "bank_webhook_transactions_matched_customer_id_fkey"
  FOREIGN KEY ("matched_customer_id") REFERENCES "customers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add unique constraint on wallet_transaction_id (required for 1:1 relation)
ALTER TABLE "bank_webhook_transactions"
  ADD CONSTRAINT "bank_webhook_transactions_wallet_transaction_id_key"
  UNIQUE ("wallet_transaction_id");

ALTER TABLE "bank_webhook_transactions"
  ADD CONSTRAINT "bank_webhook_transactions_wallet_transaction_id_fkey"
  FOREIGN KEY ("wallet_transaction_id") REFERENCES "wallet_transactions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "bank_webhook_transactions_matched_customer_id_idx"
  ON "bank_webhook_transactions"("matched_customer_id");

-- =============================================================================
-- 4. Audit fields: Add updatedAt to CashTransaction, ExchangeRate, CommissionRecord
-- =============================================================================
ALTER TABLE "cash_transactions"
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

ALTER TABLE "exchange_rates"
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

ALTER TABLE "commission_records"
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

-- =============================================================================
-- 5. Audit fields: Add createdBy to ChartOfAccount, CODRecord
-- =============================================================================
ALTER TABLE "chart_of_accounts"
  ADD COLUMN IF NOT EXISTS "created_by" TEXT;

ALTER TABLE "cod_records"
  ADD COLUMN IF NOT EXISTS "created_by" TEXT;
