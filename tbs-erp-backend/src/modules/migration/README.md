# Migration Scripts

This directory contains data migration scripts for the TBS ERP system.

## Legacy AR Migration Script

### Purpose

The `migrate-legacy-ar.script.ts` script creates AccountReceivable records for legacy unpaid orders that are in `COMPLETED` or `SETTLEMENT` status but don't have proper AR records.

### What it does

1. Finds all orders with status `COMPLETED` or `SETTLEMENT`
2. Filters those without any AR records (`receivables` relation is empty)
3. Calculates outstanding amount: `totalAmount - depositPaid`
4. Creates AR record with:
   - `amount` = outstanding amount
   - `dueDate` = order.completedAt + 15 days
   - `status` = 'OPEN' or 'OVERDUE' (based on whether dueDate < now)
   - `note` = 'Migration từ đơn hàng cũ'
   - `createdBy` = 'SYSTEM_MIGRATION'

### Usage

#### Dry Run (Preview Mode)

Preview what would be migrated without making any changes:

```bash
npm run migrate:legacy-ar:dry-run
```

This will:
- Show all orders that would be processed
- Display calculated AR amounts and statuses
- Generate a report without modifying the database

#### Production Run

Execute the actual migration:

```bash
npm run migrate:legacy-ar
```

This will:
- Create AR records in the database
- Save rollback information to `migration-rollback.json`
- Generate a detailed report

#### Rollback

Undo the last migration:

```bash
npm run migrate:legacy-ar:rollback
```

This will:
- Delete all AR records created in the last migration
- Remove the rollback record from the file
- Restore the database to the previous state

### Output

The script generates a detailed report including:

- Total orders processed
- Total successful and failed migrations
- Total AR amount created
- Breakdown by status (OPEN vs OVERDUE)
- List of failed orders with error reasons
- Execution time

Example output:

```
================================================================================
  MIGRATION REPORT
================================================================================
Mode:                  PRODUCTION
Executed At:           2026-02-11T10:30:00.000Z
Duration:              5.23s
--------------------------------------------------------------------------------
Total Orders Processed: 156
Successful:            152
Failed:                4
--------------------------------------------------------------------------------
Total AR Amount Created: 1,234,567,890.00 VND

Status Breakdown:
  OPEN:     98 records, 734,567,890.00 VND
  OVERDUE:  54 records, 500,000,000.00 VND
================================================================================
```

### Safety Features

1. **Dry Run Mode**: Test the migration without making changes
2. **Rollback Function**: Undo the last migration if needed
3. **Validation**: Skips orders with zero or negative outstanding amounts
4. **Error Handling**: Continues processing even if individual orders fail
5. **Detailed Logging**: Provides comprehensive logs for troubleshooting
6. **Rollback File**: Stores migration metadata for safe rollback

### Rollback File

The script creates a `migration-rollback.json` file in the project root containing:

```json
[
  {
    "migrationId": "LEGACY_AR_MIGRATION_1707648000000",
    "executedAt": "2026-02-11T10:30:00.000Z",
    "createdArIds": ["ar_id_1", "ar_id_2", "..."],
    "orderIds": ["order_id_1", "order_id_2", "..."]
  }
]
```

### Error Handling

The script will skip orders that:
- Have zero or negative outstanding amounts
- Are missing required data (customerId, completedAt)
- Have invalid currency or amount values

Failed orders are listed in the migration report with error reasons.

### Best Practices

1. **Always run dry-run first**: Review the preview before executing
2. **Backup your database**: Before running in production
3. **Run during low-traffic hours**: To minimize impact on users
4. **Keep rollback file safe**: Don't delete `migration-rollback.json` until verified
5. **Monitor the report**: Check for failed orders and investigate errors

### Troubleshooting

**Q: Migration fails with "Database connection error"**
- Ensure the database is running and accessible
- Check your `.env` file for correct DATABASE_URL

**Q: Some orders are skipped with "Outstanding amount is zero"**
- This is expected for fully paid orders
- Review the order's totalAmount and depositPaid values

**Q: Rollback file not found**
- Only production runs create rollback files
- Dry runs don't create rollback information

**Q: How to rollback multiple migrations?**
- Run `npm run migrate:legacy-ar:rollback` multiple times
- Each execution rolls back the most recent migration

### Development

To modify the script:

1. Edit `src/modules/migration/migrate-legacy-ar.script.ts`
2. Test with dry-run mode
3. Verify logic with a small dataset
4. Update this README if behavior changes

### Related Files

- `migrate-legacy-ar.script.ts` - Main migration script
- `migration.module.ts` - NestJS module definition
- `migration-rollback.json` - Rollback data (generated at runtime)
