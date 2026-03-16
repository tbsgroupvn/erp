-- Migration: 20260311_analytics_snapshot
-- Tao bang daily_metric_snapshots de luu lich su KPI hang ngay

CREATE TABLE "daily_metric_snapshots" (
    "id"         TEXT NOT NULL,
    "date"       DATE NOT NULL,
    "metric"     TEXT NOT NULL,
    "value"      DECIMAL(18, 2) NOT NULL,
    "branch"     TEXT,
    "metadata"   JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- Index composite de truy van lich su metric theo ten + khoang ngay
CREATE INDEX "daily_metric_snapshots_metric_date_idx"
    ON "daily_metric_snapshots"("metric", "date");

-- Unique constraint: moi (ngay, metric, chi_nhanh) chi co 1 ban ghi
-- branch=NULL duoc gop chung voi 'ALL' de tranh null-unique conflict
CREATE UNIQUE INDEX "daily_metric_snapshots_date_metric_branch_key"
    ON "daily_metric_snapshots"("date", "metric", "branch");
