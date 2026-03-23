-- =========================================================
-- Migration: 20260317_performance_materialized_views
-- Mo ta: Them 5 materialized view bo sung de phuc vu cac
--        dashboard va bao cao hieu suat nang cao.
--
--  1. mv_order_pipeline   — Trang thai don hang theo ngay/loai dich vu/chi nhanh
--  2. mv_customer_360     — Tong hop 360 do khach hang (AR, wallet, hang tier)
--  3. mv_container_tracking — Tong hop van chuyen container theo kien hang
--  4. mv_finance_monthly  — Tong ket tai chinh theo thang (AR + AP + Doanh thu)
--  5. mv_finance_quarterly — Tong ket tai chinh theo quy (tap hop tu mv_finance_monthly)
--
-- Phu thuoc: mv_finance_quarterly phu thuoc mv_finance_monthly
--            => tao monthly truoc, quarterly sau.
--
-- Refresh: Goi refresh_performance_views() qua pg_cron hoac NestJS scheduler.
--          CONCURRENTLY yeu cau moi view phai co UNIQUE INDEX.
--
-- Kiem tra schema:
--  orders           : khong co deleted_at (soft-delete khong duoc dung tren bang nay)
--  customers        : khong co deleted_at; dung is_active = false lam gia tri loai tru
--  account_receivables : khong co deleted_at; status enum: OPEN,PARTIAL,PAID,OVERDUE,NETTED,CANCELLED
--  account_payables    : khong co deleted_at; co netted_amount (giong AR)
--  containers       : khong co deleted_at; ETA la estimated_arrival_at (khong phai "eta")
--  packages         : khong co deleted_at; co chargeable_weight, cn_weight, order_id, container_id
-- =========================================================


-- =========================================================
-- 1. mv_order_pipeline
-- Mo ta : Pre-aggregate trang thai don hang theo (status, service_type, branch, ngay)
--         de giam tai cho cac truy van GROUP BY tren bang orders OLTP.
-- Su dung: Sales Dashboard, BOD Dashboard, Operations Overview
-- Luu y  : Bang orders KHONG CO cot deleted_at; khong can filter deleted_at IS NULL.
-- =========================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_order_pipeline AS
SELECT
    o.status,
    o.service_type,
    o.branch,
    DATE_TRUNC('day', o.created_at)                              AS day,
    COUNT(*)                                                     AS order_count,
    SUM(o.total_amount)                                          AS total_amount,
    SUM(o.deposit_required)                                      AS total_deposit,
    SUM(o.deposit_paid)                                          AS total_deposit_paid,
    AVG(
        EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 3600.0
    )::numeric(12, 2)                                            AS avg_age_hours
FROM orders o
GROUP BY o.status, o.service_type, o.branch, DATE_TRUNC('day', o.created_at);

-- Unique index bat buoc cho REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_order_pipeline
    ON mv_order_pipeline (status, service_type, branch, day);

-- Bo sung index tim kiem theo ngay va trang thai cho dashboard query
CREATE INDEX IF NOT EXISTS idx_mv_order_pipeline_day
    ON mv_order_pipeline (day DESC);

CREATE INDEX IF NOT EXISTS idx_mv_order_pipeline_status_day
    ON mv_order_pipeline (status, day DESC);


-- =========================================================
-- 2. mv_customer_360
-- Mo ta : Tong hop 360 do khach hang: thong tin co ban, so du vi, cong no phai thu.
--         Giam tai cho cac trang chi tiet KH va bao cao credit.
-- Su dung: CRM Dashboard, Credit Review, Customer Detail Page
-- Luu y  :
--   - customers KHONG CO deleted_at; dung is_active de loai khach ngung hoat dong.
--   - account_receivables KHONG CO deleted_at.
--   - Status OVERDUE (khong phai "PENDING") cho cac AR qua han.
--   - AR outstanding = amount - paid_amount - netted_amount.
-- =========================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_customer_360 AS
SELECT
    c.id                                              AS customer_id,
    c.code,
    c.full_name,
    c.tier,
    c.branch,
    c.sale_id,
    c.is_active,
    c.total_orders,
    c.total_revenue,
    COALESCE(w.balance, 0)                            AS wallet_balance,
    COALESCE(ar_agg.total_outstanding, 0)             AS total_outstanding,
    COALESCE(ar_agg.total_overdue, 0)                 AS total_overdue,
    COALESCE(ar_agg.overdue_count, 0)                 AS overdue_count,
    c.created_at,
    c.updated_at
FROM customers c
LEFT JOIN wallets w
    ON w.customer_id = c.id
LEFT JOIN (
    SELECT
        ar.customer_id,
        SUM(ar.amount - ar.paid_amount - ar.netted_amount)        AS total_outstanding,
        SUM(
            CASE WHEN ar.status = 'OVERDUE'
                 THEN ar.amount - ar.paid_amount - ar.netted_amount
                 ELSE 0
            END
        )                                                          AS total_overdue,
        COUNT(CASE WHEN ar.status = 'OVERDUE' THEN 1 END)         AS overdue_count
    FROM account_receivables ar
    WHERE ar.status IN ('OPEN', 'PARTIAL', 'OVERDUE')
    GROUP BY ar.customer_id
) ar_agg ON ar_agg.customer_id = c.id
WHERE c.is_active = true;

-- Unique index bat buoc cho REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_customer_360
    ON mv_customer_360 (customer_id);

-- Index ho tro filter theo sale va tier
CREATE INDEX IF NOT EXISTS idx_mv_customer_360_sale
    ON mv_customer_360 (sale_id);

CREATE INDEX IF NOT EXISTS idx_mv_customer_360_tier
    ON mv_customer_360 (tier);

CREATE INDEX IF NOT EXISTS idx_mv_customer_360_overdue
    ON mv_customer_360 (total_overdue DESC)
    WHERE total_overdue > 0;


-- =========================================================
-- 3. mv_container_tracking
-- Mo ta : Tong hop thong tin van chuyen container kem so lieu kien hang.
--         Giam tai cho trang danh sach container va bao cao logistics.
-- Su dung: Logistics Dashboard, Container Tracking Page, Operations Report
-- Luu y  :
--   - containers KHONG CO deleted_at.
--   - packages  KHONG CO deleted_at; join truc tiep khong can filter deleted_at.
--   - ETA cua container la cot estimated_arrival_at (khong phai "eta").
--   - containers co actual_departure_at (khong phai "actual_departure").
-- =========================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_container_tracking AS
SELECT
    ct.id                               AS container_id,
    ct.code,
    ct.status,
    ct.shipping_route,
    ct.origin,
    ct.destination,
    ct.vessel_name,
    ct.estimated_arrival_at             AS eta,
    ct.actual_arrival_at,
    ct.actual_departure_at,
    COUNT(p.id)                         AS package_count,
    SUM(p.chargeable_weight)            AS total_chargeable_weight,
    SUM(p.cn_weight)                    AS total_cn_weight,
    COUNT(DISTINCT p.order_id)          AS order_count,
    ct.created_at,
    ct.updated_at
FROM containers ct
LEFT JOIN packages p
    ON p.container_id = ct.id
GROUP BY
    ct.id,
    ct.code,
    ct.status,
    ct.shipping_route,
    ct.origin,
    ct.destination,
    ct.vessel_name,
    ct.estimated_arrival_at,
    ct.actual_arrival_at,
    ct.actual_departure_at,
    ct.created_at,
    ct.updated_at;

-- Unique index bat buoc cho REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_container_tracking
    ON mv_container_tracking (container_id);

-- Index ho tro filter theo trang thai va tuyen duong
CREATE INDEX IF NOT EXISTS idx_mv_container_tracking_status
    ON mv_container_tracking (status);

CREATE INDEX IF NOT EXISTS idx_mv_container_tracking_eta
    ON mv_container_tracking (eta)
    WHERE eta IS NOT NULL;


-- =========================================================
-- 4. mv_finance_monthly
-- Mo ta : Tong ket tai chinh theo thang gom 3 category:
--           AR  (Cong no phai thu),
--           AP  (Cong no phai tra),
--           REVENUE (Doanh thu tu don hang COMPLETED).
--         Dung lam nguon du lieu cho mv_finance_quarterly (tao sau).
-- Su dung: Finance Dashboard, Monthly P&L Report, CFO Report
-- Luu y  :
--   - account_receivables va account_payables deu KHONG CO deleted_at.
--   - account_payables co cot netted_amount (xac nhan tu schema).
--   - orders KHONG CO deleted_at; loc status = 'COMPLETED'.
--   - UNION ALL de gop 3 nguon; NULL cho total_outstanding cua REVENUE la hop le.
-- =========================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_finance_monthly AS
-- AR: Cong no phai thu
SELECT
    DATE_TRUNC('month', ar.created_at)                           AS month,
    'AR'                                                         AS category,
    COUNT(*)                                                     AS record_count,
    SUM(ar.amount)                                               AS total_amount,
    SUM(ar.paid_amount)                                          AS total_paid,
    SUM(ar.amount - ar.paid_amount - ar.netted_amount)           AS total_outstanding
FROM account_receivables ar
GROUP BY DATE_TRUNC('month', ar.created_at)

UNION ALL

-- AP: Cong no phai tra
SELECT
    DATE_TRUNC('month', ap.created_at)                           AS month,
    'AP'                                                         AS category,
    COUNT(*)                                                     AS record_count,
    SUM(ap.amount)                                               AS total_amount,
    SUM(ap.paid_amount)                                          AS total_paid,
    SUM(ap.amount - ap.paid_amount - ap.netted_amount)           AS total_outstanding
FROM account_payables ap
GROUP BY DATE_TRUNC('month', ap.created_at)

UNION ALL

-- REVENUE: Doanh thu tu don hang da hoan thanh
SELECT
    DATE_TRUNC('month', o.created_at)                            AS month,
    'REVENUE'                                                    AS category,
    COUNT(*)                                                     AS record_count,
    SUM(o.total_amount)                                          AS total_amount,
    SUM(o.deposit_paid)                                          AS total_paid,
    NULL::numeric                                                AS total_outstanding
FROM orders o
WHERE o.status = 'COMPLETED'
GROUP BY DATE_TRUNC('month', o.created_at);

-- Unique index bat buoc cho REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_finance_monthly
    ON mv_finance_monthly (month, category);

-- Index ho tro filter theo thang
CREATE INDEX IF NOT EXISTS idx_mv_finance_monthly_month
    ON mv_finance_monthly (month DESC);


-- =========================================================
-- 5. mv_finance_quarterly
-- Mo ta : Tong ket tai chinh theo quy, tap hop tu mv_finance_monthly.
--         Cho phep bao cao quy nhanh ma khong can OLTP GROUP BY.
-- Su dung: BOD Quarterly Report, CFO Dashboard, Annual Financial Summary
-- Luu y  :
--   - mv_finance_quarterly PHU THUOC vao mv_finance_monthly.
--   - mv_finance_monthly PHAI ton tai TRUOC khi tao view nay.
--   - SUM(total_outstanding) co the co NULL (tu REVENUE rows);
--     dung COALESCE neu can gia tri 0 thay vi NULL trong ung dung.
-- =========================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_finance_quarterly AS
SELECT
    DATE_TRUNC('quarter', month)        AS quarter,
    category,
    SUM(record_count)                   AS record_count,
    SUM(total_amount)                   AS total_amount,
    SUM(total_paid)                     AS total_paid,
    SUM(total_outstanding)              AS total_outstanding
FROM mv_finance_monthly
GROUP BY DATE_TRUNC('quarter', month), category;

-- Unique index bat buoc cho REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_finance_quarterly
    ON mv_finance_quarterly (quarter, category);

-- Index ho tro filter theo quy
CREATE INDEX IF NOT EXISTS idx_mv_finance_quarterly_quarter
    ON mv_finance_quarterly (quarter DESC);


-- =========================================================
-- Refresh Function
-- Goi boi pg_cron hoac NestJS SchedulerRegistry.
-- Thu tu QUAN TRONG: monthly phai refresh TRUOC quarterly
-- vi quarterly doc du lieu truc tiep tu mv_finance_monthly.
-- CONCURRENTLY cho phep doc view trong khi dang refresh (khong lock table).
-- Yeu cau: moi view phai co UNIQUE INDEX truoc khi dung CONCURRENTLY.
-- =========================================================
CREATE OR REPLACE FUNCTION refresh_performance_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_order_pipeline;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_360;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_container_tracking;
    -- Refresh monthly truoc quarterly vi quarterly phu thuoc monthly
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_finance_monthly;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_finance_quarterly;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- Huong dan lich refresh
--
-- Cach 1 - pg_cron (moi 30 phut):
--   SELECT cron.schedule(
--     'refresh-performance-views',
--     '*/30 * * * *',
--     'SELECT refresh_performance_views()'
--   );
--
-- Cach 2 - NestJS @Cron (vi du trong dashboard.service.ts):
--   @Cron('*/30 * * * *')
--   async refreshPerformanceViews() {
--     await this.prisma.$executeRaw`SELECT refresh_performance_views()`;
--   }
--
-- Cach 3 - Goi thu cong sau khi apply migration:
--   SELECT refresh_performance_views();
--
-- Luu y: Lan dau tien sau khi tao view, CONCURRENTLY se that bai
-- neu view con rong. Chay SELECT refresh_performance_views() mot lan
-- khong co CONCURRENTLY, hoac INSERT du lieu truoc:
--   REFRESH MATERIALIZED VIEW mv_finance_monthly;
--   REFRESH MATERIALIZED VIEW mv_finance_quarterly;
--   REFRESH MATERIALIZED VIEW mv_order_pipeline;
--   REFRESH MATERIALIZED VIEW mv_customer_360;
--   REFRESH MATERIALIZED VIEW mv_container_tracking;
-- =========================================================
