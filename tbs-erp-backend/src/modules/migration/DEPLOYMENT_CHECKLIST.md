# Deployment Checklist - Legacy AR Migration

Use this checklist when deploying and executing the Legacy AR Migration script.

## Pre-Deployment Checklist

### Code Review
- [ ] Review the migration script code (`migrate-legacy-ar.script.ts`)
- [ ] Review all documentation files
- [ ] Verify npm scripts are added to `package.json`
- [ ] Check that all files compile without errors
- [ ] Verify unit tests pass: `npm test -- migrate-legacy-ar.test.ts`

### Environment Setup
- [ ] Staging environment is ready
- [ ] Production environment is ready
- [ ] Database backups are automated
- [ ] Access credentials are prepared

## Staging Deployment

### Deploy Code
- [ ] Merge migration code to staging branch
- [ ] Deploy to staging environment
- [ ] Verify deployment succeeded
- [ ] Check application logs for errors

### Test on Staging
- [ ] Run dry-run mode: `npm run migrate:legacy-ar:dry-run`
- [ ] Review the preview output
- [ ] Verify order selection logic
- [ ] Verify AR calculation logic
- [ ] Note the number of orders to be processed

### Execute on Staging
- [ ] Backup staging database: `pg_dump erp_staging > backup_staging_$(date +%Y%m%d).sql`
- [ ] Run migration: `npm run migrate:legacy-ar`
- [ ] Review the migration report
- [ ] Verify AR records in database
- [ ] Check that rollback file was created

### Verify Results
- [ ] Count AR records: `SELECT COUNT(*) FROM account_receivables WHERE created_by = 'SYSTEM_MIGRATION'`
- [ ] Check AR amounts match orders
- [ ] Verify OPEN vs OVERDUE status distribution
- [ ] Test rollback: `npm run migrate:legacy-ar:rollback`
- [ ] Verify all AR records were deleted
- [ ] Re-run migration to ensure repeatability

### Sign-Off
- [ ] Developer approval
- [ ] QA approval
- [ ] Product owner approval

## Production Deployment

### Pre-Production
- [ ] Schedule maintenance window (recommended: low-traffic hours)
- [ ] Notify stakeholders of planned migration
- [ ] Prepare rollback plan
- [ ] Ensure on-call engineer is available

### Backup
- [ ] Create full database backup
  ```bash
  pg_dump -h [host] -U [user] -d [database] > backup_production_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] Verify backup file size is reasonable
- [ ] Store backup in secure location
- [ ] Test backup restore on separate instance (optional but recommended)

### Deploy Code
- [ ] Merge to production branch
- [ ] Deploy to production environment
- [ ] Verify deployment succeeded
- [ ] Check application logs for errors
- [ ] Verify application is healthy

### Dry Run on Production
- [ ] Run dry-run: `npm run migrate:legacy-ar:dry-run`
- [ ] Review the preview output carefully
- [ ] Compare with staging results
- [ ] Verify expected order count
- [ ] Verify expected AR amounts
- [ ] Get final approval from stakeholders

### Execute Migration
- [ ] Set up terminal monitoring
  ```bash
  # Terminal 1: Run migration
  npm run migrate:legacy-ar

  # Terminal 2: Monitor database
  watch -n 1 'psql -c "SELECT COUNT(*) FROM account_receivables WHERE created_by = '\''SYSTEM_MIGRATION'\''"'
  ```
- [ ] Start migration: `npm run migrate:legacy-ar`
- [ ] Monitor progress in real-time
- [ ] Note start time and end time
- [ ] Save the migration report output

### Immediate Verification
- [ ] Check migration completed successfully
- [ ] Verify AR record count matches expected
- [ ] Verify rollback file was created
- [ ] Check for any error messages in report
- [ ] Spot-check a few orders manually

### Database Verification
Run these SQL queries to verify:

```sql
-- Count AR records created
SELECT COUNT(*) as total_records,
       SUM(amount) as total_amount,
       status,
       COUNT(*) FILTER (WHERE status = 'OPEN') as open_count,
       COUNT(*) FILTER (WHERE status = 'OVERDUE') as overdue_count
FROM account_receivables
WHERE created_by = 'SYSTEM_MIGRATION'
GROUP BY status;

-- Verify AR records link to valid orders
SELECT COUNT(*) as orphaned_records
FROM account_receivables ar
WHERE created_by = 'SYSTEM_MIGRATION'
  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = ar.order_id);

-- Check for duplicate AR records for same order
SELECT order_id, COUNT(*) as ar_count
FROM account_receivables
WHERE created_by = 'SYSTEM_MIGRATION'
GROUP BY order_id
HAVING COUNT(*) > 1;

-- Sample records for manual review
SELECT ar.code, ar.amount, ar.status, ar.due_date,
       o.code as order_code, o.total_amount, o.deposit_paid,
       c.full_name as customer_name
FROM account_receivables ar
JOIN orders o ON o.id = ar.order_id
JOIN customers c ON c.id = ar.customer_id
WHERE ar.created_by = 'SYSTEM_MIGRATION'
LIMIT 10;
```

- [ ] Total AR records match expected count
- [ ] Total AR amount matches expected amount
- [ ] No orphaned records found
- [ ] No duplicate AR records per order
- [ ] Sample records look correct

### Application Verification
- [ ] Check AR module still works correctly
- [ ] Test creating new AR manually
- [ ] Test AR listing and filtering
- [ ] Test AR payment recording
- [ ] Verify no performance degradation

## Post-Deployment

### Monitoring (First 24 Hours)
- [ ] Monitor application logs for errors
- [ ] Monitor database performance
- [ ] Check for customer complaints
- [ ] Verify AR aging reports
- [ ] Monitor system health metrics

### Documentation
- [ ] Document actual execution time
- [ ] Document any issues encountered
- [ ] Update runbook if needed
- [ ] Save migration report
- [ ] Save rollback file backup

### Communication
- [ ] Notify stakeholders of successful migration
- [ ] Send summary email with key metrics:
  - Total orders processed
  - Total AR amount created
  - OPEN vs OVERDUE breakdown
  - Any issues or anomalies
- [ ] Update project tracking system

### Cleanup (After 48-72 Hours)
- [ ] Verify no issues reported
- [ ] Archive rollback file (don't delete immediately)
- [ ] Archive migration report
- [ ] Remove old database backups (keep final backup)

## Rollback Procedure (If Needed)

### When to Rollback
Execute rollback if:
- Critical errors discovered
- Data integrity issues found
- Calculation errors detected
- Stakeholder requires reversal

### Rollback Steps
- [ ] Stop application (if needed)
- [ ] Run rollback: `npm run migrate:legacy-ar:rollback`
- [ ] Verify all AR records deleted
- [ ] Check database consistency
- [ ] Restart application
- [ ] Verify system operational
- [ ] Notify stakeholders
- [ ] Investigate root cause
- [ ] Fix issues before re-attempting

### Post-Rollback
- [ ] Document reason for rollback
- [ ] Document lessons learned
- [ ] Update migration script if needed
- [ ] Re-test on staging
- [ ] Schedule new migration window

## Emergency Contacts

```
Developer:       [Name] - [Phone] - [Email]
DevOps:          [Name] - [Phone] - [Email]
DBA:             [Name] - [Phone] - [Email]
Product Owner:   [Name] - [Phone] - [Email]
On-Call Engineer:[Name] - [Phone] - [Email]
```

## Sign-Off

### Staging Deployment
- [ ] Developer: _________________ Date: _______
- [ ] QA Engineer: ______________ Date: _______

### Production Deployment
- [ ] Developer: _________________ Date: _______
- [ ] DevOps: ___________________ Date: _______
- [ ] Product Owner: ____________ Date: _______

### Post-Deployment Verification
- [ ] Developer: _________________ Date: _______
- [ ] QA Engineer: ______________ Date: _______

### Final Sign-Off (After 48 Hours)
- [ ] Project Manager: __________ Date: _______

---

## Notes

Use this section to document any issues, observations, or deviations from the plan:

```
Date/Time | Note
----------|-----
          |
          |
          |
```

---

**Document Version:** 1.0
**Last Updated:** 2026-02-11
