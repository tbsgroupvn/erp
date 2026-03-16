-- Migration: 20260308_attendance_gps
-- Adds AttendanceLocation and OfficeLocation tables for GPS check-in feature

-- AttendanceLocation: stores GPS coords linked to an attendance record
CREATE TABLE IF NOT EXISTS "attendance_locations" (
    "id"               TEXT NOT NULL,
    "attendance_id"    TEXT NOT NULL,
    "check_in_lat"     DOUBLE PRECISION,
    "check_in_lng"     DOUBLE PRECISION,
    "check_in_address" TEXT,
    "check_out_lat"    DOUBLE PRECISION,
    "check_out_lng"    DOUBLE PRECISION,
    "check_out_address" TEXT,
    "check_in_method"  TEXT NOT NULL DEFAULT 'MANUAL',
    "check_out_method" TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_locations_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one location record per attendance
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_locations_attendance_id_key"
    ON "attendance_locations"("attendance_id");

-- OfficeLocation: office/warehouse positions used for GPS radius check
CREATE TABLE IF NOT EXISTS "office_locations" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "lat"            DOUBLE PRECISION NOT NULL,
    "lng"            DOUBLE PRECISION NOT NULL,
    "radius_meters"  INTEGER NOT NULL DEFAULT 100,
    "wifi_ssid"      TEXT,
    "is_active"      BOOLEAN NOT NULL DEFAULT true,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "office_locations_pkey" PRIMARY KEY ("id")
);

-- Seed default office location (Ho Chi Minh City center — update with real coords)
INSERT INTO "office_locations" ("id", "name", "lat", "lng", "radius_meters", "is_active", "created_at")
VALUES
    ('office_hcm_01', 'Van phong HCM', 10.7769, 106.7009, 150, true, CURRENT_TIMESTAMP),
    ('office_hn_01',  'Van phong Ha Noi', 21.0285, 105.8542, 150, true, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
