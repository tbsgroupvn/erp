# Credit Check Guard Implementation Summary

## Overview
Implemented a comprehensive credit check system that validates customer creditworthiness before allowing order creation in the TBS ERP system.

## Implementation Date
February 11, 2026

## Components Implemented

### 1. CreditCheckGuard
**File:** `src/modules/order/guards/credit-check.guard.ts`

A NestJS guard that validates:
- ✅ Customer active status
- ✅ Overdue debt (blocks if > 15 days overdue)
- ✅ Credit limit (blocks if order amount exceeds available credit)

**Key Features:**
- Vietnamese error messages for user-friendly feedback
- Detailed logging for audit trail
- Configurable overdue threshold (currently 15 days)
- Currency formatting for Vietnamese locale
- Automatic order total calculation from items

### 2. SkipCreditCheck Decorator
**File:** `src/modules/order/guards/skip-credit-check.decorator.ts`

Allows bypassing credit checks for special cases (e.g., admin overrides).

**Usage:**
```typescript
@SkipCreditCheck()
async createOrderWithOverride() { ... }
```

### 3. AccountsReceivableService Enhancement
**File:** `src/modules/accounts-receivable/accounts-receivable.service.ts`

Added new method: `getOverdueDebt(customerId: string)`

**Returns:**
```typescript
{
  total: number;           // Total overdue amount
  maxOverdueDays: number;  // Maximum days overdue
  count: number;           // Number of overdue receivables
}
```

**Features:**
- Queries only OPEN and PARTIAL status receivables
- Calculates outstanding amount (amount - paidAmount)
- Finds maximum overdue days across all receivables
- Efficient database query with proper filtering

### 4. OrderModule Configuration
**File:** `src/modules/order/order.module.ts`

**Changes:**
- Imported `AccountsReceivableModule` for service access
- Registered `CreditCheckGuard` as provider

### 5. OrderController Update
**File:** `src/modules/order/order.controller.ts`

**Changes:**
- Applied `@UseGuards(CreditCheckGuard)` to POST /orders endpoint
- Added import for `CreditCheckGuard`
- Updated API documentation with 403 error response

## Validation Rules

### Rule 1: Customer Status
**Condition:** Customer must be active
**Error:** "Không thể tạo đơn hàng. Khách hàng '{name}' ({code}) đã bị vô hiệu hóa."

### Rule 2: Overdue Debt
**Condition:** No receivable overdue > 15 days
**Formula:** `maxOverdueDays <= 15`
**Error:** "Không thể tạo đơn hàng. Khách hàng '{name}' ({code}) có công nợ quá hạn {days} ngày (vượt quá 15 ngày cho phép). Tổng công nợ quá hạn: {amount} VND."

### Rule 3: Credit Limit
**Condition:** Order amount within available credit
**Formula:** `orderAmount <= (creditLimit - currentDebt)`
**Error:** "Không thể tạo đơn hàng. Giá trị đơn hàng {amount} VND vượt quá hạn mức tín dụng khả dụng. Hạn mức tín dụng: {limit} VND. Công nợ hiện tại: {debt} VND."

## Test Coverage

### Unit Tests

#### CreditCheckGuard Tests
**File:** `src/modules/order/guards/credit-check.guard.spec.ts`

**Test Suites:** 6 suites, 18 tests
- ✅ Bypass scenarios (3 tests)
- ✅ Customer status validation (1 test)
- ✅ Overdue debt validation (3 tests)
- ✅ Credit limit validation (3 tests)
- ✅ Order amount calculation (2 tests)
- ✅ Edge cases (4 tests)
- ✅ Error message localization (2 tests)

**Result:** ✅ All 18 tests passing

#### AccountsReceivableService Tests
**File:** `src/modules/accounts-receivable/accounts-receivable.service.spec.ts`

**Test Suites:** 1 suite, 10 tests
- ✅ Zero overdue receivables
- ✅ Single receivable calculation
- ✅ Multiple receivables calculation
- ✅ Maximum overdue days identification
- ✅ Fully paid receivables handling
- ✅ Partial payments handling
- ✅ Status filtering (OPEN/PARTIAL only)
- ✅ Decimal precision handling
- ✅ Edge case timing
- ✅ Accumulation accuracy

**Result:** ✅ All 10 tests passing

### Integration Tests
**File:** `test/order-credit-check.e2e-spec.ts`

E2E tests covering:
- Order creation with sufficient credit
- Order blocking when credit exceeded
- Order blocking with overdue debt
- Order allowing with acceptable overdue
- Inactive customer blocking
- Multiple items calculation
- Error message quality validation

## Technical Details

### Dependencies
- `@nestjs/common` - Guards, exceptions
- `@nestjs/core` - Reflector for decorators
- `@prisma/client` - Database models and types
- `@core/database/prisma.service` - Database access
- `@modules/accounts-receivable` - AR service integration

### Database Queries
The guard executes 2 queries per order creation:
1. Fetch customer data (creditLimit, currentDebt, tier, isActive)
2. Fetch overdue receivables (via AccountsReceivableService)

### Performance Considerations
- Efficient database queries with proper indexes
- Guards execute before controller logic (fail fast)
- Minimal overhead for valid orders
- Logs only warnings/errors to reduce noise

## Error Handling

All validation failures throw `ForbiddenException` (HTTP 403):

```json
{
  "statusCode": 403,
  "message": "Không thể tạo đơn hàng. Khách hàng...",
  "error": "Forbidden"
}
```

## Logging

The guard logs important events:

**Success:**
```
[CreditCheckGuard] Credit check passed for customer TBS-KH-000001: Order amount 20000000, available credit 50000000
```

**Overdue Failure:**
```
[CreditCheckGuard] Credit check failed for customer TBS-KH-000001: Overdue debt 20000000 VND, max overdue 30 days
```

**Credit Limit Failure:**
```
[CreditCheckGuard] Credit check failed for customer TBS-KH-000001: Order amount 60000000 exceeds available credit 50000000
```

## Configuration

### Overdue Threshold
Current threshold: **15 days**

To modify, edit in `credit-check.guard.ts`:
```typescript
private readonly OVERDUE_THRESHOLD_DAYS = 15;
```

### Future Configuration Options
- Move to environment variable
- Store in database configuration table
- Make customer-tier specific

## API Documentation

### POST /orders
**Description:** Creates a new order with credit validation

**Response Codes:**
- `201` - Order created successfully
- `400` - Validation error (invalid DTO)
- `403` - Credit check failed (overdue debt or insufficient credit)
- `404` - Customer not found

**Example Request:**
```json
{
  "customerId": "clxyz123abc",
  "serviceType": "MHH",
  "branch": "HN",
  "items": [
    {
      "productName": "Product A",
      "quantity": 2,
      "unitPrice": 5000000,
      "currency": "VND"
    }
  ]
}
```

**Example Error Response (403):**
```json
{
  "statusCode": 403,
  "message": "Không thể tạo đơn hàng. Khách hàng 'Công ty ABC' (TBS-KH-000001) có công nợ quá hạn 30 ngày (vượt quá 15 ngày cho phép). Tổng công nợ quá hạn: 20,000,000 VND. Vui lòng thanh toán công nợ trước khi tạo đơn hàng mới.",
  "error": "Forbidden"
}
```

## Files Created/Modified

### Created Files (7)
1. `src/modules/order/guards/credit-check.guard.ts` (157 lines)
2. `src/modules/order/guards/skip-credit-check.decorator.ts` (15 lines)
3. `src/modules/order/guards/credit-check.guard.spec.ts` (673 lines)
4. `src/modules/order/guards/README.md` (356 lines)
5. `src/modules/accounts-receivable/accounts-receivable.service.spec.ts` (345 lines)
6. `test/order-credit-check.e2e-spec.ts` (424 lines)
7. `CREDIT_CHECK_IMPLEMENTATION.md` (this file)

### Modified Files (3)
1. `src/modules/accounts-receivable/accounts-receivable.service.ts`
   - Added `getOverdueDebt()` method (52 lines added)

2. `src/modules/order/order.module.ts`
   - Added import for `AccountsReceivableModule`
   - Registered `CreditCheckGuard` provider

3. `src/modules/order/order.controller.ts`
   - Added `@UseGuards(CreditCheckGuard)` to create endpoint
   - Added import for guard
   - Updated API documentation

## Migration & Deployment

### Pre-deployment Checklist
- ✅ All unit tests passing (28 tests total)
- ✅ Guard integrated with OrderModule
- ✅ AccountsReceivableModule exported service
- ✅ Vietnamese error messages tested
- ✅ Documentation complete

### Deployment Steps
1. Pull latest code from repository
2. Run tests: `npm test`
3. Build application: `npm run build`
4. Deploy to staging environment
5. Run E2E tests: `npm run test:e2e`
6. Monitor logs for credit check events
7. Deploy to production

### Rollback Plan
If issues occur:
1. Remove `@UseGuards(CreditCheckGuard)` from controller
2. Redeploy previous version
3. Orders will be created without credit checks (existing behavior)

## Monitoring & Alerts

### Key Metrics to Monitor
- Credit check failure rate
- Average overdue days at rejection
- Most common rejection reason (debt vs credit limit)
- Response time impact of guard

### Recommended Alerts
- Alert when credit check failure rate > 20%
- Alert when guard causes errors/exceptions
- Alert when database queries timeout

## Future Enhancements

### Phase 2 (Planned)
1. **Tiered Credit Rules**
   - Different thresholds based on customer tier
   - NEW: 0 days, BRONZE: 7 days, SILVER: 15 days, GOLD: 30 days

2. **Configurable Thresholds**
   - Move to database configuration table
   - Allow runtime configuration changes

3. **Grace Period System**
   - Allow orders within grace period with warning
   - Require approval for grace period orders

4. **Alert Integration**
   - Notify finance team when credit checks fail
   - Send customer notifications about credit issues

5. **Audit Trail**
   - Log all credit check decisions
   - Track which orders were blocked and why
   - Generate compliance reports

6. **Multi-Currency Support**
   - Handle credit limits in different currencies
   - Convert order amounts to credit limit currency

### Phase 3 (Future)
1. **AI-Powered Credit Scoring**
   - Predict customer payment behavior
   - Dynamic credit limit recommendations

2. **Customer Self-Service Portal**
   - View credit status and limits
   - Request credit limit increases
   - Pay outstanding invoices

3. **Automated Collections**
   - Automatic reminders for overdue payments
   - Escalation workflows
   - Payment plan management

## Support & Troubleshooting

### Common Issues

#### Issue: Guard Not Applied
**Symptoms:** Orders created despite credit issues
**Solution:**
- Verify `CreditCheckGuard` in OrderModule providers
- Check `@UseGuards(CreditCheckGuard)` on endpoint

#### Issue: Tests Failing
**Symptoms:** Unit tests failing locally
**Solution:**
- Verify Node.js version (v18+)
- Run `npm install` to update dependencies
- Clear Jest cache: `npm test -- --clearCache`

#### Issue: False Positives
**Symptoms:** Valid orders blocked incorrectly
**Solution:**
- Check customer data in database
- Verify AR records are up-to-date
- Review logs for actual calculated values

### Support Contacts
- **Backend Team Lead:** [Name]
- **Finance System Owner:** [Name]
- **DevOps:** [Name]

## Conclusion

The Credit Check Guard implementation provides robust validation of customer creditworthiness before order creation, ensuring financial risk management while maintaining a good user experience through clear Vietnamese error messages. The system is well-tested, documented, and ready for production deployment.

**Status:** ✅ Implementation Complete
**Test Coverage:** ✅ 28 tests passing
**Documentation:** ✅ Complete
**Ready for Deployment:** ✅ Yes
