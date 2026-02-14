# Commission Flow Module

Automatic commission calculation and approval system for sales team.

## Overview

This module implements a fully automated commission flow based on order completion and payment status. Commissions are calculated based on profit margins and automatically approved when the customer pays in full.

## Architecture

### Event-Driven Flow

```
Order Completed → Commission PENDING → AR Fully Paid → Commission APPROVED → Manual Payment → PAID
```

### Components

1. **CommissionCalculatorService** - Calculates commission based on profit margin tiers
2. **OrderCompletedListener** - Creates PENDING commission when order is COMPLETED
3. **ArPaymentListener** - Auto-approves commission when AR is fully paid

## Commission Calculation Logic

### Formula

```
Revenue = Order.totalAmount
Cost = Sum(CostAllocation.allocatedAmount)
Net Profit = Revenue - Cost
Commission Rate = Query from CommissionRule based on ServiceType + Profit Range
Commission Amount = Net Profit × Commission Rate
```

### Tiered Rate Structure

Commission rates are tiered based on profit margins. Higher profits earn higher commission rates.

**Example for VCT (Vận chuyển thuần):**
- 0-5M VND profit → 2% commission
- 5M-15M VND profit → 4% commission
- 15M-30M VND profit → 6% commission
- 30M+ VND profit → 8% commission

Each service type (VCT, MHH, UTXNK, LCLCN) has its own tier structure.

## Status Workflow

```
PENDING → APPROVED → PAID
```

- **PENDING**: Commission calculated, waiting for customer payment
- **APPROVED**: Customer paid in full (AR status = PAID), ready for payout
- **PAID**: Commission has been paid to sales person

## Event System

### Events Emitted

#### 1. commission.pending
Emitted when a commission record is created (order completed).

```typescript
{
  commissionId: string;
  orderId: string;
  orderCode: string;
  saleId: string;
  commissionAmount: number;
  netProfit: number;
  createdAt: Date;
}
```

**Listeners:**
- Notification system → Notify sale person about pending commission

#### 2. commission.approved
Emitted when a commission is auto-approved (AR fully paid).

```typescript
{
  commissionId: string;
  orderId: string;
  orderCode: string;
  saleId: string;
  commissionAmount: number;
  approvedBy: 'SYSTEM_AUTO';
  approvedAt: Date;
  arId: string;
  arCode: string;
}
```

**Listeners:**
- Notification system → Notify sale person + finance team
- Finance dashboard → Update payable commissions

### Events Listened To

#### 1. order.status.changed
```typescript
{
  orderId: string;
  code: string;
  customerId: string;
  fromStatus: string;
  toStatus: string; // Must be 'COMPLETED'
  changedBy: string;
  serviceType: string;
}
```

**Handler:** `OrderCompletedListener.handleOrderStatusChanged()`

#### 2. ar.payment.recorded
```typescript
{
  arId: string;
  customerId: string;
  paymentAmount: number;
  isFullyPaid: boolean; // Must be true
  reference?: string;
}
```

**Handler:** `ArPaymentListener.handleArPaymentRecorded()`

## Database Schema

### CommissionRecord

```prisma
model CommissionRecord {
  id               String   @id @default(cuid())
  orderId          String
  saleId           String
  orderRevenue     Float    // Revenue from order
  orderCost        Float    // Total allocated costs
  netProfit        Float    // Revenue - Cost
  commissionRate   Float    // 0.0 to 1.0 (e.g., 0.05 = 5%)
  commissionAmount Float    // netProfit * commissionRate
  status           String   // PENDING, APPROVED, PAID
  approvedBy       String?  // User ID or 'SYSTEM_AUTO'
  approvedAt       DateTime?
  paidAt           DateTime?
  createdAt        DateTime @default(now())
}
```

### CommissionRule

```prisma
model CommissionRule {
  id          String      @id @default(cuid())
  serviceType ServiceType // VCT, MHH, UTXNK, LCLCN
  minProfit   Float       // Minimum profit (inclusive)
  maxProfit   Float       // Maximum profit (exclusive)
  rate        Float       // Commission rate (0.0 to 1.0)
  description String?
  isActive    Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}
```

## API Endpoints

### Existing Endpoints (CommissionService)

- `GET /commission/rules` - List all active commission rules
- `POST /commission/rules` - Create a new commission rule
- `GET /commission/my` - Get my commission history
- `GET /commission/team` - Get team commission summary (for leaders)
- `GET /commission/monthly/:year/:month` - Get monthly commission report
- `POST /commission/:id/approve` - Manually approve a commission (for KT TH)

## Usage Examples

### 1. Seed Commission Rules

```bash
npx ts-node prisma/seeds/commission-rules.seed.ts
```

### 2. Test Commission Calculation

```typescript
// When an order is completed, the system automatically:
// 1. Calculates revenue and costs
// 2. Determines net profit
// 3. Finds applicable commission rule
// 4. Creates CommissionRecord with status=PENDING
// 5. Emits 'commission.pending' event

// Example flow:
Order #TBS-ORD-260211-0001
├─ Service: MHH (Mua hàng hộ)
├─ Revenue: 50,000,000 VND
├─ Costs: 35,000,000 VND
├─ Net Profit: 15,000,000 VND
├─ Commission Rule: MHH [10M-30M] @ 5%
└─ Commission: 750,000 VND (PENDING)
```

### 3. Auto-Approval Flow

```typescript
// When customer pays the AR in full:
// 1. ArPaymentListener detects isFullyPaid=true
// 2. Finds related CommissionRecord
// 3. Updates status PENDING → APPROVED
// 4. Sets approvedBy='SYSTEM_AUTO'
// 5. Emits 'commission.approved' event

// Example:
AR #TBS-AR-000123 PAID
├─ Order: #TBS-ORD-260211-0001
├─ Commission: 750,000 VND
├─ Status: PENDING → APPROVED
├─ Approved By: SYSTEM_AUTO
└─ Approved At: 2026-02-11T14:30:00Z
```

## Error Handling

### Commission Calculation Errors

1. **No applicable rule found**
   - Log warning
   - Skip commission creation
   - Commission = 0

2. **Order not found**
   - Log error
   - Skip processing

3. **Commission already exists**
   - Log warning
   - Skip duplicate creation

### Auto-Approval Errors

1. **AR has no linked order**
   - Log warning
   - Skip approval

2. **No PENDING commission found**
   - Log info
   - Normal case (commission may not exist yet)

3. **Database errors**
   - Log error with stack trace
   - Transaction rollback
   - Retry on next payment event

## Monitoring & Alerts

### Logs to Monitor

```bash
# Successful commission creation
Commission PENDING created for order TBS-ORD-001: revenue=50M, cost=35M, profit=15M, commission=750K

# Auto-approval
Commission auto-approved for order TBS-ORD-001 (AR TBS-AR-123 fully paid)

# Warnings
No commission rule found for VCT with profit 45000000
Commission already exists for order TBS-ORD-001

# Errors
Failed to calculate commission for order TBS-ORD-001: Database connection timeout
```

### Metrics to Track

- Total commissions PENDING by sale person
- Total commissions APPROVED (awaiting payout)
- Average commission per order
- Commission rate by service type
- Time from PENDING → APPROVED (payment collection speed)

## Testing

### Unit Tests

```bash
npm test commission-calculator.service.spec.ts
npm test order-completed.listener.spec.ts
npm test ar-payment.listener.spec.ts
```

### Integration Tests

1. Create order → Complete order → Verify PENDING commission
2. Record AR payment (partial) → Verify commission still PENDING
3. Record AR payment (full) → Verify commission APPROVED
4. Test edge cases:
   - Order with no costs (100% profit)
   - Order with negative profit
   - Order with no matching commission rule

## Future Enhancements

1. **Manual Override**: Allow finance team to manually adjust commission amounts
2. **Commission Clawback**: If order is returned/refunded, reverse the commission
3. **Team Commission Split**: Split commission between sale and leader
4. **Performance Bonuses**: Additional bonus tiers based on monthly/quarterly targets
5. **Commission Cap**: Maximum commission amount per order/month
6. **Commission Reports**: Excel export for payroll integration

## Troubleshooting

### Commission not created when order completed

1. Check if order status is COMPLETED
2. Verify commission rules exist for the service type
3. Check logs for "No applicable commission rule" warning
4. Ensure CostAllocations exist for profit calculation

### Commission not auto-approved when paid

1. Verify AR.isFullyPaid = true
2. Check if AR has linked orderId
3. Verify commission status is PENDING (not already APPROVED)
4. Check event emitter logs

### Commission amount is 0

1. Check if profit is negative (cost > revenue)
2. Verify commission rule rate is not 0
3. Check CostAllocation records

## Support

For questions or issues, contact:
- **Development Team**: dev@tbssaigon.com
- **Finance Team**: finance@tbssaigon.com
