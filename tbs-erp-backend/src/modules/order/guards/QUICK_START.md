# Credit Check Guard - Quick Start Guide

## What is it?

A guard that prevents customers with credit issues from creating orders.

## When does it run?

Automatically runs when creating a new order via `POST /orders`

## What does it check?

1. ✅ Customer is active
2. ✅ No debt overdue > 15 days
3. ✅ Order amount doesn't exceed available credit

## How to test locally

### Run unit tests
```bash
npm test -- credit-check.guard.spec.ts
```

### Run all tests
```bash
npm test
```

### Run E2E tests
```bash
npm run test:e2e -- order-credit-check.e2e-spec.ts
```

## Example scenarios

### ✅ Pass: Order within credit limit
```json
{
  "customerId": "customer-1",
  "items": [
    { "productName": "Product A", "quantity": 1, "unitPrice": 1000000 }
  ]
}
```
Customer has 100M credit limit, 50M debt → 50M available ✅

### ❌ Fail: Order exceeds credit limit
```json
{
  "customerId": "customer-1",
  "items": [
    { "productName": "Expensive Product", "quantity": 1, "unitPrice": 60000000 }
  ]
}
```
Customer has 100M credit limit, 50M debt → 50M available
Order is 60M → ❌ Blocked

**Error:**
```
Không thể tạo đơn hàng. Giá trị đơn hàng 60,000,000 VND vượt quá hạn mức tín dụng khả dụng...
```

### ❌ Fail: Customer has overdue debt > 15 days
```json
{
  "customerId": "customer-2",
  "items": [
    { "productName": "Product B", "quantity": 1, "unitPrice": 1000000 }
  ]
}
```
Customer has receivable overdue 20 days → ❌ Blocked

**Error:**
```
Không thể tạo đơn hàng. Khách hàng "ABC Company" (TBS-KH-000001) có công nợ quá hạn 20 ngày...
```

## How to bypass (admin only)

Use `@SkipCreditCheck()` decorator:

```typescript
import { SkipCreditCheck } from './guards/skip-credit-check.decorator';

@Post('admin/emergency-order')
@SkipCreditCheck()
async createEmergencyOrder(@Body() dto: CreateOrderDto) {
  return this.orderService.createOrder(dto);
}
```

## Common issues

### Issue: Order blocked but customer seems fine
**Check:**
1. Go to customer page, verify credit limit and current debt
2. Check Accounts Receivable for overdue invoices
3. Look at server logs for exact reason

### Issue: Tests failing
**Fix:**
```bash
# Clear cache and reinstall
npm test -- --clearCache
npm install
npm test
```

### Issue: Guard not working
**Check:**
1. Is `CreditCheckGuard` in `OrderModule` providers?
2. Is `@UseGuards(CreditCheckGuard)` on the endpoint?
3. Is `AccountsReceivableModule` imported?

## Key files

```
src/modules/order/guards/
├── credit-check.guard.ts          # Main guard logic
├── credit-check.guard.spec.ts     # Unit tests
├── skip-credit-check.decorator.ts # Bypass decorator
└── README.md                      # Full documentation
```

## Configuration

**Overdue threshold:** 15 days (configurable in guard file)

```typescript
// In credit-check.guard.ts
private readonly OVERDUE_THRESHOLD_DAYS = 15;
```

## API Response Codes

- `201` - Order created (credit check passed)
- `403` - Order blocked (credit check failed)
- `400` - Invalid request data

## Monitoring

Check logs for:
```
[CreditCheckGuard] Credit check passed for customer...
[CreditCheckGuard] Credit check failed for customer...
```

## Questions?

See full documentation: `README.md` in this directory
