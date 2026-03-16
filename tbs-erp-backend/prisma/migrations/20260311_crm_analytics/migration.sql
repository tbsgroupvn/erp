-- Migration: 20260311_crm_analytics
-- Mo ta: Tao bang customer_analytics cho module CRM AI Predictions

CREATE TABLE "customer_analytics" (
  "id"                    TEXT NOT NULL,
  "customer_id"           TEXT NOT NULL,
  "total_orders"          INTEGER NOT NULL DEFAULT 0,
  "avg_order_interval"    INTEGER,
  "last_order_date"       TIMESTAMP(3),
  "days_since_last_order" INTEGER,
  "churn_risk"            TEXT NOT NULL DEFAULT 'LOW',
  "predicted_next_order"  TIMESTAMP(3),
  "clv"                   DECIMAL(18,2),
  "avg_order_value"       DECIMAL(18,2),
  "preferred_service_type" TEXT,
  "metadata"              JSONB,
  "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "customer_analytics_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: 1 ban ghi analytics cho 1 khach hang
CREATE UNIQUE INDEX "customer_analytics_customer_id_key"
  ON "customer_analytics"("customer_id");

-- Index ho tro query theo muc rui ro roi bo
CREATE INDEX "customer_analytics_churn_risk_idx"
  ON "customer_analytics"("churn_risk");

-- Index ho tro query theo so ngay khong dat hang
CREATE INDEX "customer_analytics_days_since_last_order_idx"
  ON "customer_analytics"("days_since_last_order");

-- Foreign key toi bang customers
ALTER TABLE "customer_analytics"
  ADD CONSTRAINT "customer_analytics_customer_id_fkey"
  FOREIGN KEY ("customer_id")
  REFERENCES "customers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
