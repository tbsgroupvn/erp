# Commission Flow Deployment Checklist

Use this checklist to ensure the commission flow is properly deployed and functioning.

## Pre-Deployment

### Code Review
- [ ] All files compiled without TypeScript errors
- [ ] Module properly exports services and imports event emitter
- [ ] Listeners are registered in CommissionModule providers
- [ ] No circular dependencies detected

### Database
- [ ] Prisma schema includes CommissionRecord model
- [ ] Prisma schema includes CommissionRule model
- [ ] All indexes are defined:
  - [ ] CommissionRecord: orderId, saleId, status
  - [ ] CommissionRule: serviceType, isActive
- [ ] Run `npx prisma generate` to update Prisma client
- [ ] Run `npx prisma migrate dev` if schema changed

### Seed Data
- [ ] Run commission rules seed script:
  ```bash
  npx ts-node prisma/seeds/commission-rules.seed.ts
  ```
- [ ] Verify rules were created:
  ```bash
  npx prisma studio
  # Check CommissionRule table
  ```

## Deployment

### Build & Deploy
- [ ] Run build: `npm run build`
- [ ] Build succeeds without errors
- [ ] Deploy to staging environment
- [ ] Restart application services

### Configuration
- [ ] EventEmitter2 is configured in AppModule
- [ ] Logger level is set appropriately (debug for testing)
- [ ] Environment variables are set correctly

## Post-Deployment Testing

### Test 1: Commission Calculation
- [ ] Create a test order with known values
- [ ] Add cost allocations to the order
- [ ] Change order status to COMPLETED
- [ ] Check logs for commission calculation message
- [ ] Verify CommissionRecord created with status=PENDING
- [ ] Query database to confirm:
  ```sql
  SELECT * FROM commission_records WHERE order_id = 'test-order-id';
  ```

### Test 2: Auto-Approval
- [ ] Create an AccountReceivable for the test order
- [ ] Record partial payment (< total amount)
- [ ] Verify commission still PENDING
- [ ] Record final payment (full amount paid)
- [ ] Check logs for auto-approval message
- [ ] Verify CommissionRecord updated:
  - [ ] status = 'APPROVED'
  - [ ] approvedBy = 'SYSTEM_AUTO'
  - [ ] approvedAt is set
- [ ] Query database to confirm:
  ```sql
  SELECT * FROM commission_records WHERE order_id = 'test-order-id';
  ```

### Test 3: Event Emissions
- [ ] Monitor application logs for event emissions
- [ ] Verify 'commission.pending' event is emitted on order completion
- [ ] Verify 'commission.approved' event is emitted on full payment
- [ ] If notification system exists, check notifications were sent

### Test 4: API Endpoints
- [ ] Test GET /commission/rules (list all rules)
- [ ] Test GET /commission/my (sale person can see their commissions)
- [ ] Test GET /commission/team (leader can see team commissions)
- [ ] Test GET /commission/monthly/2026/1 (monthly report)
- [ ] Test POST /commission/:id/approve (manual approval by KT TH)

### Test 5: Error Handling
- [ ] Complete order with no commission rule (verify logs warning)
- [ ] Complete order twice (verify duplicate detection)
- [ ] Record payment for AR with no order (verify logs warning)
- [ ] All errors logged without crashing the application

## Monitoring

### Metrics to Monitor
- [ ] Number of commissions created per day
- [ ] Number of commissions auto-approved per day
- [ ] Average time from PENDING to APPROVED
- [ ] Total commission amount PENDING
- [ ] Total commission amount APPROVED
- [ ] Failed commission calculations (errors)

### Log Monitoring
- [ ] Set up log aggregation (e.g., ELK, Datadog)
- [ ] Create alerts for commission calculation errors
- [ ] Create alerts for auto-approval failures
- [ ] Monitor for unexpected commission amounts

### Database Monitoring
- [ ] Monitor CommissionRecord table growth
- [ ] Check for orphaned records (no order or sale)
- [ ] Verify indexes are being used (query performance)

## Rollback Plan

If issues are detected:

### Step 1: Disable Listeners
Comment out listeners in commission.module.ts:
```typescript
@Module({
  providers: [
    CommissionService,
    CommissionCalculatorService,
    // OrderCompletedListener,  // DISABLED
    // ArPaymentListener,       // DISABLED
  ],
})
```

### Step 2: Deploy Hotfix
```bash
npm run build
# Deploy updated code
# Restart services
```

### Step 3: Manual Processing
Process pending commissions manually:
```sql
-- Find orders that should have commissions
SELECT o.id, o.code, o.status, o.sale_id, o.total_amount
FROM orders o
WHERE o.status = 'COMPLETED'
  AND NOT EXISTS (
    SELECT 1 FROM commission_records cr WHERE cr.order_id = o.id
  )
ORDER BY o.completed_at DESC;

-- Manually create commission records if needed
-- Or wait for fix and re-emit events
```

## Performance Checklist

### Database Performance
- [ ] No slow queries detected (< 100ms avg)
- [ ] Indexes are being used (check EXPLAIN)
- [ ] No table locks or deadlocks
- [ ] Connection pool size is adequate

### Application Performance
- [ ] Event processing is non-blocking
- [ ] No memory leaks in listeners
- [ ] CPU usage is normal
- [ ] Response times are acceptable

## Security Checklist

### Access Control
- [ ] Commission endpoints require authentication
- [ ] Sale persons can only see their own commissions
- [ ] Leaders can only see their team's commissions
- [ ] Commission rules CRUD requires admin role
- [ ] Manual approval requires KT TH (Chief Accountant) role

### Data Integrity
- [ ] Commission amounts cannot be negative
- [ ] Commission records cannot be deleted (soft delete only)
- [ ] Approved commissions cannot be un-approved
- [ ] Audit trail is maintained for all changes

## Documentation

### Updated Documentation
- [ ] README.md is up to date
- [ ] IMPLEMENTATION_GUIDE.md reviewed
- [ ] API documentation includes commission endpoints
- [ ] Event schema documented
- [ ] Database schema documented

### Team Communication
- [ ] Notify finance team of new auto-approval feature
- [ ] Notify sales team of commission visibility
- [ ] Provide training on commission dashboard (if exists)
- [ ] Document known issues and workarounds

## Sign-Off

- [ ] **Developer**: Code reviewed and tested
  - Name: _______________
  - Date: _______________

- [ ] **QA**: Test cases passed
  - Name: _______________
  - Date: _______________

- [ ] **Finance**: Business logic approved
  - Name: _______________
  - Date: _______________

- [ ] **DevOps**: Deployed and monitored
  - Name: _______________
  - Date: _______________

## Post-Deployment Actions

### Week 1
- [ ] Daily log review for errors
- [ ] Monitor commission creation rate
- [ ] Verify auto-approval is working
- [ ] Collect feedback from sales team

### Week 2-4
- [ ] Review commission amounts for accuracy
- [ ] Compare with manual calculations (if any)
- [ ] Optimize query performance if needed
- [ ] Fine-tune commission rule tiers based on feedback

### Month 1
- [ ] Generate first monthly commission report
- [ ] Verify report matches expectations
- [ ] Document any edge cases discovered
- [ ] Plan future enhancements

## Notes

Add any deployment-specific notes here:

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Environment**: [ ] Staging [ ] Production
**Version**: _______________
