-- Migration: Custom Emoji table
-- Created: 2026-03-08

CREATE TABLE "custom_emojis" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "image_url"   TEXT NOT NULL,
  "category"    TEXT NOT NULL DEFAULT 'general',
  "uploaded_by" TEXT NOT NULL,
  "usage_count" INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "custom_emojis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "custom_emojis_name_key" ON "custom_emojis"("name");

CREATE INDEX "custom_emojis_category_idx" ON "custom_emojis"("category");
