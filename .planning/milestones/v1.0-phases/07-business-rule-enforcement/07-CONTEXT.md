# Phase 7: Business Rule Enforcement - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden 5 domain-specific financial and operational safeguards: deposit gate enforcement (tier-based rates), anti-fraud voucher checks, AR aging auto-block, COD enforcement, and approval SLA escalation. This phase verifies and strengthens existing implementations — most business rule code already exists but needs hardening, testing, and gap closure.

</domain>

<decisions>
## Implementation Decisions

### Deposit Gate (DAT-07)
- `DepositGateService` already exists with `shouldBlockTransition()` — verify it enforces correct tier rates: NEW=100%, REGULAR=70%, VIP=50%, STRATEGIC=30%
- If rates are incorrect or hardcoded wrong, fix them
- Write unit tests verifying each tier blocks purchase requests with insufficient deposit
- Ensure deposit gate is called during order status transitions at the right point (PENDING_DEPOSIT → SOURCING)
- Claude has discretion on whether the existing implementation is correct or needs fixes

### Anti-Fraud Checks (DAT-08)
- `PaymentVoucherValidator` already exists — verify it implements all 4 BLOCK rules:
  1. Voucher missing order code
  2. Voucher referencing closed order
  3. Voucher missing required documents
  4. Voucher submitted by wrong owner
- Verify it implements FLAG rule: total cost > 90% revenue
- Write unit tests for each block/flag scenario
- If any rule is missing, implement it
- Claude has discretion on implementation details

### AR Aging Auto-Block (DAT-09)
- `CreditCheckGuard` and `AccountsReceivableService` already have aging logic
- Verify: customer with AR > 90 days is blocked from placing new orders
- Verify: delivery is halted for existing orders of blocked customers
- Write tests verifying the block triggers at 90-day threshold
- If blocking logic is incomplete (e.g., only checks on order creation but not delivery), extend it
- Claude has discretion on where to enforce (guard vs service vs both)

### COD Enforcement (DAT-10)
- `DeliveryDispatchService` exists with delivery-related logic
- Verify: driver with pending COD (not submitted within 24 hours) is blocked from new assignments
- If COD tracking/blocking is incomplete, implement the check
- Write tests for the 24-hour COD submission window
- Claude has discretion on implementation approach

### Approval SLA Escalation (DAT-11)
- `EscalationService`, `SlaTracker`, and `ApprovalAnalyticsService` already exist
- Verify: when an approver exceeds the SLA time limit, the request auto-escalates to the next level
- The approval matrix defines SLA per type/level (from business process doc)
- Write tests verifying escalation triggers correctly
- If escalation logic is incomplete, implement the missing parts
- Claude has discretion on SLA values and escalation mechanism

### Claude's Discretion
- Whether existing implementations are correct or need fixes (based on code audit)
- How to structure tests (per-rule vs per-service)
- Whether to add integration tests beyond unit tests
- SLA time values for approval escalation
- How to enforce AR blocking at the delivery level (guard vs service check)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Deposit gate
- `tbs-erp-backend/src/modules/order/domain/deposit-gate.service.ts` — Deposit gate enforcement logic
- `tbs-erp-backend/src/modules/order/order-status.service.ts` — Order status transitions calling deposit gate
- `tbs-erp-backend/src/config/business.config.ts` — Business config with tier rates

### Anti-fraud
- `tbs-erp-backend/src/modules/cash/domain/payment-voucher.validator.ts` — Voucher validation rules
- `tbs-erp-backend/src/modules/cash/cash.service.ts` — Cash service using validator

### AR aging
- `tbs-erp-backend/src/modules/accounts-receivable/accounts-receivable.service.ts` — AR aging calculations
- `tbs-erp-backend/src/modules/accounts-receivable/ar-aging-snapshot.service.ts` — AR snapshot service
- `tbs-erp-backend/src/modules/order/guards/credit-check.guard.ts` — Credit check guard on order creation

### COD
- `tbs-erp-backend/src/modules/warehouse-vn/domain/delivery-dispatch.service.ts` — Delivery dispatch logic
- `tbs-erp-backend/src/modules/cod/cod.controller.ts` — COD endpoints

### Approval escalation
- `tbs-erp-backend/src/modules/notification/escalation.service.ts` — Escalation service
- `tbs-erp-backend/src/modules/approval/domain/sla-tracker.ts` — SLA tracking
- `tbs-erp-backend/src/modules/approval/approval.service.ts` — Approval service
- `tbs-erp-backend/src/common/services/sla-monitor.service.ts` — SLA monitor

### Business process reference
- `docs/TBS_QuyTrinh_NghiepVu_DayDu.md` — Full business process (approval matrix, SLA table, COD rules)

### Error infrastructure (Phase 1)
- `tbs-erp-backend/src/common/exceptions/error-codes.ts` — ErrorCode registry
- `tbs-erp-backend/src/common/exceptions/domain.exception.ts` — DomainException base

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DepositGateService`: Already has `shouldBlockTransition()` — needs verification and tests
- `PaymentVoucherValidator`: Already has validation rules — needs audit for completeness
- `CreditCheckGuard`: Already checks AR on order creation — may need extension to delivery
- `DeliveryDispatchService`: Delivery logic exists — COD check may need to be added
- `EscalationService` + `SlaTracker`: Escalation infrastructure exists — needs verification
- `DomainException` + `ErrorCode`: Phase 1 infrastructure for business rule errors

### Established Patterns
- Business rules as domain services in `domain/` directories
- Guards for request-level checks (`CreditCheckGuard`)
- Validators for domain-specific validation (`PaymentVoucherValidator`)
- Cron/scheduled jobs for periodic checks (`SlaMonitorService`)
- `business.config.ts` for configurable thresholds

### Integration Points
- Order status transitions: deposit gate enforcement point
- Cash voucher approval: anti-fraud check point
- Order creation: AR aging block point
- Delivery assignment: COD enforcement point
- Approval creation: SLA escalation trigger point

</code_context>

<specifics>
## Specific Ideas

- User delegated all decisions to Claude
- Most business rule code already exists — focus on verification, gap closure, and tests
- Tier rates from requirement: NEW=100%, REGULAR=70%, VIP=50%, STRATEGIC=30%
- AR threshold: 90 days
- COD window: 24 hours
- All errors should use Phase 1 DomainException format

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-business-rule-enforcement*
*Context gathered: 2026-03-19*
