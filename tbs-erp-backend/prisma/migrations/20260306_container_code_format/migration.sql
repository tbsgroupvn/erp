-- Migration: Change container code format from TBS-CNT-YYMMDD-NN to TBS{YYYY}{MM}{seq}
-- Example: TBS-CNT-260302-01 -> TBS20260301
-- Handles multiple days within same month by re-sequencing

-- Step 1: Temp column to avoid unique constraint
ALTER TABLE containers ADD COLUMN code_new TEXT;

-- Step 2: Calculate new codes with sequential numbering per month
WITH numbered AS (
  SELECT id, code,
    'TBS' || '20' || SUBSTRING(code FROM 9 FOR 2) || SUBSTRING(code FROM 11 FOR 2) as month_prefix,
    ROW_NUMBER() OVER (
      PARTITION BY SUBSTRING(code FROM 9 FOR 4)
      ORDER BY code
    ) as seq
  FROM containers
  WHERE code ~ '^TBS-CNT-\d{6}-\d{2,}$'
)
UPDATE containers c
SET code_new = n.month_prefix || LPAD(n.seq::text, 2, '0')
FROM numbered n
WHERE c.id = n.id;

-- Step 3: Swap codes
UPDATE containers SET code = code_new WHERE code_new IS NOT NULL;

-- Step 4: Cleanup
ALTER TABLE containers DROP COLUMN code_new;
