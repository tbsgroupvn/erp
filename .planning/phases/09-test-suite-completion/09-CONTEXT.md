# Phase 9: Test Suite Completion - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Write unit tests for 3 critical service layers (OrderService, AuthService, GeneralLedgerService) and ensure every hardening fix from Phases 1-8 has regression test coverage. This phase does NOT modify production code — it only adds test files.

</domain>

<decisions>
## Implementation Decisions

### OrderService Tests (TEST-01)
- Create `order.service.spec.ts` covering: create order, update status, cancel, reopen
- Each flow: at least 1 positive case + 1 negative case (e.g., cancel already-cancelled order fails)
- Mock Prisma, EventEmitter, DepositGateService, OrderStatusMachine
- Test that TransactionalEmitter (Phase 3) is used correctly — events only after commit
- Claude has discretion on exact test cases beyond the minimum required

### AuthService Tests (TEST-02)
- `auth.service.spec.ts` already exists — verify coverage and extend if needed
- Must cover: login (valid/invalid), 2FA TOTP verification (valid/expired), token refresh (valid/expired), logout
- Test error responses use DomainException (Phase 1 format)
- Claude has discretion on whether existing spec covers all scenarios or needs extension

### GeneralLedgerService Tests (TEST-03)
- Create `general-ledger.service.spec.ts` covering: journal entry creation, period close
- Verify double-entry balance (debits = credits)
- Test that closed period rejects new entries
- Mock Prisma for GL operations
- Claude has discretion on GL-specific test depth

### Regression Tests (TEST-04)
- Audit all 26 existing spec files from Phases 1-8 to verify coverage
- Key regressions to verify exist:
  - Phase 1: DomainException with errorCode + requestId (already covered in filter specs)
  - Phase 2: Frontend error utilities (no backend regression needed)
  - Phase 3: TransactionalEmitter deferred emit (covered in new OrderService tests)
  - Phase 4: Rate limiting returns 429 with RATE_LIMIT_EXCEEDED, file validation rejects oversized files
  - Phase 5: RolesGuard DomainException with FORBIDDEN errorCode
  - Phase 6: FSM negative-path matrices (already 640 tests)
  - Phase 7: Deposit gate tier tests, anti-fraud tests, AR block, COD, escalation (already 69 tests)
  - Phase 8: Select projections verified, slow query threshold verified
- If any phase fix lacks a regression test, create one
- Claude has discretion on identifying gaps and writing targeted regression tests

### Claude's Discretion
- Exact test cases for each service beyond minimum requirements
- Whether auth.service.spec.ts needs extension or is already sufficient
- Which Phase 1-8 fixes need additional regression tests vs already covered
- Mock strategy (manual vs jest.mock vs NestJS testing module)
- Test file organization

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Target services
- `tbs-erp-backend/src/modules/order/order.service.ts` — OrderService (create, update)
- `tbs-erp-backend/src/modules/order/order-status.service.ts` — Status transitions
- `tbs-erp-backend/src/core/auth/auth.service.ts` — AuthService (login, 2FA, refresh, logout)
- `tbs-erp-backend/src/core/auth/auth.service.spec.ts` — Existing auth spec (verify coverage)
- `tbs-erp-backend/src/modules/general-ledger/general-ledger.service.ts` — GL service

### Existing test patterns (from Phases 1-8)
- `tbs-erp-backend/src/common/exceptions/domain.exception.spec.ts` — Phase 1 exception test pattern
- `tbs-erp-backend/src/common/filters/http-exception.filter.spec.ts` — Phase 1 filter test pattern
- `tbs-erp-backend/src/modules/order/domain/deposit-gate.service.spec.ts` — Phase 7 business rule test pattern
- `tbs-erp-backend/src/modules/order/domain/order-status.machine.spec.ts` — Phase 6 FSM test pattern

### Phase 3 infrastructure (test in OrderService)
- `tbs-erp-backend/src/core/events/transactional-emitter.service.ts` — TransactionalEmitter to verify in tests

### Phase 4 infrastructure (regression targets)
- `tbs-erp-backend/src/common/guards/custom-throttler.guard.ts` — CustomThrottlerGuard
- `tbs-erp-backend/src/common/pipes/file-validation.pipe.ts` — FileValidationPipe

### Phase 5 infrastructure (regression targets)
- `tbs-erp-backend/src/core/rbac/guards/roles.guard.ts` — RolesGuard with DomainException

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 26 spec files from Phases 1-8 — established mock patterns, test structure
- `auth.service.spec.ts` — already exists, may cover some TEST-02 scenarios
- Jest configuration — already working with all Phase 6-7 tests passing
- Test integration files — `order-lifecycle.integration.spec.ts`, `container-lifecycle.integration.spec.ts`

### Established Patterns
- Mock pattern: `jest.fn()` for Prisma methods, real domain classes (FSMs, validators)
- Logger mock: `{ log: jest.fn(), warn: jest.fn(), error: jest.fn() }`
- Service instantiation: direct `new Service(mockDep1, mockDep2)` or NestJS TestingModule
- Assertion: `expect(result).toEqual()`, `expect(() => fn()).toThrow()`

### Integration Points
- OrderService depends on: PrismaService, EventEmitter, DepositGateService, OrderStatusMachine, TransactionalEmitter
- AuthService depends on: PrismaService, JwtService, ConfigService
- GeneralLedgerService depends on: PrismaService, EventEmitter

</code_context>

<specifics>
## Specific Ideas

- User delegated all decisions to Claude
- This is test-only phase — no production code changes
- 26 existing spec files provide strong mock patterns to follow
- auth.service.spec.ts may already be sufficient — verify before extending

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-test-suite-completion*
*Context gathered: 2026-03-20*
