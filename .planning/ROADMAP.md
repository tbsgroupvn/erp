# Roadmap: TBS Order ERP — Hardening & Quality

## Overview

This milestone hardens the existing TBS Order ERP system without adding new features. The 31 requirements span error handling, security, data integrity, performance, and testing. The roadmap follows a strict dependency chain: error infrastructure first (so subsequent phases can report failures consistently), then data safety and security layers, then business logic verification, then performance optimization, and finally comprehensive test coverage that validates everything. Each phase is independently deployable and rollbackable.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Backend Error Standardization** - Standardized error responses, correlation IDs, and structured exception handling across all backend layers (completed 2026-03-18)
- [ ] **Phase 2: Frontend Error Handling** - Error boundaries, user-friendly toast notifications, and crash prevention across all frontend routes
- [ ] **Phase 3: Transaction Consistency** - Prisma interactive transactions for all multi-write operations, outbox-safe event emission, and graceful shutdown
- [ ] **Phase 4: Input Validation & Rate Limiting** - HTML sanitization, file upload validation, and rate limiting on vulnerable endpoints
- [ ] **Phase 5: RBAC Audit & Coverage** - Complete @Roles() decorator audit, data scoping verification, and automated RBAC coverage test
- [ ] **Phase 6: FSM Verification** - Negative-path tests for all 9 FSMs, full order and container lifecycle integration tests
- [ ] **Phase 7: Business Rule Enforcement** - Deposit gate, anti-fraud checks, AR aging auto-block, COD enforcement, and approval escalation
- [ ] **Phase 8: Query Performance Optimization** - Select projections, database indexes, structured logging, and slow query detection
- [ ] **Phase 9: Test Suite Completion** - Service-level unit tests for Order, Auth, and GeneralLedger plus regression test coverage for all hardening changes

## Phase Details

### Phase 1: Backend Error Standardization
**Goal**: Every backend error — HTTP, WebSocket, or BullMQ — returns a machine-readable, traceable error response that downstream consumers (frontend, logs, Sentry) can process consistently
**Depends on**: Nothing (first phase)
**Requirements**: ERR-01, ERR-02, ERR-03, ERR-06
**Success Criteria** (what must be TRUE):
  1. Any API endpoint returning an error produces a JSON body with `errorCode`, `message`, and `requestId` fields
  2. No service-layer code throws raw `new Error()` — all exceptions are domain-specific NestJS HttpException subclasses
  3. WebSocket error events and BullMQ failed job logs contain the same `requestId` and `errorCode` structure as HTTP errors
  4. Every HTTP request can be traced from Sentry breadcrumb to application log entry using the same correlation ID
**Plans:** 4/4 plans complete

Plans:
- [ ] 01-01-PLAN.md — Error infrastructure: DomainException, ErrorCode registry, filter updates, double-registration fix
- [ ] 01-02-PLAN.md — Convert core/auth/order/infra raw throw new Error() to DomainException (11 files)
- [ ] 01-03-PLAN.md — WebSocket structured errors, BullMQ processor error standardization, DLQ integration
- [ ] 01-04-PLAN.md — Convert remaining module raw throw new Error() to DomainException (10 files)

### Phase 2: Frontend Error Handling
**Goal**: The frontend never shows a white-screen crash — every error is caught, displayed as a user-friendly message, and reported
**Depends on**: Phase 1 (error response format must be stable before frontend can parse it)
**Requirements**: ERR-04, ERR-05
**Success Criteria** (what must be TRUE):
  1. Navigating to a broken dashboard page shows an in-context error recovery UI (not a blank screen) with a retry option
  2. Navigating to a broken public page shows a branded error page (not Next.js default error)
  3. API errors from any hook display a Vietnamese toast notification with actionable message instead of crashing the component
**Plans:** 3 plans

Plans:
- [ ] 02-01-PLAN.md — Error utilities (errorCode-to-Vietnamese mapping, API error parser), Sentry SDK setup, centralized QueryClient mutation toast
- [ ] 02-02-PLAN.md — Error boundary files (global-error.tsx, dashboard/error.tsx, public/error.tsx), Sentry wiring in ErrorBoundary
- [ ] 02-03-PLAN.md — Remove per-hook duplicate toast.error calls from 47 hook files

### Phase 3: Transaction Consistency
**Goal**: All multi-table write operations are atomic — either everything commits or nothing does — and the application shuts down without losing in-flight work
**Depends on**: Phase 1 (transaction failures need proper error reporting)
**Requirements**: DAT-01, DAT-02, DAT-06
**Success Criteria** (what must be TRUE):
  1. An order status change that fails mid-operation (e.g., cost allocation fails after status write) rolls back completely — no partial state in the database
  2. Events emitted after a write (e.g., order.completed triggering commission calculation) only fire if the transaction commits successfully
  3. Sending SIGTERM to the backend process completes in-flight BullMQ jobs and disconnects Prisma cleanly before exiting (no orphaned connections or lost jobs)
**Plans:** 2 plans

Plans:
- [ ] 03-01-PLAN.md — TransactionalEmitter service, transaction wrapping + deferred emit for order/container/cash/complaint services
- [ ] 03-02-PLAN.md — GracefulShutdownService with ordered BullMQ worker drain, WebSocket close, Prisma disconnect

### Phase 4: Input Validation & Rate Limiting
**Goal**: User-supplied input cannot inject HTML/scripts, upload dangerous files, or overwhelm endpoints with bulk requests
**Depends on**: Phase 1 (rate limit violations need proper error responses)
**Requirements**: SEC-04, SEC-05, SEC-06
**Success Criteria** (what must be TRUE):
  1. Submitting HTML with `<script>` tags in any comment, note, or description field stores sanitized text — no raw HTML persisted
  2. Uploading a file exceeding the size limit or with a disallowed MIME type returns a clear error message and the upload is rejected
  3. Submitting more than 5 complaints per hour from the same user returns a 429 rate-limit error
  4. Bulk import endpoints and public-facing endpoints enforce rate limits that prevent abuse
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: RBAC Audit & Coverage
**Goal**: Every controller endpoint has explicit access control — no endpoint is accidentally public, and every role sees only the data it should
**Depends on**: Phase 1 (403 errors need proper error format), Phase 4 (rate limiting on public endpoints established)
**Requirements**: SEC-01, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):
  1. Running the RBAC integration test confirms every controller method has either a `@Roles()` decorator or an explicit `@Public()` marker — zero undecorated methods
  2. A Sales user querying customers sees only their own customers; a CEO querying the same endpoint sees all customers
  3. Attempting to access an endpoint without the required role returns a structured 403 Forbidden response with the user's role and the required role in the error detail
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: FSM Verification
**Goal**: All 9 state machines reject every invalid transition and the complete order and container lifecycles work end-to-end through the service layer
**Depends on**: Phase 3 (transactions must be correct for lifecycle tests), Phase 5 (RBAC must be in place for status-change endpoints)
**Requirements**: DAT-03, DAT-04, DAT-05
**Success Criteria** (what must be TRUE):
  1. For each of the 9 FSMs, a test matrix covers every invalid state transition and asserts it throws an FSM transition error
  2. An integration test drives an order from CONSULTING through every status to COMPLETED, with deposit gate enforcement verified at the PENDING_DEPOSIT stage
  3. An integration test drives a container from PLANNING through every status to COMPLETED, verifying package assignment and customs holds
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Business Rule Enforcement
**Goal**: Domain-specific financial and operational safeguards are enforced — deposits match tier rates, fraud signals are caught, overdue customers are blocked, COD is tracked, and approvals escalate on time
**Depends on**: Phase 6 (FSM transitions must be verified before testing business gates that depend on them), Phase 3 (business rule operations must be transactional)
**Requirements**: DAT-07, DAT-08, DAT-09, DAT-10, DAT-11
**Success Criteria** (what must be TRUE):
  1. Creating a purchase request for a NEW-tier customer with less than 100% deposit is blocked; REGULAR at <70%, VIP at <50%, STRATEGIC at <30%
  2. A payment voucher missing an order code, referencing a closed order, missing required documents, or submitted by wrong owner is blocked; a voucher where total cost exceeds 90% of revenue is flagged for review
  3. A customer with AR aging exceeding 90 days cannot place new orders and delivery is halted for existing orders
  4. A driver who has not submitted COD within 24 hours of delivery is blocked from receiving new delivery assignments
  5. An approval request that exceeds the SLA defined in the approval matrix auto-escalates to the next approver level
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

### Phase 8: Query Performance Optimization
**Goal**: List endpoints load fast with minimal database round-trips, slow queries are detected and logged, and all logging uses the structured NestJS logger
**Depends on**: Phase 6 (correctness assured before optimizing), Phase 7 (business rules verified before changing query patterns)
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04
**Success Criteria** (what must be TRUE):
  1. Order list, container list, and CRM list endpoints use `select` projections — loading the list does not fetch all nested relations
  2. Frequently filtered and sorted columns (order status, customer ID, created date, container status) have database indexes and queries use them
  3. No production code uses `console.log` — all logging goes through the injected NestJS Logger service (including notification, email, and SMS service stubs)
  4. Any query taking longer than 500ms is automatically logged with its SQL and EXPLAIN ANALYZE output
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD

### Phase 9: Test Suite Completion
**Goal**: Critical service layers have unit test coverage and every hardening change made in Phases 1-8 has a regression test proving the fix works
**Depends on**: Phase 8 (all hardening changes must be complete before final test pass)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. OrderService unit tests cover create, update status, cancel, and reopen flows — each with at least one positive and one negative case
  2. AuthService unit tests cover login, 2FA verification, token refresh, and logout — including expired token and invalid TOTP scenarios
  3. GeneralLedgerService unit tests cover journal entry creation and period close — including double-entry balance verification
  4. Every fix from Phases 1-8 has at least one regression test that would fail if the fix were reverted
**Plans**: TBD

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Error Standardization | 4/4 | Complete   | 2026-03-18 |
| 2. Frontend Error Handling | 1/3 | In progress | - |
| 3. Transaction Consistency | 0/2 | Not started | - |
| 4. Input Validation & Rate Limiting | 0/1 | Not started | - |
| 5. RBAC Audit & Coverage | 0/2 | Not started | - |
| 6. FSM Verification | 0/2 | Not started | - |
| 7. Business Rule Enforcement | 0/2 | Not started | - |
| 8. Query Performance Optimization | 0/2 | Not started | - |
| 9. Test Suite Completion | 0/2 | Not started | - |
