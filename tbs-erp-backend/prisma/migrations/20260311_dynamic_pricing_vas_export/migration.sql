-- ============================================================
-- Migration: Dynamic Pricing (Seasonal Rules + Customer Overrides)
-- Date: 2026-03-11
-- ============================================================

-- Bang gia tang/giam theo mua vu
CREATE TABLE IF NOT EXISTS "rate_card_seasonal_rules" (
  "id"           TEXT         NOT NULL PRIMARY KEY,
  "rate_card_id" TEXT         NOT NULL,
  "name"         TEXT         NOT NULL,
  "start_date"   TIMESTAMP(3) NOT NULL,
  "end_date"     TIMESTAMP(3) NOT NULL,
  "adjust_pct"   DECIMAL(5,2) NOT NULL,
  "is_active"    BOOLEAN      NOT NULL DEFAULT true,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "rate_card_seasonal_rules_rate_card_id_fkey"
    FOREIGN KEY ("rate_card_id")
    REFERENCES "rate_cards"("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "rate_card_seasonal_rules_rate_card_id_idx"
  ON "rate_card_seasonal_rules"("rate_card_id");

CREATE INDEX IF NOT EXISTS "rate_card_seasonal_rules_dates_idx"
  ON "rate_card_seasonal_rules"("start_date", "end_date");

-- ============================================================

-- Bang gia rieng theo khach hang
CREATE TABLE IF NOT EXISTS "customer_price_overrides" (
  "id"           TEXT         NOT NULL PRIMARY KEY,
  "customer_id"  TEXT         NOT NULL,
  "rate_card_id" TEXT         NOT NULL,
  "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "fixed_price"  DECIMAL(18,2),
  "note"         TEXT,
  "valid_from"   TIMESTAMP(3) NOT NULL,
  "valid_to"     TIMESTAMP(3),
  "is_active"    BOOLEAN      NOT NULL DEFAULT true,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "customer_price_overrides_customer_id_fkey"
    FOREIGN KEY ("customer_id")
    REFERENCES "customers"("id"),

  CONSTRAINT "customer_price_overrides_rate_card_id_fkey"
    FOREIGN KEY ("rate_card_id")
    REFERENCES "rate_cards"("id")
    ON DELETE CASCADE,

  CONSTRAINT "customer_price_overrides_customer_id_rate_card_id_key"
    UNIQUE ("customer_id", "rate_card_id")
);

CREATE INDEX IF NOT EXISTS "customer_price_overrides_customer_id_idx"
  ON "customer_price_overrides"("customer_id");

CREATE INDEX IF NOT EXISTS "customer_price_overrides_rate_card_id_idx"
  ON "customer_price_overrides"("rate_card_id");
