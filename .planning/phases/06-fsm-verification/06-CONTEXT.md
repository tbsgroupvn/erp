# Phase 6: FSM Verification - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Write comprehensive negative-path tests for all 9 FSMs (every invalid transition must be rejected) and full lifecycle integration tests for order and container flows. This phase does NOT modify FSM logic, change transition rules, or add new states.

</domain>

<decisions>
## Implementation Decisions

### Test Coverage Scope
- Write negative-path unit tests for ALL 9 FSMs — each FSM gets a spec file testing every invalid transition
- The 9 FSMs: Order, Supplier Order, Container, Quotation, Complaint, Voucher (cash), Warehouse CN, Warehouse VN, Customs Declaration
- Each test matrix: for every state, test transitions to ALL invalid target states — assert they throw
- Use the existing `BaseStatusMachine` pattern — all 9 FSMs extend it
- Existing `order-status.machine.spec.ts` and `base-status-machine.spec.ts` serve as reference patterns
- Claude has discretion on test organization (one spec per FSM vs grouped)

### Lifecycle Integration Tests
- Order lifecycle test: drive an order from CONSULTING → QUOTATION → PENDING_DEPOSIT → SOURCING → WAREHOUSE_CN → PACKING → CONSOLIDATION → IN_TRANSIT → CUSTOMS → WAREHOUSE_VN → DELIVERING → SETTLEMENT → COMPLETED
- Verify deposit gate enforcement at PENDING_DEPOSIT stage (tier-based rates: NEW=100%, REGULAR=70%, VIP=50%, STRATEGIC=30%)
- Container lifecycle test: drive a container from PLANNING → LOADING → IN_TRANSIT → ARRIVED → CUSTOMS → COMPLETED with package assignment and customs hold scenarios
- Tests operate at the service layer (not HTTP) — call service methods directly with mocked Prisma and EventEmitter
- Use Jest with mocked dependencies — NOT real database connections (too slow, too complex for unit/integration tests at this stage)
- Claude has discretion on mock structure (manual mocks vs jest.mock vs testing module)

### Test Organization
- FSM negative-path tests: one spec file per FSM in `src/modules/{module}/domain/{fsm}.spec.ts`
- Lifecycle tests: `test/integration/order-flow.integration.spec.ts` and `test/integration/container-flow.integration.spec.ts`
- Both existing integration test files may need updating or can serve as reference patterns
- Claude has discretion on whether to extend existing test files or create new ones

### Claude's Discretion
- Test organization (per-FSM spec vs grouped)
- Mock strategy (manual mocks vs jest.mock vs NestJS testing module)
- Level of detail in lifecycle tests (every sub-step vs key milestones)
- Whether to use existing test files as base or create fresh
- How to mock deposit gate in order lifecycle test

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### FSM implementations
- `tbs-erp-backend/src/common/domain/base-status-machine.ts` — BaseStatusMachine base class (all 9 extend this)
- `tbs-erp-backend/src/modules/order/domain/order-status.machine.ts` — Order FSM with service-type-specific rules
- `tbs-erp-backend/src/modules/supplier-order/domain/supplier-order-status.machine.ts` — Supplier order FSM
- `tbs-erp-backend/src/modules/container/domain/container-status.machine.ts` — Container FSM
- `tbs-erp-backend/src/modules/quotation/domain/quotation-status.machine.ts` — Quotation FSM
- `tbs-erp-backend/src/modules/complaint/domain/complaint-status.machine.ts` — Complaint FSM
- `tbs-erp-backend/src/modules/cash/domain/voucher-status.machine.ts` — Voucher FSM
- `tbs-erp-backend/src/modules/warehouse-cn/domain/warehouse-cn-status.machine.ts` — Warehouse CN FSM
- `tbs-erp-backend/src/modules/warehouse-vn/domain/warehouse-vn-status.machine.ts` — Warehouse VN FSM
- `tbs-erp-backend/src/modules/customs-declaration/domain/customs-status.machine.ts` — Customs FSM

### Existing test patterns
- `tbs-erp-backend/src/modules/order/domain/order-status.machine.spec.ts` — Existing order FSM test (reference pattern)
- `tbs-erp-backend/src/common/domain/base-status-machine.spec.ts` — Base FSM test

### Transition maps
- `tbs-erp-backend/src/common/constants/order-status.enum.ts` — Order status transitions, valid transition map
- CLAUDE.md — 9 FSM transition tables

### Deposit gate
- `tbs-erp-backend/src/modules/order/domain/deposit-gate.service.ts` — Deposit gate enforcement logic

### Business process
- `docs/TBS_QuyTrinh_NghiepVu_DayDu.md` — Full business process (13 stages, approval matrix)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BaseStatusMachine`: Generic base class with `validateTransition()`, `getNextStatuses()`, `isTerminal()` — all 9 FSMs extend this
- `order-status.machine.spec.ts`: Existing test with positive + negative transition tests — reference pattern for other FSMs
- `base-status-machine.spec.ts`: Tests base class behavior with mock FSM
- `DomainException` + `ErrorCode`: Phase 1 error infrastructure for FSM transition failures

### Established Patterns
- FSM location: `src/modules/{module}/domain/{name}-status.machine.ts`
- Test location: `src/modules/{module}/domain/{name}-status.machine.spec.ts`
- Transition validation: `machine.validateTransition(from, to)` returns boolean
- Transition execution: `machine.transition(from, to)` throws on invalid

### Integration Points
- Order status service: `order-status.service.ts` uses `OrderStatusMachine`
- Container service: `container.service.ts` uses `ContainerStatusMachine`
- Deposit gate: `deposit-gate.service.ts` checks tier-based deposit requirements

</code_context>

<specifics>
## Specific Ideas

- User delegated all decisions to Claude
- All 9 FSMs from CLAUDE.md must have negative-path tests
- Order lifecycle must verify deposit gate at PENDING_DEPOSIT
- Container lifecycle must verify package assignment and customs holds
- Mock-based tests (no real DB) for speed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-fsm-verification*
*Context gathered: 2026-03-19*
