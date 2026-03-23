-- =========================================================
-- Migration: 20260317_add_reporting_materialized_views
-- Mo ta: Tao cac materialized view pre-aggregate de giam tai
--        GROUP BY tren cac bang OLTP khi chay bao cao dashboard.
--        Refresh qua pg_cron hoac application-level scheduler.
-- =========================================================

-- 1. Daily Sales Summary
-- Su dung boi: Sales Dashboard, BOD Dashboard, Revenue Reports
-- Prisma table: orders (@@map("orders"))
-- Cot can check: total_amount, deposit_required, sale_id, service_type, branch, status, created_at
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_sales_daily AS
SELECT
  DATE_TRUNC('day', o.created_at)    AS report_date,
  o.sale_id,
  o.service_type,
  o.branch,
  o.status,
  COUNT(*)                            AS order_count,
  SUM(o.total_amount)                 AS total_amount,
  SUM(o.deposit_required)             AS total_deposit,
  SUM(CASE WHEN o.status = 'COMPLETED' THEN o.total_amount ELSE 0 END) AS completed_amount,
  SUM(CASE WHEN o.status = 'CANCELLED' THEN 1 ELSE 0 END)              AS cancelled_count
FROM orders o
GROUP BY 1, 2, 3, 4, 5;

-- Unique index bat buoc de REFRESH CONCURRENTLY hoat dong
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_sales_daily_pk
  ON mv_sales_daily (report_date, sale_id, service_type, branch, status);

-- Index ho tro filter theo ngay
CREATE INDEX IF NOT EXISTS idx_mv_sales_daily_date
  ON mv_sales_daily (report_date DESC);

-- Index ho tro filter theo sale
CREATE INDEX IF NOT EXISTS idx_mv_sales_daily_sale
  ON mv_sales_daily (sale_id, report_date DESC);


-- =========================================================
-- 2. Accounts Receivable Aging
-- Su dung boi: Finance Dashboard, AR Aging Report, Credit Review
-- Prisma table: account_receivables, customers
-- Cot can check:
--   account_receivables: customer_id, amount, paid_amount, netted_amount, due_date, status
--   customers: full_name, company_name, tier, sale_id
-- Luu y: khong co cot remaining_amount, tinh = amount - paid_amount - netted_amount
-- =========================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ar_aging AS
SELECT
  ar.customer_id,
  c.full_name                                   AS customer_name,
  c.company_name,
  c.tier                                        AS customer_tier,
  c.sale_id,
  COUNT(*)                                      AS invoice_count,
  SUM(ar.amount)                                AS total_receivable,
  SUM(ar.paid_amount)                           AS total_paid,
  SUM(ar.amount - ar.paid_amount - ar.netted_amount) AS total_remaining,
  -- Chua den han (>= hom nay)
  SUM(CASE
    WHEN ar.due_date >= NOW()
    THEN ar.amount - ar.paid_amount - ar.netted_amount
    ELSE 0
  END)                                          AS current_amount,
  -- Qua han 1-30 ngay
  SUM(CASE
    WHEN ar.due_date < NOW()
     AND ar.due_date >= NOW() - INTERVAL '30 days'
    THEN ar.amount - ar.paid_amount - ar.netted_amount
    ELSE 0
  END)                                          AS overdue_1_30,
  -- Qua han 31-60 ngay
  SUM(CASE
    WHEN ar.due_date < NOW() - INTERVAL '30 days'
     AND ar.due_date >= NOW() - INTERVAL '60 days'
    THEN ar.amount - ar.paid_amount - ar.netted_amount
    ELSE 0
  END)                                          AS overdue_31_60,
  -- Qua han 61-90 ngay
  SUM(CASE
    WHEN ar.due_date < NOW() - INTERVAL '60 days'
     AND ar.due_date >= NOW() - INTERVAL '90 days'
    THEN ar.amount - ar.paid_amount - ar.netted_amount
    ELSE 0
  END)                                          AS overdue_61_90,
  -- Qua han tren 90 ngay
  SUM(CASE
    WHEN ar.due_date < NOW() - INTERVAL '90 days'
    THEN ar.amount - ar.paid_amount - ar.netted_amount
    ELSE 0
  END)                                          AS overdue_90_plus
FROM account_receivables ar
JOIN customers c ON c.id = ar.customer_id
WHERE ar.status NOT IN ('PAID', 'CANCELLED', 'NETTED')
GROUP BY ar.customer_id, c.full_name, c.company_name, c.tier, c.sale_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ar_aging_pk
  ON mv_ar_aging (customer_id);

CREATE INDEX IF NOT EXISTS idx_mv_ar_aging_sale
  ON mv_ar_aging (sale_id);

CREATE INDEX IF NOT EXISTS idx_mv_ar_aging_tier
  ON mv_ar_aging (customer_tier);


-- =========================================================
-- 3. Monthly Container Summary
-- Su dung boi: Logistics Dashboard, Operations Report
-- Prisma table: containers (@@map("containers"))
-- Cot can check:
--   - shipping_route (khong phai "route")
--   - total_weight (co), total_cbm (KHONG CO trong schema)
--   - actual_departure_at & actual_arrival_at (khong phai departed_at/arrived_at)
--   - Tinh transit days = actual_arrival_at - actual_departure_at
-- =========================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_container_monthly AS
SELECT
  DATE_TRUNC('month', c.created_at)   AS report_month,
  c.shipping_route,
  c.status,
  COUNT(*)                             AS container_count,
  SUM(c.total_weight)                  AS total_weight_kg,
  -- Tinh avg transit days tu actual departure -> actual arrival (ca hai phai co gia tri)
  AVG(
    CASE
      WHEN c.actual_departure_at IS NOT NULL AND c.actual_arrival_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (c.actual_arrival_at - c.actual_departure_at)) / 86400.0
      ELSE NULL
    END
  )::numeric(10, 1)                    AS avg_transit_days
FROM containers c
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_container_monthly_pk
  ON mv_container_monthly (report_month, shipping_route, status);

CREATE INDEX IF NOT EXISTS idx_mv_container_monthly_month
  ON mv_container_monthly (report_month DESC);


-- =========================================================
-- 4. Commission Summary by Period
-- Su dung boi: Commission Report, Sales Performance
-- Prisma table: commission_records (@@map("commission_records"))
-- Cot can check:
--   - sale_id, commission_amount, status, created_at
--   - Khong co cot "period" rieng — dung DATE_TRUNC('month', created_at) lam ky
--   - CommissionStatus enum: PENDING, APPROVED, PAID, ON_HOLD, CANCELLED
-- =========================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_commission_summary AS
SELECT
  co.sale_id,
  DATE_TRUNC('month', co.created_at)   AS period,
  co.status,
  COUNT(*)                              AS commission_count,
  SUM(co.commission_amount)             AS total_commission,
  SUM(CASE WHEN co.status = 'PAID'    THEN co.commission_amount ELSE 0 END) AS paid_amount,
  SUM(CASE WHEN co.status = 'PENDING' THEN co.commission_amount ELSE 0 END) AS pending_amount,
  SUM(CASE WHEN co.status = 'APPROVED' THEN co.commission_amount ELSE 0 END) AS approved_amount,
  SUM(CASE WHEN co.status = 'ON_HOLD' THEN co.commission_amount ELSE 0 END)  AS on_hold_amount
FROM commission_records co
GROUP BY co.sale_id, DATE_TRUNC('month', co.created_at), co.status;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_commission_summary_pk
  ON mv_commission_summary (sale_id, period, status);

CREATE INDEX IF NOT EXISTS idx_mv_commission_summary_period
  ON mv_commission_summary (period DESC);

CREATE INDEX IF NOT EXISTS idx_mv_commission_summary_sale
  ON mv_commission_summary (sale_id, period DESC);


-- =========================================================
-- Refresh Function
-- Goi boi pg_cron hoac NestJS scheduler (SchedulerRegistry)
-- CONCURRENTLY cho phep read trong khi refresh (khong lock table)
-- Yeu cau: moi view phai co UNIQUE INDEX truoc khi dung CONCURRENTLY
-- =========================================================
CREATE OR REPLACE FUNCTION refresh_reporting_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ar_aging;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_container_monthly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_commission_summary;
END;
$$ LANGUAGE plpgsql;

-- Huong dan lich refresh (ch?y tay neu chua cai pg_cron):
--
-- Cach 1 - pg_cron (15 phut/lan):
--   SELECT cron.schedule(
--     'refresh-reporting-views',
--     '*/15 * * * *',
--     'SELECT refresh_reporting_views()'
--   );
--
-- Cach 2 - NestJS @Cron (src/core/scheduler hoac dashboard.service.ts):
--   @Cron('*/15 * * * *')
--   async refreshReportingViews() {
--     await this.prisma.$executeRaw`SELECT refresh_reporting_views()`;
--   }
--
-- Cach 3 - Goi thu cong sau khi apply migration:
--   SELECT refresh_reporting_views();
