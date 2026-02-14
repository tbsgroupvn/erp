# Quick Start Guide - Legacy AR Migration

## TL;DR

```bash
# 1. Preview what will be migrated (SAFE - no changes)
npm run migrate:legacy-ar:dry-run

# 2. Review the output, then run the actual migration
npm run migrate:legacy-ar

# 3. If something goes wrong, rollback
npm run migrate:legacy-ar:rollback
```

## Step-by-Step Guide

### Step 1: Dry Run (Preview)

Run a preview to see what will be migrated:

```bash
npm run migrate:legacy-ar:dry-run
```

**Expected Output:**
```
================================================================================
  LEGACY AR MIGRATION SCRIPT
================================================================================
Mode: DRY RUN (Preview Only)
--------------------------------------------------------------------------------

Step 1: Finding orders with COMPLETED or SETTLEMENT status...
Found 156 orders to process

Step 2: Processing orders...
--------------------------------------------------------------------------------

[1/156] Processing Order: TBS-ORD-240101-0001
  Customer: ABC Company (TBS-KH-000001)
  Total Amount: 10000000 VND
  Deposit Paid: 3000000 VND
  Outstanding: 7000000 VND
  Due Date: 2026-01-30
  Status: OVERDUE
  ✓ [DRY RUN] Would create AR record

...

================================================================================
  MIGRATION REPORT
================================================================================
Mode:                  DRY RUN
Total Orders Processed: 156
Successful:            152
Failed:                4
Total AR Amount Created: 1,234,567,890.00 VND

Status Breakdown:
  OPEN:     98 records
  OVERDUE:  54 records
================================================================================

⚠️  This was a DRY RUN. No changes were made to the database.
```

### Step 2: Review the Report

Check the output carefully:

- **Total Orders Processed**: How many orders will be affected
- **Failed**: Orders that will be skipped (usually due to zero outstanding)
- **Total AR Amount**: Total receivables that will be created
- **Status Breakdown**: How many OPEN vs OVERDUE

### Step 3: Run the Migration

If the dry run looks good, execute the actual migration:

```bash
npm run migrate:legacy-ar
```

**Expected Output:**
```
================================================================================
  LEGACY AR MIGRATION SCRIPT
================================================================================
Mode: PRODUCTION
--------------------------------------------------------------------------------

...processing...

Rollback information saved to: D:\ERPv1\tbs-erp-backend\migration-rollback.json
Migration ID: LEGACY_AR_MIGRATION_1707648000000

================================================================================
  MIGRATION REPORT
================================================================================
Mode:                  PRODUCTION
Total Orders Processed: 156
Successful:            152
Failed:                4
Total AR Amount Created: 1,234,567,890.00 VND
================================================================================

✓ Migration completed successfully!
   Use --rollback flag to undo this migration if needed.
```

### Step 4: Verify in Database

Check the database to ensure AR records were created:

```sql
-- Check newly created AR records
SELECT * FROM account_receivables
WHERE created_by = 'SYSTEM_MIGRATION'
ORDER BY created_at DESC;

-- Check AR count by status
SELECT status, COUNT(*), SUM(amount)
FROM account_receivables
WHERE created_by = 'SYSTEM_MIGRATION'
GROUP BY status;
```

### Step 5: Rollback (if needed)

If something went wrong, rollback the migration:

```bash
npm run migrate:legacy-ar:rollback
```

**Expected Output:**
```
Starting rollback process...

Rolling back migration: LEGACY_AR_MIGRATION_1707648000000
Executed at: 2026-02-11T10:30:00.000Z
AR records to delete: 152
--------------------------------------------------------------------------------
✓ Deleted 152 AR records
✓ Rollback completed successfully
```

## Common Scenarios

### Scenario 1: Testing on Staging

```bash
# On staging server
npm run migrate:legacy-ar:dry-run  # Preview
npm run migrate:legacy-ar          # Execute
# Verify results...
npm run migrate:legacy-ar:rollback # Clean up if needed
```

### Scenario 2: Production Deployment

```bash
# 1. Backup database first!
pg_dump erp_db > backup_$(date +%Y%m%d).sql

# 2. Run dry-run
npm run migrate:legacy-ar:dry-run

# 3. Review output carefully

# 4. Execute during low-traffic hours
npm run migrate:legacy-ar

# 5. Verify results
# ... check database ...

# 6. If issues found within 24 hours, rollback
npm run migrate:legacy-ar:rollback
```

### Scenario 3: Failed Orders

If some orders fail during migration:

1. Check the report for error messages
2. Fix the underlying data issues
3. Run the migration again (it will skip already processed orders)

## Troubleshooting

### Issue: "No orders to process"

**Cause:** All eligible orders already have AR records.

**Solution:** This is normal. The migration has already been run or orders are in different statuses.

### Issue: "Outstanding amount is zero or negative"

**Cause:** Order is fully paid or overpaid.

**Solution:** This is expected. The script skips these orders automatically.

### Issue: "Database connection error"

**Cause:** Database is not running or connection string is wrong.

**Solution:**
```bash
# Check if database is running
npm run docker:up

# Verify .env file has correct DATABASE_URL
cat .env | grep DATABASE_URL
```

### Issue: Rollback file not found

**Cause:** Migration was not run in production mode or file was deleted.

**Solution:** Rollback is only available for production runs. If file is lost, manually delete AR records:

```sql
DELETE FROM account_receivables
WHERE created_by = 'SYSTEM_MIGRATION'
AND created_at > '2026-02-11 00:00:00';
```

## Best Practices

1. **Always test first**: Run dry-run before production
2. **Backup database**: Before running in production
3. **Low-traffic hours**: Run during nights or weekends
4. **Monitor closely**: Check logs and database after migration
5. **Keep rollback file**: Don't delete until verified (24-48 hours)
6. **Document execution**: Note when and by whom migration was run

## FAQ

**Q: Can I run the migration multiple times?**
- Yes. It only processes orders without AR records.

**Q: What happens to orders added after migration?**
- They are handled by the normal order workflow, not this script.

**Q: Can I customize the 15-day payment term?**
- Yes. Edit the script and change the `dueDate.setDate(dueDate.getDate() + 15)` line.

**Q: What if I need to rollback multiple migrations?**
- Run `npm run migrate:legacy-ar:rollback` multiple times. Each execution rolls back the most recent one.

**Q: How do I verify the migration was successful?**
- Check the report output and run database queries to verify AR records exist.

## Support

For issues or questions:
1. Check the full README.md in this directory
2. Review the migration report output
3. Check application logs
4. Contact the development team
