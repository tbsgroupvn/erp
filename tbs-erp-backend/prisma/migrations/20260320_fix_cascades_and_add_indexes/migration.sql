-- Migration: 20260320_fix_cascades_and_add_indexes
-- Fix 1: AuditLog.userId -> onDelete: SetNull (compliance: deleting a user must NOT delete audit history)
-- Fix 2: PayrollRecord.employeeId -> onDelete: Restrict (legal: payroll records must survive employee deletion)
-- Indexes: add missing composite indexes on support_tickets and leads

-- ============================================================
-- FIX 1: audit_logs — change CASCADE to SET NULL
--   Also make user_id nullable to support SET NULL semantics
-- ============================================================

-- Step 1a: Allow user_id to be NULL (was NOT NULL)
ALTER TABLE "audit_logs"
  ALTER COLUMN "user_id" DROP NOT NULL;

-- Step 1b: Drop the existing foreign key constraint with CASCADE
ALTER TABLE "audit_logs"
  DROP CONSTRAINT IF EXISTS "audit_logs_user_id_fkey";

-- Step 1c: Re-add the constraint with SET NULL
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- ============================================================
-- FIX 2: payroll_records — change CASCADE to RESTRICT
-- ============================================================

-- Step 2a: Drop the existing foreign key constraint with CASCADE
ALTER TABLE "payroll_records"
  DROP CONSTRAINT IF EXISTS "payroll_records_employee_id_fkey";

-- Step 2b: Re-add the constraint with RESTRICT
ALTER TABLE "payroll_records"
  ADD CONSTRAINT "payroll_records_employee_id_fkey"
    FOREIGN KEY ("employee_id")
    REFERENCES "employees"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- ============================================================
-- NEW INDEXES
-- ============================================================

-- support_tickets: composite index for queue management by status and priority
CREATE INDEX IF NOT EXISTS "idx_support_tickets_status_priority"
  ON "support_tickets" ("status", "priority");

-- leads: composite index for pipeline queries filtered by status and assigned sales rep
CREATE INDEX IF NOT EXISTS "idx_leads_status_assigned"
  ON "leads" ("status", "assigned_to");
