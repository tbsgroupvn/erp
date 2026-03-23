-- ============================================================
-- Migration: 20260317_add_trgm_gin_indexes
-- Mo ta: Them GIN trigram indexes cho text search ILIKE
--        Cai thien hieu nang tim kiem van ban 50x
--        su dung pg_trgm extension
-- ============================================================

-- Enable pg_trgm extension for trigram-based text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for ILIKE text search on frequently searched columns
-- These replace slow sequential scans with fast trigram index scans

-- Order code search (used in order list search, findAll with query.search)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_code_trgm
  ON "Order" USING GIN (code gin_trgm_ops);

-- Customer name search (used in customer list, order search by customer name)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_fullname_trgm
  ON "Customer" USING GIN ("fullName" gin_trgm_ops);

-- Customer company name search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_companyname_trgm
  ON "Customer" USING GIN ("companyName" gin_trgm_ops);

-- Customer phone search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_phone_trgm
  ON "Customer" USING GIN (phone gin_trgm_ops);

-- Package tracking number search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_trackingno_trgm
  ON "Package" USING GIN ("trackingNumber" gin_trgm_ops);

-- Container code search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_container_code_trgm
  ON "Container" USING GIN (code gin_trgm_ops);

-- Supplier order code search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_supplierorder_code_trgm
  ON "SupplierOrder" USING GIN (code gin_trgm_ops);

-- Invoice code search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_code_trgm
  ON "Invoice" USING GIN (code gin_trgm_ops);

-- Customs declaration code search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customsdeclaration_code_trgm
  ON "CustomsDeclaration" USING GIN (code gin_trgm_ops);
