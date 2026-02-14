# Commission Flow Implementation Guide

## Quick Start

### 1. Install Dependencies

All dependencies are already included in the NestJS project:
- `@nestjs/event-emitter` - Event handling
- `@prisma/client` - Database access

### 2. Seed Commission Rules

Run the seed script to populate commission rules:

```bash
cd D:\ERPv1\tbs-erp-backend
npx ts-node prisma/seeds/commission-rules.seed.ts
```

This creates tiered commission rules for all service types:
- VCT: 2-8% based on profit
- MHH: 3-10% based on profit
- UTXNK: 2.5-9% based on profit
- LCLCN: 3-9.5% based on profit

### 3. Module Registration

The CommissionModule is already registered in the main app module with all required providers:

```typescript
// commission.module.ts
@Module({
  controllers: [CommissionController],
  providers: [
    CommissionService,
    CommissionCalculatorService,
    OrderCompletedListener,      // Listens to order.status.changed
    ArPaymentListener,            // Listens to ar.payment.recorded
  ],
  exports: [CommissionService, CommissionCalculatorService],
})
export class CommissionModule {}
```

### 4. Verify Event Emitter Configuration

Ensure EventEmitter2 is configured in your app.module.ts:

```typescript
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 10,
      verboseMemoryLeak: true,
    }),
    // ... other modules
  ],
})
export class AppModule {}
```

## File Structure

```
src/modules/commission/
├── commission.module.ts                 # Module configuration
├── commission.service.ts                # Main service (CRUD, reports)
├── commission.controller.ts             # API endpoints
├── services/
│   ├── commission-calculator.service.ts # Commission calculation logic
│   └── commission-calculator.service.spec.ts # Unit tests
├── listeners/
│   ├── order-completed.listener.ts      # Creates PENDING commission
│   └── ar-payment.listener.ts           # Auto-approves when paid
├── dto/
│   ├── commission-events.dto.ts         # Event payload interfaces
│   ├── create-commission-rule.dto.ts    # Rule creation DTO
│   └── commission-query.dto.ts          # Query DTOs
├── README.md                            # Detailed documentation
└── IMPLEMENTATION_GUIDE.md             # This file
```

## Flow Diagram

```
┌─────────────────┐
│  Order Service  │
└────────┬────────┘
         │
         │ emits: order.status.changed
         │ when: toStatus = 'COMPLETED'
         ▼
┌────────────────────────────┐
│ OrderCompletedListener     │
├────────────────────────────┤
│ 1. Check if commission     │
│    already exists          │
│ 2. Get order with costs    │
│ 3. Calculate commission    │
│    using Calculator        │
│ 4. Create PENDING record   │
│ 5. Emit commission.pending │
└────────┬───────────────────┘
         │
         │ stored in DB
         ▼
┌─────────────────────────────┐
│   CommissionRecord          │
│   status: PENDING           │
└─────────────────────────────┘
         │
         │ waits for payment...
         │
┌────────┴─────────────┐
│ AR Payment Service   │
└────────┬─────────────┘
         │
         │ emits: ar.payment.recorded
         │ when: isFullyPaid = true
         ▼
┌─────────────────────────────┐
│ ArPaymentListener           │
├─────────────────────────────┤
│ 1. Check if fully paid      │
│ 2. Find related order       │
│ 3. Find PENDING commission  │
│ 4. Update to APPROVED       │
│ 5. Set approvedBy='SYSTEM'  │
│ 6. Emit commission.approved │
└────────┬────────────────────┘
         │
         │ updated in DB
         ▼
┌─────────────────────────────┐
│   CommissionRecord          │
│   status: APPROVED          │
│   approvedBy: SYSTEM_AUTO   │
└─────────────────────────────┘
         │
         │ manual payment...
         ▼
┌─────────────────────────────┐
│   CommissionRecord          │
│   status: PAID              │
└─────────────────────────────┘
```

## Testing the Flow

### Test 1: Create Commission on Order Completion

```bash
# 1. Create an order
POST /orders
{
  "customerId": "customer-123",
  "saleId": "sale-456",
  "serviceType": "MHH",
  "totalAmount": 50000000,
  "items": [...]
}

# 2. Add cost allocations
POST /operation-costs/allocate
{
  "orderId": "order-xxx",
  "costType": "FREIGHT",
  "allocatedAmount": 35000000
}

# 3. Complete the order (triggers commission calculation)
PATCH /orders/{orderId}/status
{
  "status": "COMPLETED"
}

# 4. Verify commission was created
GET /commission/my
# Should show PENDING commission for this order
```

### Test 2: Auto-Approve on Payment

```bash
# 1. Record AR payment (partial)
POST /accounts-receivable/{arId}/payment
{
  "amount": 25000000,
  "reference": "Bank transfer 1"
}
# Commission should still be PENDING

# 2. Record final payment (full)
POST /accounts-receivable/{arId}/payment
{
  "amount": 25000000,
  "reference": "Bank transfer 2"
}
# Commission should auto-approve to APPROVED

# 3. Verify commission status
GET /commission/my
# Should show APPROVED commission with approvedBy='SYSTEM_AUTO'
```

## Monitoring Logs

Enable debug logging to monitor the commission flow:

```typescript
// main.ts or logger config
Logger.overrideLogger(['log', 'error', 'warn', 'debug']);
```

### Expected Log Messages

**Order Completion:**
```
[OrderCompletedListener] Order TBS-ORD-001 completed — calculating commission
[CommissionCalculatorService] Order TBS-ORD-001: revenue=50000000, cost=35000000, profit=15000000
[CommissionCalculatorService] Commission rule applied: MHH profit 15000000 → rate 5% → amount 750000
[OrderCompletedListener] Commission PENDING created for order TBS-ORD-001: revenue=50000000, cost=35000000, profit=15000000, commission=750000
```

**AR Payment (Partial):**
```
[ArPaymentListener] AR ar-123 partially paid, commission approval pending full payment
```

**AR Payment (Full):**
```
[ArPaymentListener] AR ar-123 fully paid — processing commission auto-approval
[ArPaymentListener] Commission comm-456 auto-approved for order TBS-ORD-001 (AR TBS-AR-123 fully paid)
```

## API Endpoints

### Commission Rules

```bash
# List all active commission rules
GET /commission/rules

# Create a new commission rule
POST /commission/rules
{
  "serviceType": "VCT",
  "minProfit": 0,
  "maxProfit": 5000000,
  "rate": 0.02,
  "description": "VCT low profit tier"
}
```

### Commission Records

```bash
# Get my commissions (sale person)
GET /commission/my?startDate=2026-01-01&endDate=2026-01-31

# Get team commissions (leader)
GET /commission/team?startDate=2026-01-01&endDate=2026-01-31

# Get monthly report (admin/finance)
GET /commission/monthly/2026/1

# Manually approve a commission (KT TH role)
POST /commission/{id}/approve
```

## Event Listeners

### Registering Custom Listeners

If you want to add additional logic when commission events occur:

```typescript
// notification.listener.ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CommissionPendingEvent, CommissionApprovedEvent } from './dto/commission-events.dto';

@Injectable()
export class CommissionNotificationListener {

  @OnEvent('commission.pending')
  async handleCommissionPending(event: CommissionPendingEvent) {
    // Send notification to sale person
    await this.notificationService.send({
      userId: event.saleId,
      title: 'Commission Pending',
      message: `You have a pending commission of ${event.commissionAmount} VND for order ${event.orderCode}`,
    });
  }

  @OnEvent('commission.approved')
  async handleCommissionApproved(event: CommissionApprovedEvent) {
    // Send notification to sale person and finance
    await this.notificationService.send({
      userId: event.saleId,
      title: 'Commission Approved',
      message: `Your commission of ${event.commissionAmount} VND has been approved and is ready for payout`,
    });
  }
}
```

## Troubleshooting

### Commission not created when order completed

**Check:**
1. ✅ Order status is exactly 'COMPLETED' (case-sensitive)
2. ✅ Commission rules exist for the service type
3. ✅ CostAllocation records exist (profit can be calculated)
4. ✅ EventEmitter2 is properly configured
5. ✅ OrderCompletedListener is registered in module

**Debug:**
```typescript
// Add temporary log in order.service.ts
this.logger.debug('Emitting order.status.changed event', {
  orderId: order.id,
  toStatus: 'COMPLETED',
});
```

### Commission not auto-approved when paid

**Check:**
1. ✅ AR isFullyPaid = true
2. ✅ AR has orderId linked
3. ✅ Commission exists with status='PENDING'
4. ✅ ArPaymentListener is registered in module

**Debug:**
```typescript
// Check AR status
SELECT * FROM account_receivables WHERE id = 'ar-xxx';

// Check commission
SELECT * FROM commission_records WHERE order_id = 'order-xxx';
```

### Commission amount is incorrect

**Check:**
1. ✅ CostAllocation records are complete
2. ✅ Commission rule tiers are correct (no gaps/overlaps)
3. ✅ Order totalAmount is accurate

**Validate Rules:**
```bash
# Run validation
curl -X POST http://localhost:3000/commission/validate-rules?serviceType=VCT
```

## Performance Considerations

### Database Indexes

Ensure these indexes exist (should be auto-created from Prisma schema):

```prisma
// CommissionRecord
@@index([orderId])
@@index([saleId])
@@index([status])

// CommissionRule
@@index([serviceType, isActive])
```

### Query Optimization

The listeners use optimized queries:
- ✅ Select only needed fields
- ✅ Single query for order + cost allocations
- ✅ findFirst with WHERE clause instead of findMany

### Event Handling

Events are processed asynchronously:
- ✅ Non-blocking event emission
- ✅ Error handling with try-catch
- ✅ Detailed logging for debugging

## Next Steps

After implementing the commission flow:

1. **Add Notification Listeners** - Notify users of commission status changes
2. **Create Dashboard** - Show pending/approved commissions to finance team
3. **Export Functionality** - Excel export for payroll integration
4. **Audit Trail** - Log all commission status changes
5. **Reporting** - Monthly/quarterly commission reports

## Support

For questions or issues:
- Check logs first: `tail -f logs/app.log | grep Commission`
- Review README.md for detailed documentation
- Contact development team for assistance
