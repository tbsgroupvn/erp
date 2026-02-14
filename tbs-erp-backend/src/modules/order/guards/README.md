# Credit Check Guard

## Overview

The `CreditCheckGuard` is a NestJS guard that validates customer credit eligibility before allowing order creation. It ensures that customers meet credit requirements and don't have excessive overdue debt.

## Features

- **Overdue Debt Validation**: Blocks orders if customer has debt overdue > 15 days
- **Credit Limit Validation**: Ensures order amount doesn't exceed available credit (creditLimit - currentDebt)
- **Customer Status Check**: Blocks orders for inactive customers
- **Vietnamese Error Messages**: User-friendly error messages in Vietnamese
- **Bypass Capability**: Can be skipped using `@SkipCreditCheck()` decorator

## Architecture

```
┌─────────────────┐
│ OrderController │
│   POST /orders  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ CreditCheckGuard│
└────────┬────────┘
         │
         ├──→ PrismaService (fetch customer)
         │
         └──→ AccountsReceivableService.getOverdueDebt()
                 │
                 └──→ Check overdue debt & days

If validation passes:
         ↓
┌─────────────────┐
│  OrderService   │
│  createOrder()  │
└─────────────────┘
```

## Usage

### Basic Usage

The guard is automatically applied to the order creation endpoint:

```typescript
@Post()
@UseGuards(CreditCheckGuard)
async create(@Body() dto: CreateOrderDto, @CurrentUser() user: ICurrentUser) {
  return await this.orderService.createOrder(dto, user);
}
```

### Bypass Credit Check

For special cases (e.g., admin overrides), use the `@SkipCreditCheck()` decorator:

```typescript
import { SkipCreditCheck } from './guards/skip-credit-check.decorator';

@Post('admin/create-order')
@UseGuards(CreditCheckGuard)
@SkipCreditCheck()
async createOrderWithOverride(@Body() dto: CreateOrderDto) {
  // This will bypass credit checks
  return await this.orderService.createOrder(dto);
}
```

## Validation Rules

### 1. Customer Status Check
- Customer must exist in the database
- Customer `isActive` must be `true`

**Error Message:**
```
Không thể tạo đơn hàng. Khách hàng "{fullName}" ({code}) đã bị vô hiệu hóa.
```

### 2. Overdue Debt Check
- Customer must NOT have any receivable overdue > 15 days
- Only checks `OPEN` and `PARTIAL` status receivables
- Calculates maximum overdue days from all receivables

**Threshold:** 15 days

**Error Message:**
```
Không thể tạo đơn hàng. Khách hàng "{fullName}" ({code}) có công nợ quá hạn {maxOverdueDays} ngày (vượt quá 15 ngày cho phép).
Tổng công nợ quá hạn: {amount} VND.
Vui lòng thanh toán công nợ trước khi tạo đơn hàng mới.
```

### 3. Credit Limit Check
- Order total amount must NOT exceed available credit
- Available credit = `creditLimit - currentDebt`
- Calculates order total from all items: `Σ(quantity × unitPrice)`

**Formula:**
```
orderAmount <= (creditLimit - currentDebt)
```

**Error Message:**
```
Không thể tạo đơn hàng. Giá trị đơn hàng {orderAmount} VND vượt quá hạn mức tín dụng khả dụng.
Hạn mức tín dụng: {creditLimit} VND.
Công nợ hiện tại: {currentDebt} VND.
Hạn mức khả dụng: {availableCredit} VND.
Vui lòng thanh toán công nợ hoặc liên hệ bộ phận tài chính để tăng hạn mức.
```

## Order Amount Calculation

The guard calculates the total order amount from all items:

```typescript
orderAmount = items.reduce((total, item) => {
  return total + (item.quantity * item.unitPrice);
}, 0);
```

**Example:**
```json
{
  "items": [
    { "quantity": 2, "unitPrice": 5000000 },  // 10M VND
    { "quantity": 3, "unitPrice": 3000000 },  // 9M VND
    { "quantity": 1, "unitPrice": 1000000 }   // 1M VND
  ]
}
// Total: 20M VND
```

## AccountsReceivableService Integration

### New Method: `getOverdueDebt(customerId: string)`

Returns overdue debt information for credit validation:

**Response:**
```typescript
{
  total: number;           // Total overdue amount (VND)
  maxOverdueDays: number;  // Maximum days overdue across all receivables
  count: number;           // Number of overdue receivables
}
```

**Query:**
- Filters by `customerId`
- Only includes receivables with `dueDate < now`
- Only includes `OPEN` and `PARTIAL` status
- Calculates outstanding: `amount - paidAmount`

## Testing

### Unit Tests

Run unit tests for the guard:
```bash
npm test -- credit-check.guard.spec.ts
```

Test coverage includes:
- ✅ Bypass scenarios (@SkipCreditCheck)
- ✅ Customer status validation
- ✅ Overdue debt validation (various thresholds)
- ✅ Credit limit validation
- ✅ Order amount calculation
- ✅ Edge cases (zero credit, maxed out, exactly at threshold)
- ✅ Error message localization

### E2E Tests

Run integration tests:
```bash
npm run test:e2e -- order-credit-check.e2e-spec.ts
```

Integration tests verify:
- ✅ End-to-end order creation flow
- ✅ Database integration
- ✅ Multiple validation scenarios
- ✅ Error response format

## Configuration

### Overdue Threshold

The overdue threshold is configurable in the guard:

```typescript
private readonly OVERDUE_THRESHOLD_DAYS = 15;
```

To change the threshold, modify this constant or move it to environment configuration:

```typescript
// In .env
CREDIT_CHECK_OVERDUE_THRESHOLD=15

// In guard
private readonly overdueThreshold =
  parseInt(process.env.CREDIT_CHECK_OVERDUE_THRESHOLD) || 15;
```

## Error Handling

All credit check failures throw `ForbiddenException` (HTTP 403) with Vietnamese error messages.

**API Response Format:**
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
Credit check passed for customer TBS-KH-000001: Order amount 20000000, available credit 50000000
```

**Failure:**
```
Credit check failed for customer TBS-KH-000001: Overdue debt 20000000 VND, max overdue 30 days
```

```
Credit check failed for customer TBS-KH-000001: Order amount 60000000 exceeds available credit 50000000
```

## Dependencies

Required modules:
- `@nestjs/common` - Guard, exceptions
- `@nestjs/core` - Reflector for decorator support
- `@core/database/prisma.service` - Database access
- `@modules/accounts-receivable` - Overdue debt calculation

## Module Setup

The `OrderModule` must import `AccountsReceivableModule`:

```typescript
@Module({
  imports: [AccountsReceivableModule],
  providers: [CreditCheckGuard, ...],
})
export class OrderModule {}
```

## Future Enhancements

Potential improvements:
1. **Tiered Credit Rules**: Different thresholds based on customer tier (NEW, BRONZE, SILVER, GOLD)
2. **Configurable Thresholds**: Move threshold to database configuration table
3. **Grace Period**: Allow orders within a grace period after due date
4. **Alert Integration**: Notify finance team when credit checks fail
5. **Audit Trail**: Log all credit check decisions for compliance
6. **Multi-Currency Support**: Handle credit limits in different currencies

## Troubleshooting

### Guard Not Applied
- Verify `CreditCheckGuard` is in module providers
- Check `UseGuards(CreditCheckGuard)` is on the endpoint
- Ensure `AccountsReceivableModule` is imported

### Tests Failing
- Verify test database is set up
- Check Prisma schema is migrated
- Ensure mock data matches expected types (Decimal, Date)

### Bypass Not Working
- Confirm `@SkipCreditCheck()` decorator is applied
- Check Reflector is properly injected
- Verify decorator metadata key matches guard check

## References

- [NestJS Guards Documentation](https://docs.nestjs.com/guards)
- [NestJS Custom Decorators](https://docs.nestjs.com/custom-decorators)
- [Prisma Decimal Type](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#decimal)
