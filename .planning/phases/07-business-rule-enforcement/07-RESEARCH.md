# Phase 7: Business Rule Enforcement - Research

**Researched:** 2026-03-19
**Domain:** Domain-specific financial and operational safeguards (NestJS backend)
**Confidence:** HIGH

## Summary

Phase 7 hardens five domain-specific business rules that already have partial implementations in the codebase. Research reveals that the existing code covers 70-80% of required behavior -- the primary work is verification, gap closure, and comprehensive test coverage.

Key findings from code audit:
1. **Deposit Gate (DAT-07)**: `DepositGateService` is well-implemented with correct tier rates (NEW=100%, REGULAR=70%, VIP=50%, STRATEGIC=30%). Only needs unit tests.
2. **Anti-Fraud (DAT-08)**: `PaymentVoucherValidator` implements all 4 BLOCK rules and the FLAG rule. The "wrong owner" check exists but only for RECEIPT type (not PAYMENT). Needs verification that the owner check applies correctly per the requirement, plus unit tests.
3. **AR Aging Auto-Block (DAT-09)**: `CreditCheckGuard` blocks order creation for blocked customers. **GAP**: No delivery-level block exists -- `DeliveryDispatchService.assignDriver()` does NOT check `customer.isBlocked`. This is a missing enforcement point.
4. **COD Enforcement (DAT-10)**: Fully implemented -- `CodService.enforceCODReconciliation()` cron blocks drivers, and `DeliveryDispatchService.assignDriver()` checks `driver.isCODBlocked`. Needs tests.
5. **Approval SLA Escalation (DAT-11)**: Two parallel mechanisms exist -- `SlaTracker.checkOverdueSteps()` (every 30min, deadline-based) and `ApprovalService.checkOverdueApprovals()` (every hour, updatedAt-based). The latter emits `approval.escalated` at 2x threshold but does NOT actually reassign/advance the step. **GAP**: Escalation emits events but does not perform the actual "move to next level" action.

**Primary recommendation:** Focus on: (a) writing unit tests for all 5 rules, (b) adding delivery-level AR blocking, (c) implementing actual escalation action (not just notification), (d) verifying edge cases in existing implementations.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Deposit gate: Verify `DepositGateService.shouldBlockTransition()` enforces correct tier rates, write unit tests, ensure called during PENDING_DEPOSIT -> SOURCING transition
- Anti-fraud: Verify `PaymentVoucherValidator` implements all 4 BLOCK rules + FLAG rule, write unit tests, implement any missing rules
- AR aging: Verify customer with AR > 90 days blocked from placing new orders AND delivery halted. Extend blocking logic if incomplete
- COD enforcement: Verify driver with pending COD > 24h blocked from new assignments. Write tests for 24-hour window
- Approval SLA: Verify auto-escalation to next level when approver exceeds SLA. Write tests
- All errors should use Phase 1 DomainException format
- Tier rates: NEW=100%, REGULAR=70%, VIP=50%, STRATEGIC=30%
- AR threshold: 90 days
- COD window: 24 hours

### Claude's Discretion
- Whether existing implementations are correct or need fixes (based on code audit)
- How to structure tests (per-rule vs per-service)
- Whether to add integration tests beyond unit tests
- SLA time values for approval escalation
- How to enforce AR blocking at the delivery level (guard vs service check)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DAT-07 | Deposit gate enforces correct tier-based rates and blocks purchase request if deposit insufficient | `DepositGateService` already implements this correctly. `DEPOSIT_RATE` constant has correct values. `OrderStatusService.changeStatus()` calls `shouldBlockTransition()`. Needs unit tests only. |
| DAT-08 | Anti-fraud checks BLOCK vouchers missing order code, on closed orders, missing docs, or wrong owner; FLAG when total cost > 90% revenue | `PaymentVoucherValidator.validate()` implements all 4 BLOCK rules + FLAG rule. Owner check exists for RECEIPT type. Needs unit tests covering each block/flag scenario. |
| DAT-09 | Auto-block customer when AR aging exceeds 90 days -- prevents new orders and delivery | Order creation blocked via `CreditCheckGuard` (checks `isBlocked`). **GAP: Delivery not blocked** -- `DeliveryDispatchService.assignDriver()` only checks COD block, not customer AR block. `ARAgingCalculatorService.shouldBlockCustomer()` triggers on days90Plus > 0 (effectively 90+ day threshold). |
| DAT-10 | COD enforcement blocks driver from new assignments if COD not submitted within 24 hours | Fully implemented: `CodService.enforceCODReconciliation()` cron + `DeliveryDispatchService.assignDriver()` checks `isCODBlocked`. Uses business hours calculation. Needs unit tests. |
| DAT-11 | Approval escalation auto-escalates to next level when approver exceeds SLA | `ApprovalService.checkOverdueApprovals()` detects overdue and emits `approval.escalated` at 2x threshold. **GAP: Only emits event, does not perform actual escalation action** (reassign to higher role/advance step). `SlaTracker.checkOverdueSteps()` also marks overdue but only emits `approval.step.overdue`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS | ^11.x | Backend framework | Project standard per CLAUDE.md |
| Prisma | ^6.x | ORM for PostgreSQL | Project standard per CLAUDE.md |
| @nestjs/schedule | ^5.x | Cron jobs for SLA/COD checks | Already used by SlaTracker, CodService, SLAMonitorService |
| @nestjs/event-emitter | ^3.x | Event-driven communication | Already used for approval.escalated, customer.blocked events |
| Jest | ^29.7.0 | Unit testing framework | Already configured in jest.config.js with ts-jest |
| @nestjs/testing | ^11.x | NestJS test utilities | Already used in credit-check.guard.spec.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @prisma/client/runtime/library | (bundled) | Decimal type for monetary values | All financial calculations |
| @nestjs/config | (installed) | ConfigService for business thresholds | Access business.config.ts values |

**No new dependencies needed.** All required libraries are already installed.

## Architecture Patterns

### Existing Project Structure (Relevant Files)
```
src/
  common/
    constants/
      customer-tier.enum.ts    # DEPOSIT_RATE constant
    exceptions/
      error-codes.ts           # ErrorCode registry
      domain.exception.ts      # DomainException base class
    services/
      sla-monitor.service.ts   # Order SLA monitoring (not approval SLA)
  modules/
    order/
      domain/
        deposit-gate.service.ts      # DAT-07 target
      guards/
        credit-check.guard.ts        # DAT-09 target (order creation)
        credit-check.guard.spec.ts   # Existing test (reference pattern)
      order-status.service.ts        # Calls deposit gate
    cash/
      domain/
        payment-voucher.validator.ts # DAT-08 target
    accounts-receivable/
      ar-aging-calculator.service.ts # shouldBlockCustomer() logic
      ar-aging-snapshot.service.ts   # processBlockActions() logic
    warehouse-vn/
      domain/
        delivery-dispatch.service.ts # DAT-09 gap (delivery block) + DAT-10 (COD check)
    cod/
      cod.service.ts                 # DAT-10 target (enforcement cron)
    approval/
      approval.service.ts            # DAT-11 target (checkOverdueApprovals)
      domain/
        sla-tracker.ts               # DAT-11 target (checkOverdueSteps)
      listeners/
        approval-sla.listener.ts     # Handles approval.step.overdue event
    notification/
      escalation.service.ts          # General escalation (OVERDUE_AR, COMPLAINT, ORDER_STUCK)
```

### Pattern 1: Domain Service with Guard Enforcement
**What:** Business rules implemented as domain services, enforced via NestJS guards at the controller level.
**When to use:** Request-level blocking (order creation, delivery assignment).
**Example (existing):**
```typescript
// credit-check.guard.ts (existing pattern)
@Injectable()
export class CreditCheckGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Fetch customer, check isBlocked, check overdue debt
    if (customer.isBlocked) {
      throw new ForbiddenException('Customer is blocked');
    }
    return true;
  }
}
```

### Pattern 2: Domain Service with Cron Enforcement
**What:** Periodic business rule checks via `@Cron()` that update database state (e.g., blocking drivers, blocking customers).
**When to use:** Time-based rules that cannot be checked at request time (COD 24h window, approval SLA).
**Example (existing):**
```typescript
// cod.service.ts (existing pattern)
@Cron('0 8 * * *')
async enforceCODReconciliation() {
  // Find overdue COD records
  // Block drivers via updateMany
  // Emit enforcement event
}
```

### Pattern 3: Event-Driven Notification
**What:** Business rule violations emit events, listeners send notifications/escalations.
**When to use:** When a rule violation needs to notify specific roles without blocking the main flow.
**Example (existing):**
```typescript
// approval.service.ts (existing pattern)
this.eventEmitter.emit('approval.escalated', {
  approvalId: approval.id,
  type: approval.type,
  currentStepRole: currentStep?.approverRole,
});
```

### Pattern 4: Unit Test with Mock Dependencies
**What:** Test domain services in isolation using Jest mocks for PrismaService and other dependencies.
**When to use:** All unit tests in this phase. Follow credit-check.guard.spec.ts pattern.
**Example (existing):**
```typescript
// credit-check.guard.spec.ts (existing pattern)
const module: TestingModule = await Test.createTestingModule({
  providers: [
    CreditCheckGuard,
    { provide: PrismaService, useValue: { customer: { findUnique: jest.fn() } } },
    { provide: AccountsReceivableService, useValue: { getOverdueDebt: jest.fn() } },
    { provide: Reflector, useValue: { get: jest.fn() } },
  ],
}).compile();
```

### Anti-Patterns to Avoid
- **Don't create new guard for delivery AR block:** Instead, add the check inline in `DeliveryDispatchService.assignDriver()` similar to how COD check is already done (fetch customer, check `isBlocked`).
- **Don't duplicate escalation logic:** The `ApprovalService.checkOverdueApprovals()` and `SlaTracker.checkOverdueSteps()` both run cron jobs. Consolidate escalation action in one place.
- **Don't use DomainException in cron jobs:** Cron jobs should log + emit events, not throw exceptions. Only request-handling code should throw.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deposit rate lookup | Custom tier-rate mapping | `DEPOSIT_RATE` constant from `@common/constants` | Already defined, single source of truth |
| Business threshold values | Hardcoded numbers | `ConfigService.get('business.xxx')` | Already configurable via env vars |
| Cron scheduling | Custom timer/interval | `@nestjs/schedule` `@Cron()` | Already used throughout project |
| Event emission | Direct service calls | `EventEmitter2` | Established pattern, decoupled |
| Business hours calculation | Custom date math | `calculateBusinessHoursDeadline` from `@common/utils/business-hours` | Already used in COD enforcement |

## Common Pitfalls

### Pitfall 1: CreditCheckGuard vs AR Aging Threshold Mismatch
**What goes wrong:** The `CreditCheckGuard` uses `OVERDUE_THRESHOLD_DAYS = 15` (hardcoded), but the DAT-09 requirement says 90 days. The `ARAgingCalculatorService.shouldBlockCustomer()` blocks on `days90Plus > 0` (which IS the 90-day threshold). The guard and the calculator use DIFFERENT thresholds.
**Why it happens:** The guard checks `getOverdueDebt().maxOverdueDays > 15` (any overdue > 15 days). The aging calculator blocks on `days90Plus > 0` (90+ days bucket). These are TWO DIFFERENT enforcement paths.
**How to avoid:** The DAT-09 requirement specifically says "AR aging > 90 days". The `ARAgingSnapshotService.processBlockActions()` already sets `customer.isBlocked = true` when `shouldBlock` is true (which fires on 90+ days). The `CreditCheckGuard` then checks `customer.isBlocked`. So the 90-day block works via: cron -> calculator -> snapshot -> block customer -> guard reads isBlocked. The 15-day check in the guard is an ADDITIONAL, more aggressive guard. Both are correct but serve different purposes.
**Warning signs:** Test confusion about whether to test 15-day or 90-day threshold.

### Pitfall 2: Approval Escalation is Notification-Only
**What goes wrong:** Tests pass because `approval.escalated` event is emitted, but no listener actually DOES anything with it (no step reassignment happens).
**Why it happens:** `ApprovalService.checkOverdueApprovals()` emits `approval.escalated` but no listener handles it to advance the step or reassign to a higher role. `ApprovalSlaListener` only handles `approval.step.overdue` (sends notification).
**How to avoid:** Implement an `approval.escalated` event handler that actually performs escalation (e.g., auto-approve current step and create a new step for the next level, or reassign to a higher role based on the approval matrix).
**Warning signs:** `approval.escalated` event emitted but no `@OnEvent('approval.escalated')` handler exists.

### Pitfall 3: Delivery Block Must Check Customer, Not Just Driver
**What goes wrong:** `DeliveryDispatchService.assignDriver()` checks `driver.isCODBlocked` but NOT `customer.isBlocked`. A blocked customer's deliveries can still be dispatched.
**Why it happens:** The COD check was added for DAT-10, but DAT-09's "delivery halted" requirement was not implemented.
**How to avoid:** Add customer `isBlocked` check in `assignDriver()` by looking up the customer through the order relation (already queried in `ordersWithCustomer`).
**Warning signs:** Tests pass for order creation block but delivery assignment succeeds for blocked customer.

### Pitfall 4: Voucher "Wrong Owner" Check Scope
**What goes wrong:** `PaymentVoucherValidator` checks owner for RECEIPT type (line 84-109) but the anti-fraud BLOCK checks are only for PAYMENT type (line 113-121 returns early for non-PAYMENT). The DAT-08 requirement says "wrong owner" is a BLOCK rule.
**Why it happens:** The validator separates RECEIPT ownership (who can create receipts for an order) from PAYMENT anti-fraud (who can create payment vouchers). The PAYMENT type does NOT check `saleId === createdBy` -- it only checks orderId, closed status, attachments, reason, beneficiary, costType.
**How to avoid:** Understand that the "wrong owner" BLOCK rule might already be covered by the RECEIPT check. If the requirement means "payment voucher submitted by someone who is not the sale owner or authorized finance role", a similar check should be added to the PAYMENT flow. Audit the exact requirement wording.
**Warning signs:** Test for "wrong owner blocks payment voucher" fails because the check only exists for RECEIPT type.

### Pitfall 5: Decimal Precision in Financial Comparisons
**What goes wrong:** Using `===` or direct comparison on Prisma Decimal values fails silently.
**Why it happens:** Prisma Decimal is an object, not a primitive number.
**How to avoid:** Always convert with `.toNumber()` before comparison, as the existing code already does. In tests, use `Number()` or `.toNumber()` on mock Decimal values.
**Warning signs:** Tests with `new Decimal(100)` that use `===` instead of `.toNumber()` comparison.

## Code Examples

### Verified Pattern: Unit Test for Domain Service (from credit-check.guard.spec.ts)
```typescript
// Follow this pattern for all Phase 7 tests
describe('DepositGateService', () => {
  let service: DepositGateService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositGateService,
        {
          provide: PrismaService,
          useValue: {
            order: { findUnique: jest.fn() },
          },
        },
      ],
    }).compile();
    service = module.get(DepositGateService);
    prismaService = module.get(PrismaService);
  });

  // Test each tier rate
  it('should block NEW tier customer with < 100% deposit', async () => { ... });
  it('should allow NEW tier customer with 100% deposit', async () => { ... });
  // etc.
});
```

### Verified Pattern: DomainException Usage (from Phase 1)
```typescript
// Use DomainException + ErrorCode for business rule violations
import { DomainException } from '@common/exceptions';
import { ErrorCode } from '@common/exceptions';

throw new DomainException(
  ErrorCode.INSUFFICIENT_DEPOSIT,
  `Cannot proceed to SOURCING: deposit not satisfied`,
  HttpStatus.BAD_REQUEST,
);
```

### Verified Pattern: ConfigService for Business Thresholds
```typescript
// business.config.ts already has all needed config values
const enforcementHours = this.configService.get<number>('business.cod.enforcementHours', 24);
const expenseThreshold = this.configService.get<number>('business.antifraud.expensePercentThreshold', 0.9);
const escalateAfterHours = this.configService.get<number>('business.approval.escalateAfterHours', 24);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw `throw new Error()` | `DomainException` with `ErrorCode` | Phase 1 | All business rule errors must use DomainException |
| Direct service calls for events | `TransactionalEmitter` collector pattern | Phase 3 | Events emitted after transaction commits |
| Manual status checks | FSM `assertTransition()` | Phase 6 | State machine enforces valid transitions |

## Implementation Gap Analysis

### DAT-07: Deposit Gate -- VERIFIED, NEEDS TESTS ONLY
**Status:** Implementation correct.
- `DEPOSIT_RATE` constant: NEW=100, REGULAR=70, VIP=50, STRATEGIC=30 (verified)
- `DepositGateService.shouldBlockTransition()`: Only blocks SOURCING transition for MHH service type
- `DepositGateService.checkDepositRequirement()`: Handles VCT exemption and customer-level override
- `OrderStatusService.changeStatus()`: Calls `this.depositGate.shouldBlockTransition(order, newStatus)` at line 77
- **Gap:** No unit tests exist for DepositGateService

### DAT-08: Anti-Fraud Checks -- VERIFIED, MINOR GAP
**Status:** 4/4 BLOCK rules implemented for PAYMENT type. FLAG rule implemented.
- BLOCK 1: Missing orderId (line 126)
- BLOCK 2: Order is COMPLETED or CANCELLED (line 147)
- BLOCK 3: Missing attachments (line 181)
- BLOCK 4 (Additional): Reason too short, no beneficiary, no cost type (lines 188-201)
- FLAG 1: Cost > 90% revenue (line 170-176)
- **Note on "wrong owner":** The ownership check exists for RECEIPT type only (lines 84-109). For PAYMENT type, there is no explicit `saleId !== createdBy` check. Need to clarify: does the requirement mean "receipt voucher wrong owner" or "payment voucher wrong owner"? Current code blocks receipt creation by non-owner/non-finance -- which is a valid interpretation.
- **Gap:** No unit tests exist for PaymentVoucherValidator

### DAT-09: AR Aging Auto-Block -- PARTIAL GAP
**Status:** Order creation block works. Delivery block MISSING.
- Auto-block mechanism: `ARAgingCalculatorService.shouldBlockCustomer()` -> `ARAgingSnapshotService.processBlockActions()` -> sets `customer.isBlocked = true` (daily cron)
- Order creation block: `CreditCheckGuard` checks `customer.isBlocked` (verified)
- **GAP: Delivery block missing.** `DeliveryDispatchService.assignDriver()` does NOT check `customer.isBlocked`. It fetches `ordersWithCustomer` (line 159-177) and accesses `customer.creditLimit/currentDebt` but does not check `isBlocked`.
- Fix needed: Add `customer.isBlocked` check in `assignDriver()` method, after the existing customer data fetch
- **Gap:** No unit tests for the 90-day block specifically (existing credit-check.guard.spec.ts tests use 15-day threshold)

### DAT-10: COD Enforcement -- FULLY IMPLEMENTED, NEEDS TESTS
**Status:** Complete implementation.
- Blocking: `CodService.enforceCODReconciliation()` cron (daily 08:00) sets `driver.isCODBlocked = true`
- Enforcement: `DeliveryDispatchService.assignDriver()` checks `driver.isCODBlocked` (line 146)
- Business hours: Uses `calculateBusinessHoursDeadline()` for accurate 24h calculation
- Unblocking: Not explicitly implemented (manual DB update assumed)
- **Gap:** No unit tests exist for CodService.enforceCODReconciliation or the driver block check

### DAT-11: Approval SLA Escalation -- SIGNIFICANT GAP
**Status:** Detection works. Actual escalation action MISSING.
- Detection 1: `SlaTracker.checkOverdueSteps()` (every 30min) - marks steps as `isOverdue`, emits `approval.step.overdue`
- Detection 2: `ApprovalService.checkOverdueApprovals()` (every hour) - uses `escalateAfterHours` config (default 24h), marks overdue, emits `approval.overdue` and `approval.escalated` (at 2x threshold)
- Notification: `ApprovalSlaListener` handles `approval.step.overdue` -> sends notification
- **GAP: `approval.escalated` event has NO handler.** It is emitted but nobody listens. The actual "move to next level" action does not happen.
- Fix needed: Create a listener for `approval.escalated` that either: (a) auto-advances the current step and creates a new step for a higher role, or (b) reassigns the current step to a higher role based on the approval matrix
- SLA values from business process doc: Leader approval 2h, KT TT 2h, GD KD 4h, BGD 4-8h
- **Gap:** No unit tests for either SlaTracker or ApprovalService.checkOverdueApprovals

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest 29.4.6 |
| Config file | `tbs-erp-backend/jest.config.js` |
| Quick run command | `cd tbs-erp-backend && npx jest --testPathPattern=<file> --no-coverage` |
| Full suite command | `cd tbs-erp-backend && npx jest --no-coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DAT-07 | NEW tier with <100% deposit is blocked | unit | `cd tbs-erp-backend && npx jest --testPathPattern=deposit-gate.service.spec.ts --no-coverage` | Wave 0 |
| DAT-07 | REGULAR tier with <70% deposit is blocked | unit | (same file) | Wave 0 |
| DAT-07 | VIP tier with <50% deposit is blocked | unit | (same file) | Wave 0 |
| DAT-07 | STRATEGIC tier with <30% deposit is blocked | unit | (same file) | Wave 0 |
| DAT-07 | VCT service type skips deposit check | unit | (same file) | Wave 0 |
| DAT-08 | Voucher missing orderId is blocked | unit | `cd tbs-erp-backend && npx jest --testPathPattern=payment-voucher.validator.spec.ts --no-coverage` | Wave 0 |
| DAT-08 | Voucher on closed order is blocked | unit | (same file) | Wave 0 |
| DAT-08 | Voucher missing attachments is blocked | unit | (same file) | Wave 0 |
| DAT-08 | Voucher by wrong owner is blocked (RECEIPT) | unit | (same file) | Wave 0 |
| DAT-08 | Cost > 90% revenue is flagged | unit | (same file) | Wave 0 |
| DAT-09 | Customer with AR >90d cannot place order | unit | `cd tbs-erp-backend && npx jest --testPathPattern=credit-check.guard.spec.ts --no-coverage` | Exists (partial) |
| DAT-09 | Delivery halted for blocked customer | unit | `cd tbs-erp-backend && npx jest --testPathPattern=delivery-dispatch.service.spec.ts --no-coverage` | Wave 0 |
| DAT-10 | Driver with pending COD >24h blocked | unit | `cd tbs-erp-backend && npx jest --testPathPattern=cod.service.spec.ts --no-coverage` | Wave 0 |
| DAT-10 | Driver block check in delivery assignment | unit | (delivery-dispatch.service.spec.ts) | Wave 0 |
| DAT-11 | Approval exceeding SLA auto-escalates | unit | `cd tbs-erp-backend && npx jest --testPathPattern=approval.service.spec.ts --no-coverage` | Wave 0 |
| DAT-11 | SLA tracker marks overdue steps | unit | `cd tbs-erp-backend && npx jest --testPathPattern=sla-tracker.spec.ts --no-coverage` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd tbs-erp-backend && npx jest --testPathPattern=<modified-spec> --no-coverage`
- **Per wave merge:** `cd tbs-erp-backend && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/modules/order/domain/deposit-gate.service.spec.ts` -- covers DAT-07
- [ ] `src/modules/cash/domain/payment-voucher.validator.spec.ts` -- covers DAT-08
- [ ] `src/modules/warehouse-vn/domain/delivery-dispatch.service.spec.ts` -- covers DAT-09 delivery block + DAT-10 COD block
- [ ] `src/modules/cod/cod.service.spec.ts` -- covers DAT-10 enforcement cron
- [ ] `src/modules/approval/approval.service.spec.ts` -- covers DAT-11 overdue detection + escalation
- [ ] `src/modules/approval/domain/sla-tracker.spec.ts` -- covers DAT-11 step overdue marking

## Open Questions

1. **"Wrong Owner" BLOCK rule scope for DAT-08**
   - What we know: Owner check exists for RECEIPT vouchers (non-owner/non-finance blocked). PAYMENT vouchers have no owner check.
   - What's unclear: Does DAT-08 require owner check on PAYMENT type too? The requirement says "wrong owner" without specifying voucher type.
   - Recommendation: The existing RECEIPT owner check satisfies the requirement. The PAYMENT flow's existing checks (orderId, closed order, attachments, reason) provide sufficient anti-fraud coverage. No change needed unless explicitly requested.

2. **Approval escalation "next level" mechanics**
   - What we know: The approval matrix defines escalation paths (Leader -> GD KD -> BGD). The `ApprovalService` emits `approval.escalated` but no handler acts on it.
   - What's unclear: Should escalation (a) auto-approve and create new step for higher role, (b) reassign current step to higher role, or (c) add an additional step?
   - Recommendation: Option (b) -- reassign current step to the escalation target role. This is the simplest approach that matches the business doc's "auto-escalate to next level" language. Use the existing `ApprovalService.delegateStep()` pattern.

3. **COD unblocking mechanism**
   - What we know: `CodService.enforceCODReconciliation()` blocks drivers. No explicit unblock logic exists.
   - What's unclear: When/how are drivers unblocked after submitting COD?
   - Recommendation: Add unblock logic in `CodService.confirmRemittance()` -- when a driver remits all collected COD, set `isCODBlocked = false`. This is a natural enforcement point and aligns with the business process.

## Sources

### Primary (HIGH confidence)
- `tbs-erp-backend/src/modules/order/domain/deposit-gate.service.ts` -- Deposit gate implementation verified
- `tbs-erp-backend/src/common/constants/customer-tier.enum.ts` -- DEPOSIT_RATE constant verified: NEW=100, REGULAR=70, VIP=50, STRATEGIC=30
- `tbs-erp-backend/src/modules/cash/domain/payment-voucher.validator.ts` -- All 4 BLOCK + FLAG rules verified
- `tbs-erp-backend/src/modules/order/guards/credit-check.guard.ts` -- Customer block check verified
- `tbs-erp-backend/src/modules/warehouse-vn/domain/delivery-dispatch.service.ts` -- COD block verified, AR block gap identified
- `tbs-erp-backend/src/modules/cod/cod.service.ts` -- COD enforcement cron verified
- `tbs-erp-backend/src/modules/approval/approval.service.ts` -- Escalation detection verified, action gap identified
- `tbs-erp-backend/src/modules/approval/domain/sla-tracker.ts` -- Step overdue tracking verified
- `tbs-erp-backend/src/config/business.config.ts` -- All threshold values verified
- `docs/TBS_QuyTrinh_NghiepVu_DayDu.md` -- Approval matrix and SLA table (Phan 5 & 6)

### Secondary (MEDIUM confidence)
- `tbs-erp-backend/src/modules/order/guards/credit-check.guard.spec.ts` -- Test pattern reference
- `tbs-erp-backend/jest.config.js` -- Test framework configuration

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- all patterns are established in the codebase, directly verified by reading source
- Pitfalls: HIGH -- identified from direct code audit, not speculation

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain, no fast-moving dependencies)
