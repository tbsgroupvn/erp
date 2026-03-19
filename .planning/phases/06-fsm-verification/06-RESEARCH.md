# Phase 6: FSM Verification - Research

**Researched:** 2026-03-19
**Domain:** Finite State Machine negative-path testing & lifecycle integration testing
**Confidence:** HIGH

## Summary

Phase 6 focuses on verifying that all 9 FSMs reject every invalid transition (negative-path tests) and that the complete order and container lifecycles work end-to-end through the service layer. Research reveals a critical finding: **all 9 FSM spec files already exist with comprehensive negative-path test coverage.** The existing tests already cover happy-path, invalid transitions (backward jumps, skips, self-transitions), terminal state blocking, and exhaustive transition matrices.

The remaining gap is the lifecycle integration tests. The existing `order-flow.integration.spec.ts` is a skeleton HTTP-level test (supertest-based) that does not test the FSM-through-service-layer flow as required. New service-layer integration tests are needed for both the order lifecycle (CONSULTING to COMPLETED with deposit gate) and the container lifecycle (PLANNING to COMPLETED with package assignment and customs holds).

**Primary recommendation:** Focus effort on two new service-layer integration test files with mocked Prisma and EventEmitter. The existing 9 FSM spec files should be audited for completeness against the "every invalid transition" requirement and enhanced only if gaps are found. For most FSMs, the existing coverage already meets or exceeds DAT-03 requirements.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Write negative-path unit tests for ALL 9 FSMs -- each FSM gets a spec file testing every invalid transition
- The 9 FSMs: Order, Supplier Order, Container, Quotation, Complaint, Voucher (cash), Warehouse CN, Warehouse VN, Customs Declaration
- Each test matrix: for every state, test transitions to ALL invalid target states -- assert they throw
- Use the existing `BaseStatusMachine` pattern -- all 9 FSMs extend it
- Existing `order-status.machine.spec.ts` and `base-status-machine.spec.ts` serve as reference patterns
- Order lifecycle test: drive an order from CONSULTING through COMPLETED with deposit gate enforcement
- Verify deposit gate enforcement at PENDING_DEPOSIT stage (tier-based rates: NEW=100%, REGULAR=70%, VIP=50%, STRATEGIC=30%)
- Container lifecycle test: drive a container from PLANNING to COMPLETED with package assignment and customs hold scenarios
- Tests operate at the service layer (not HTTP) -- call service methods directly with mocked Prisma and EventEmitter
- Use Jest with mocked dependencies -- NOT real database connections

### Claude's Discretion
- Test organization (per-FSM spec vs grouped)
- Mock strategy (manual mocks vs jest.mock vs NestJS testing module)
- Level of detail in lifecycle tests (every sub-step vs key milestones)
- Whether to use existing test files as base or create fresh
- How to mock deposit gate in order lifecycle test

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DAT-03 | Each of the 9 FSMs has negative-path tests verifying that every invalid transition is rejected | All 9 FSM spec files already exist with extensive negative-path tests. Audit needed for exhaustive coverage (every state x every invalid target). Some FSMs already have exhaustive matrix tests (Complaint, Voucher). Others test representative samples and need the exhaustive matrix added. |
| DAT-04 | Integration test exercises full order lifecycle from CONSULTING to COMPLETED, verifying deposit gate enforcement | Existing `order-flow.integration.spec.ts` is HTTP-based skeleton, not service-layer. New service-layer integration test needed that calls `OrderStatusService.changeStatus()` through all 13 lifecycle stages with mocked Prisma, mocked DepositGateService, and EventEmitter. |
| DAT-05 | Integration test exercises full container lifecycle from PLANNING to COMPLETED | No existing container lifecycle integration test. New service-layer test needed that calls `ContainerService.updateStatus()` through all stages, including `addPackages()` for package assignment and ON_HOLD_BORDER/CUSTOMS_HOLD scenarios. |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jest | 29.x | Test runner & assertions | Already configured in project, NestJS default |
| ts-jest | 29.x | TypeScript compilation for Jest | Already configured in jest.config.js |
| @nestjs/testing | 11.x | NestJS Test module for DI mocking | Already a project dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @prisma/client | existing | Prisma enum types (OrderStatus, ContainerStatus, etc.) | Import status enums for test assertions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual mocks | jest.mock() auto-mocking | Manual mocks are clearer for service-layer tests where we need fine-grained control over return values per call |
| NestJS TestingModule | Direct instantiation | TestingModule adds DI overhead; for pure FSM tests, direct `new Machine()` is simpler. For service-layer integration tests, TestingModule is appropriate. |

**Installation:**
No new packages needed. All testing dependencies already in place.

## Architecture Patterns

### Existing FSM Test Pattern (Reference)
```
src/modules/{module}/domain/
  {name}-status.machine.ts       # FSM implementation
  {name}-status.machine.spec.ts  # FSM unit tests
```

### Lifecycle Integration Test Location
```
test/integration/
  order-lifecycle.integration.spec.ts      # Order FSM + service layer
  container-lifecycle.integration.spec.ts  # Container FSM + service layer
```

### Pattern 1: Exhaustive Negative-Path Matrix
**What:** For each state in the FSM, test transitions to ALL other states that are NOT in the valid transition list.
**When to use:** DAT-03 requires "every invalid transition is rejected."
**Example (already in codebase -- Complaint FSM):**
```typescript
// Source: complaint-status.machine.spec.ts (existing)
describe('exhaustive transition matrix', () => {
  const validPairs: [ComplaintStatus, ComplaintStatus][] = [
    [ComplaintStatus.OPEN, ComplaintStatus.INVESTIGATING],
    [ComplaintStatus.INVESTIGATING, ComplaintStatus.PENDING_RESOLUTION],
    [ComplaintStatus.INVESTIGATING, ComplaintStatus.RESOLVED],
    [ComplaintStatus.PENDING_RESOLUTION, ComplaintStatus.RESOLVED],
    [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED],
  ];

  const allStatuses = Object.values(ComplaintStatus);

  it('should have exactly 5 valid transitions in the entire FSM', () => {
    let validCount = 0;
    for (const from of allStatuses) {
      for (const to of allStatuses) {
        if (machine.validateTransition(from, to)) {
          validCount++;
        }
      }
    }
    expect(validCount).toBe(validPairs.length);
  });
});
```

### Pattern 2: Service-Layer Integration Test with Mocked Dependencies
**What:** Test the service method (e.g., `OrderStatusService.changeStatus()`) with mocked Prisma and EventEmitter to verify FSM enforcement at the service layer.
**When to use:** DAT-04 and DAT-05 require lifecycle tests through the service layer.
**Example:**
```typescript
// Recommended pattern for order lifecycle integration test
describe('Order Lifecycle Integration', () => {
  let service: OrderStatusService;
  let mockPrisma: DeepMockProxy<PrismaService>;
  let mockOrderRepo: jest.Mocked<OrderRepository>;
  let statusMachine: OrderStatusMachine;
  let depositGate: DepositGateService;

  beforeEach(async () => {
    statusMachine = new OrderStatusMachine();
    // ... set up mocks
  });

  it('should drive order from CONSULTING to COMPLETED', async () => {
    const lifecycle = [
      OrderStatus.CONSULTING,
      OrderStatus.QUOTATION,
      OrderStatus.PENDING_DEPOSIT,
      OrderStatus.SOURCING,
      // ... through to COMPLETED
    ];

    for (let i = 0; i < lifecycle.length - 1; i++) {
      mockOrderRepo.findById.mockResolvedValueOnce(
        createMockOrder({ status: lifecycle[i] }),
      );
      // ... mock other dependencies
      await service.changeStatus(orderId, lifecycle[i + 1], userId);
    }
  });
});
```

### Anti-Patterns to Avoid
- **Testing FSM through HTTP layer:** The CONTEXT.md explicitly says "Tests operate at the service layer (not HTTP)." The existing `order-flow.integration.spec.ts` uses supertest -- this is NOT the pattern to follow.
- **Real DB in unit tests:** Mock Prisma, do not connect to a real database. Tests must run fast and without infrastructure.
- **Testing only forward transitions:** Must also test ALL backward, skip, and self transitions -- not just representative samples.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FSM validation | Custom transition checker | `BaseStatusMachine.validateTransition()` / `assertTransition()` | Already tested in base class, all 9 FSMs extend it |
| Exhaustive matrix test | Manual listing of every invalid pair | Computed from `Object.values(Enum)` minus valid transitions | Handles enum changes automatically, no manual maintenance |
| Prisma mock | Manual object stubs | jest.fn() with mockResolvedValue | Fine-grained control per test, clear expectations |

## Common Pitfalls

### Pitfall 1: Incomplete Exhaustive Coverage
**What goes wrong:** Testing only "representative" invalid transitions (e.g., a few backward jumps) instead of every invalid pair.
**Why it happens:** Combinatorial explosion -- an FSM with 17 states has 17x16=272 possible transitions; if ~50 are valid, ~222 are invalid.
**How to avoid:** Use the Complaint FSM pattern: enumerate valid pairs, then assert `validCount === validPairs.length` across the full matrix. This implicitly proves all other transitions are invalid.
**Warning signs:** Test file lists individual invalid transitions instead of using computed matrix.

### Pitfall 2: Order FSM Special Cases
**What goes wrong:** Missing the OrderStatusMachine's unique behavior -- it overrides `validateTransition()` with service-type-specific logic (MHH deposit gate) and has a special COMPLETED->SETTLEMENT reopen rule.
**Why it happens:** OrderStatusMachine delegates to `@common/constants` TRANSITION_MAP instead of using the base class's transition map.
**How to avoid:** Test OrderStatusMachine exhaustive matrix WITH and WITHOUT serviceType parameter. The existing spec already tests MHH-specific behavior -- verify it's comprehensive.
**Warning signs:** Tests pass for Order FSM but don't exercise the `serviceType` override paths.

### Pitfall 3: Voucher FSM Uses ApprovalStatus Enum (Not Custom)
**What goes wrong:** Looking for `VoucherStatus` in Prisma when the actual enum is `ApprovalStatus`.
**Why it happens:** The voucher FSM reuses `ApprovalStatus` from Prisma, which has 6 values: PENDING, APPROVED, REJECTED, CANCELLED, RETURNED, WITHDRAWN.
**How to avoid:** Read the actual FSM implementation. The existing spec already handles this correctly.

### Pitfall 4: TRANSITION_MAP vs OrderStatusMachine Discrepancy
**What goes wrong:** The `TRANSITION_MAP` in `order-status.enum.ts` shows `COMPLETED: [SETTLEMENT]` (allowing reopen), but `OrderStatusMachine.validateTransition()` blocks terminal statuses except `COMPLETED->SETTLEMENT`. This means the FSM has intentional divergence from the raw map.
**Why it happens:** The machine's override adds business logic on top of the raw map.
**How to avoid:** Test against the machine's behavior, not the raw map. The existing tests already verify COMPLETED->SETTLEMENT returns `true` for the reopen case.

### Pitfall 5: Integration Test Mock Complexity
**What goes wrong:** Mocking too many or too few dependencies for service-layer tests.
**Why it happens:** `OrderStatusService.changeStatus()` has 7 dependencies (orderRepo, prisma, statusMachine, depositGate, eventEmitter, txEmitter, cacheService).
**How to avoid:** Use the real `OrderStatusMachine` (it has no external dependencies) and mock everything else. The FSM machine is the thing being tested indirectly through the service.

### Pitfall 6: Exhaustive Matrix for Order FSM is Large
**What goes wrong:** Order FSM has 17 statuses = 17x16 = 272 transitions. The exhaustive matrix is large.
**Why it happens:** Order has special statuses (ON_HOLD, ISSUE, RETURNED) that can transition to many targets.
**How to avoid:** Use the same pattern as Complaint: count total valid transitions and assert the count. Don't enumerate all 222+ invalid transitions individually.

## Code Examples

### Example 1: Exhaustive Matrix Test (Recommended Pattern)
```typescript
// Apply to all 9 FSMs. This is the KEY pattern for DAT-03.
describe('exhaustive transition matrix', () => {
  const allStatuses = Object.values(SomeStatus);

  // Define ALL valid transitions explicitly
  const validPairs: [SomeStatus, SomeStatus][] = [
    // List every valid (from, to) pair from the transition map
  ];

  it(`should have exactly ${validPairs.length} valid transitions`, () => {
    let validCount = 0;
    for (const from of allStatuses) {
      for (const to of allStatuses) {
        if (machine.validateTransition(from, to)) {
          validCount++;
        }
      }
    }
    expect(validCount).toBe(validPairs.length);
  });

  // Also assert EVERY invalid pair throws via assertTransition
  it('should throw for every invalid transition', () => {
    for (const from of allStatuses) {
      for (const to of allStatuses) {
        if (!machine.validateTransition(from, to)) {
          expect(() => machine.assertTransition(from, to)).toThrow(BadRequestException);
        }
      }
    }
  });
});
```

### Example 2: Service-Layer Order Lifecycle Test
```typescript
// Source: Pattern for test/integration/order-lifecycle.integration.spec.ts
describe('Order Lifecycle - CONSULTING to COMPLETED', () => {
  it('should drive through all 13 statuses', async () => {
    const ORDER_LIFECYCLE = [
      OrderStatus.CONSULTING, OrderStatus.QUOTATION,
      OrderStatus.PENDING_DEPOSIT, OrderStatus.SOURCING,
      OrderStatus.WAREHOUSE_CN, OrderStatus.PACKING,
      OrderStatus.CONSOLIDATION, OrderStatus.IN_TRANSIT,
      OrderStatus.CUSTOMS, OrderStatus.WAREHOUSE_VN,
      OrderStatus.DELIVERING, OrderStatus.SETTLEMENT,
      OrderStatus.COMPLETED,
    ];

    for (let i = 0; i < ORDER_LIFECYCLE.length - 1; i++) {
      const from = ORDER_LIFECYCLE[i];
      const to = ORDER_LIFECYCLE[i + 1];

      // Set up mock order at current status
      mockOrderRepo.findById.mockResolvedValueOnce(
        createMockOrder({
          status: from,
          serviceType: ServiceType.MHH,
          depositPaid: 10_000_000,
          depositRequired: 10_000_000,
          isDepositPaid: true,
        }),
      );
      mockOrderRepo.updateStatus.mockResolvedValueOnce(
        createMockOrder({ status: to }),
      );

      await service.changeStatus('order-1', to, 'user-1', undefined, allowedRole(to));
    }

    expect(mockOrderRepo.updateStatus).toHaveBeenCalledTimes(12);
  });
});
```

### Example 3: Deposit Gate Enforcement Test
```typescript
describe('Deposit gate blocks SOURCING when deposit not paid', () => {
  it('should throw BadRequestException for MHH order with insufficient deposit', async () => {
    mockOrderRepo.findById.mockResolvedValueOnce(
      createMockOrder({
        status: OrderStatus.PENDING_DEPOSIT,
        serviceType: ServiceType.MHH,
        depositPaid: 0,
        depositRequired: 10_000_000,
        isDepositPaid: false,
      }),
    );

    await expect(
      service.changeStatus('order-1', OrderStatus.SOURCING, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should allow SOURCING when deposit is fully paid for MHH', async () => {
    mockOrderRepo.findById.mockResolvedValueOnce(
      createMockOrder({
        status: OrderStatus.PENDING_DEPOSIT,
        serviceType: ServiceType.MHH,
        depositPaid: 10_000_000,
        depositRequired: 10_000_000,
        isDepositPaid: true,
      }),
    );
    mockOrderRepo.updateStatus.mockResolvedValueOnce(
      createMockOrder({ status: OrderStatus.SOURCING }),
    );

    await service.changeStatus(
      'order-1', OrderStatus.SOURCING, 'user-1',
      undefined, UserRole.ACCOUNTANT,
    );

    expect(mockOrderRepo.updateStatus).toHaveBeenCalled();
  });
});
```

### Example 4: Container Lifecycle with Customs Hold
```typescript
describe('Container Lifecycle with CUSTOMS_HOLD', () => {
  it('should handle customs hold and resume', async () => {
    const path = [
      ContainerStatus.PLANNING,
      ContainerStatus.LOADING,
      ContainerStatus.IN_TRANSIT,
      ContainerStatus.ARRIVED,
      ContainerStatus.CUSTOMS,
      ContainerStatus.CUSTOMS_HOLD,  // Customs hold
      ContainerStatus.CUSTOMS,       // Resume customs
      ContainerStatus.COMPLETED,
    ];

    for (let i = 0; i < path.length - 1; i++) {
      mockContainer(path[i]);
      await containerService.updateStatus(containerId, path[i + 1], userId);
    }
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTTP-level integration tests | Service-layer tests with mocked deps | Phase 6 decision | Faster, no DB needed, tests FSM through service |
| Representative invalid transitions | Exhaustive matrix validation | Phase 6 decision | Guarantees 100% coverage of invalid transitions |

## Existing Code Status (Critical Finding)

### FSM Spec Files Already Exist
All 9 FSM spec files are already written with substantial coverage:

| FSM | Spec File | Status | Gap |
|-----|-----------|--------|-----|
| Order | `order-status.machine.spec.ts` (674 lines) | Extensive tests including MHH, terminal, ON_HOLD, ISSUE, RETURNED | **Missing:** exhaustive matrix count test |
| Supplier Order | `supplier-order-status.machine.spec.ts` (431 lines) | Comprehensive: happy path, ISSUE, cancellation, self-transitions | **Missing:** exhaustive matrix count test |
| Container | `container-status.machine.spec.ts` (483 lines) | Full coverage: ON_HOLD_BORDER, CUSTOMS_HOLD, edge cases | **Missing:** exhaustive matrix count test |
| Quotation | `quotation-status.machine.spec.ts` (310 lines) | Good coverage: approval flow, rejection cycle | **Missing:** exhaustive matrix count test |
| Complaint | `complaint-status.machine.spec.ts` (315 lines) | **COMPLETE** -- has exhaustive matrix test (validates exactly 5 valid transitions) | None |
| Voucher | `voucher-status.machine.spec.ts` (363 lines) | **COMPLETE** -- has exhaustive matrix test (validates exactly 3 valid transitions) | None |
| Warehouse CN | `warehouse-cn-status.machine.spec.ts` (183 lines) | Good coverage: pipeline, backward, skip, self-transitions | **Missing:** exhaustive matrix count test |
| Warehouse VN | `warehouse-vn-status.machine.spec.ts` (196 lines) | Good coverage: pipeline, backward, skip, self-transitions | **Missing:** exhaustive matrix count test |
| Customs | `customs-status.machine.spec.ts` (796 lines) | Extensive: GREEN/YELLOW paths, rejection cycles, standalone function | **Missing:** exhaustive matrix count test (class-based) |

### Integration Test Status

| Test | File | Status |
|------|------|--------|
| Order lifecycle | `test/integration/order-flow.integration.spec.ts` | **Skeleton only** -- HTTP-based with supertest, does not test FSM through service layer. Must be replaced or supplemented. |
| Container lifecycle | None | **Does not exist** -- needs to be created. |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.x + ts-jest |
| Config file | `tbs-erp-backend/jest.config.js` |
| Quick run command | `cd tbs-erp-backend && npx jest --testPathPattern="domain/.*status.*spec" --no-coverage` |
| Full suite command | `cd tbs-erp-backend && npx jest --no-coverage` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DAT-03 | All 9 FSMs reject every invalid transition | unit | `npx jest --testPathPattern="domain/.*status.*spec" --no-coverage` | Partial -- 9 spec files exist but 7 need exhaustive matrix test added |
| DAT-04 | Order lifecycle CONSULTING to COMPLETED with deposit gate | integration (service-layer, mocked) | `npx jest --testPathPattern="order-lifecycle" --no-coverage` | No -- new file needed |
| DAT-05 | Container lifecycle PLANNING to COMPLETED | integration (service-layer, mocked) | `npx jest --testPathPattern="container-lifecycle" --no-coverage` | No -- new file needed |

### Sampling Rate
- **Per task commit:** `cd tbs-erp-backend && npx jest --testPathPattern="domain/.*status.*spec" --no-coverage`
- **Per wave merge:** `cd tbs-erp-backend && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/integration/order-lifecycle.integration.spec.ts` -- covers DAT-04
- [ ] `test/integration/container-lifecycle.integration.spec.ts` -- covers DAT-05
- [ ] Add exhaustive matrix tests to 7 FSM spec files -- covers DAT-03 completeness

## FSM Transition Matrix Reference

Exact state counts and valid transition counts for each FSM, needed for exhaustive matrix assertions:

### Order FSM (OrderStatusMachine)
- States: 17 (CONSULTING, QUOTATION, PENDING_DEPOSIT, SOURCING, WAREHOUSE_CN, PACKING, CONSOLIDATION, IN_TRANSIT, CUSTOMS, WAREHOUSE_VN, DELIVERING, SETTLEMENT, COMPLETED, ON_HOLD, CANCELLED, RETURNED, ISSUE)
- **Note:** OrderStatusMachine overrides validateTransition with service-type logic. The raw TRANSITION_MAP has different counts than the machine. COMPLETED->SETTLEMENT is in the raw map but blocked by the machine's terminal check (except explicit override). Need to count from the machine's behavior, not the raw map.
- Must test with and without serviceType parameter.

### Supplier Order FSM
- States: 11 (DRAFT, QUOTED, ORDERED, CONFIRMED, PARTIALLY_SHIPPED, SHIPPED_CN, RECEIVED_CN, RETURN_IN_PROGRESS, REFUNDED, CANCELLED, ISSUE)
- Valid transitions from map: DRAFT(3) + QUOTED(2) + ORDERED(3) + CONFIRMED(4) + PARTIALLY_SHIPPED(3) + SHIPPED_CN(2) + RECEIVED_CN(2) + RETURN_IN_PROGRESS(2) + REFUNDED(0) + CANCELLED(0) + ISSUE(4) = **25 valid transitions**

### Container FSM
- States: 8 (PLANNING, LOADING, IN_TRANSIT, ON_HOLD_BORDER, ARRIVED, CUSTOMS, CUSTOMS_HOLD, COMPLETED)
- Valid transitions: PLANNING(1) + LOADING(1) + IN_TRANSIT(2) + ON_HOLD_BORDER(2) + ARRIVED(1) + CUSTOMS(2) + CUSTOMS_HOLD(2) + COMPLETED(0) = **11 valid transitions**

### Quotation FSM
- States: 6 (DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, CONVERTED, EXPIRED)
- Valid transitions: DRAFT(1) + PENDING_APPROVAL(2) + APPROVED(2) + REJECTED(1) + CONVERTED(0) + EXPIRED(0) = **6 valid transitions**

### Complaint FSM
- States: 5 (OPEN, INVESTIGATING, PENDING_RESOLUTION, RESOLVED, CLOSED)
- Valid transitions: **5** (already verified by existing exhaustive test)

### Voucher FSM (ApprovalStatus)
- States: 6 (PENDING, APPROVED, REJECTED, CANCELLED, RETURNED, WITHDRAWN)
- Valid transitions: **3** (already verified by existing exhaustive test)

### Warehouse CN FSM
- States: 4 (RECEIVED, CHECKED, PACKED, SHIPPED)
- Valid transitions: RECEIVED(1) + CHECKED(1) + PACKED(1) + SHIPPED(0) = **3 valid transitions**

### Warehouse VN FSM
- States: 4 (RECEIVED, SORTED, READY, DELIVERED)
- Valid transitions: RECEIVED(1) + SORTED(1) + READY(1) + DELIVERED(0) = **3 valid transitions**

### Customs FSM
- States: 8 (DRAFT, READY, SUBMITTED, CHANNEL_ASSIGNED, INSPECTING, CLEARED, REJECTED, CANCELLED)
- Valid transitions: DRAFT(2) + READY(3) + SUBMITTED(3) + CHANNEL_ASSIGNED(2) + INSPECTING(2) + CLEARED(0) + REJECTED(1) + CANCELLED(0) = **13 valid transitions**

## Service Layer Dependencies (for Integration Tests)

### OrderStatusService Dependencies
| Dependency | Mock Strategy | Notes |
|-----------|---------------|-------|
| `OrderRepository` | jest.fn() mock | Mock `findById()` to return order at current status; mock `updateStatus()` to return updated order |
| `PrismaService` | jest.fn() mock | Not directly called by changeStatus -- used via OrderRepository |
| `OrderStatusMachine` | **Use REAL instance** | The FSM is what we're testing through the service |
| `DepositGateService` | **Use REAL instance** with mocked `prisma` | Or partially mock `shouldBlockTransition()` to control deposit gate behavior per test |
| `EventEmitter2` | jest.fn() mock | Mock `emit()` -- not relevant to FSM verification |
| `TransactionalEmitter` | jest.fn() mock with `createCollector()` returning `{ emit: jest.fn(), flush: jest.fn() }` | Must return collector object |
| `CacheService` | jest.fn() mock | Mock `del()` -- not relevant to FSM verification |

### ContainerService Dependencies
| Dependency | Mock Strategy | Notes |
|-----------|---------------|-------|
| `ContainerRepository` | jest.fn() mock | Mock `findById()` for container at current status |
| `ConsolidationService` | jest.fn() mock | Not used by `updateStatus()` |
| `ContainerStatusMachine` | **Use REAL instance** | The FSM is what we're testing |
| `PrismaService` | jest.fn() mock | Mock `executeInTransaction()` to run callback directly, mock `container.findUnique/update` |
| `EventEmitter2` | jest.fn() mock | Mock `emit()` |
| `TransactionalEmitter` | jest.fn() mock with collector | Same pattern as order |
| `CacheService` | jest.fn() mock | Mock `del()`, `invalidateByPrefix()` |

### Role Restrictions in OrderStatusService
The `changeStatus()` method has role-based restrictions for specific transitions:
- `SOURCING`: Only CHIEF_ACCOUNTANT, ACCOUNTANT, ACCOUNTANT_AR, CEO, COO, CFO
- `COMPLETED`: Only WAREHOUSE_VN_MANAGER, WAREHOUSE_VN_STAFF, LOGISTICS_MANAGER, CEO, COO

Integration tests must pass the correct `userRole` parameter for these transitions to avoid ForbiddenException.

## Open Questions

1. **Order FSM exhaustive count with serviceType**
   - What we know: OrderStatusMachine has different behavior with/without serviceType. With MHH, QUOTATION->SOURCING is blocked. Without serviceType, COMPLETED->SETTLEMENT returns false (terminal check overrides the raw map entry).
   - What's unclear: The exact count of valid transitions for the exhaustive matrix needs to be computed from the machine's actual behavior, not the raw TRANSITION_MAP.
   - Recommendation: Write the exhaustive test to COMPUTE the count by iterating all pairs through the machine (without serviceType), then assert the count. Test MHH-specific behavior separately.

2. **Existing order-flow.integration.spec.ts disposition**
   - What we know: The existing file is an HTTP-level skeleton test that uses supertest and requires a running database.
   - What's unclear: Whether to replace it or create a new file alongside it.
   - Recommendation: Create a new file `order-lifecycle.integration.spec.ts` for the service-layer test. Leave the existing file as-is (it's in `test/integration/` which is already excluded from the default Jest run via `testPathIgnorePatterns`).

## Sources

### Primary (HIGH confidence)
- `tbs-erp-backend/src/common/domain/base-status-machine.ts` -- BaseStatusMachine implementation (69 lines)
- `tbs-erp-backend/src/modules/order/domain/order-status.machine.ts` -- OrderStatusMachine with service-type overrides
- `tbs-erp-backend/src/common/constants/order-status.enum.ts` -- TRANSITION_MAP with all 17 order statuses
- `tbs-erp-backend/src/common/constants/customer-tier.enum.ts` -- DEPOSIT_RATE constants
- `tbs-erp-backend/src/modules/order/order-status.service.ts` -- OrderStatusService.changeStatus() implementation
- `tbs-erp-backend/src/modules/container/container.service.ts` -- ContainerService.updateStatus() implementation
- `tbs-erp-backend/src/modules/order/domain/deposit-gate.service.ts` -- DepositGateService.shouldBlockTransition()
- All 9 FSM spec files (verified contents line by line)
- `tbs-erp-backend/jest.config.js` -- Test configuration

### Secondary (MEDIUM confidence)
- CLAUDE.md FSM transition tables -- used to cross-verify transition maps in code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all testing tools already in place, verified from package.json and jest.config.js
- Architecture: HIGH -- existing test patterns are well-established, 9 spec files provide clear reference
- Pitfalls: HIGH -- identified from reading actual FSM implementations and their spec files line by line

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- FSM implementations rarely change)
