# Requirements: TBS Order ERP — Hardening & Quality

**Defined:** 2026-03-18
**Core Value:** The order lifecycle (17+ statuses across 9 FSMs) must be bulletproof — no state can be skipped, no unauthorized role can mutate data, and no query can bottleneck under production load.

## v1 Requirements

Requirements for hardening milestone. Each maps to roadmap phases.

### Error Handling

- [x] **ERR-01**: All backend API errors return a standardized JSON response format with error code, message, and request correlation ID
- [x] **ERR-02**: All service-layer exceptions use domain-specific NestJS exceptions (not raw `throw new Error()`)
- [x] **ERR-03**: WebSocket and BullMQ worker errors are caught and logged with the same structured format as HTTP errors
- [x] **ERR-04**: Next.js App Router has `global-error.tsx` at app root and `error.tsx` at `(dashboard)/` and `(public)/` route levels
- [x] **ERR-05**: Frontend displays user-friendly error messages via toast notifications instead of white-screen crashes
- [x] **ERR-06**: Every HTTP request has a unique correlation ID (generated in middleware) that propagates through logs, Sentry breadcrumbs, and BullMQ job metadata

### Security & RBAC

- [x] **SEC-01**: Every controller method has explicit `@Roles()` decorator (or is explicitly marked `@Public()`)
- [x] **SEC-02**: Integration test exists that scans all controller methods via NestJS reflection and asserts RBAC decorator presence
- [x] **SEC-03**: All 22 roles have correct data scoping — Sales sees only own customers, CEO sees all, etc.
- [x] **SEC-04**: Rate limiting applied to complaint submission (5/hour), bulk import endpoints, and all public-facing endpoints
- [x] **SEC-05**: HTML sanitization decorator applied to all user-input text fields (comments, notes, descriptions)
- [x] **SEC-06**: File upload endpoints validate file size limits and allowed MIME types

### Data Integrity

- [x] **DAT-01**: All multi-table write operations (order status change, cost allocation, deposit recording) use Prisma interactive transactions
- [x] **DAT-02**: Service methods that emit events after writes do so inside the same transaction (or use outbox pattern)
- [x] **DAT-03**: Each of the 9 FSMs has negative-path tests verifying that every invalid transition is rejected
- [x] **DAT-04**: Integration test exercises full order lifecycle from CONSULTING to COMPLETED, verifying deposit gate enforcement
- [x] **DAT-05**: Integration test exercises full container lifecycle from PLANNING to COMPLETED
- [x] **DAT-06**: Application enables NestJS shutdown hooks with graceful BullMQ worker close and Prisma disconnect
- [x] **DAT-07**: Deposit gate enforces correct tier-based rates (NEW=100%, REGULAR=70%, VIP=50%, STRATEGIC=30%) and blocks purchase request if deposit insufficient
- [x] **DAT-08**: Anti-fraud checks BLOCK vouchers missing order code, on closed orders, missing docs, or wrong owner; FLAG when total cost > 90% revenue
- [x] **DAT-09**: Auto-block customer when AR aging exceeds 90 days — prevents new orders and delivery
- [x] **DAT-10**: COD enforcement blocks driver from new assignments if COD not submitted within 24 hours
- [x] **DAT-11**: Approval escalation auto-escalates to next level when approver exceeds SLA (per Phan 5 matrix)

### Performance

- [x] **PERF-01**: List endpoints use `select` projections instead of `include` for all relations (fix N+1 in order-read, container, CRM)
- [x] **PERF-02**: Missing database indexes identified and added for frequently filtered/sorted columns
- [x] **PERF-03**: All modules use injected NestJS logger instead of `console.log` (replace stubs in notification, email, SMS services)
- [x] **PERF-04**: Slow query logging enabled — queries exceeding 500ms are logged with EXPLAIN ANALYZE output

### Testing

- [x] **TEST-01**: Service-level unit tests exist for OrderService covering create, update status, cancel, and reopen flows
- [ ] **TEST-02**: Service-level unit tests exist for AuthService covering login, 2FA verification, token refresh, and logout
- [ ] **TEST-03**: Service-level unit tests exist for GeneralLedgerService covering journal entry creation and period close
- [ ] **TEST-04**: All hardening changes include regression tests that verify the fix

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Differentiators

- **DIFF-01**: Automated RBAC audit matrix generated in CI from NestJS DiscoveryService
- **DIFF-02**: FSM transition coverage report with visual state diagrams (Mermaid)
- **DIFF-03**: Query performance regression detection via Prisma query count assertions
- **DIFF-04**: Database connection pool monitoring with alerts at 80% usage
- **DIFF-05**: Automated nightly data integrity checks (orphaned orders, stuck states, negative balances)
- **DIFF-06**: Idempotency keys for write operations (order creation, payment recording)
- **DIFF-07**: Circuit breakers for external service calls (tracking, shipping, banking)
- **DIFF-08**: Load testing baseline with P50/P95/P99 benchmarks for critical endpoints

## Out of Scope

| Feature | Reason |
|---------|--------|
| New business modules | Hardening-only milestone — no feature creep |
| Schema migrations | PROJECT.md constraint: fix code, not schema |
| Field-level encryption | Requires dedicated security milestone |
| API contract changes | Frontend must continue working unchanged |
| Custom monitoring dashboard | Use existing Grafana + Prometheus |
| Microservices extraction | Strengthen boundaries only, don't split |
| Chaos testing | Need >30% test coverage first (currently <5%) |
| Third-party integrations (tracking, shipping, banking) | Separate milestone for real integrations |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ERR-01 | Phase 1 | Complete |
| ERR-02 | Phase 1 | Complete |
| ERR-03 | Phase 1 | Complete |
| ERR-04 | Phase 2 | Complete |
| ERR-05 | Phase 2 | Complete |
| ERR-06 | Phase 1 | Complete |
| SEC-01 | Phase 5 | Complete |
| SEC-02 | Phase 5 | Complete |
| SEC-03 | Phase 5 | Complete |
| SEC-04 | Phase 4 | Complete |
| SEC-05 | Phase 4 | Complete |
| SEC-06 | Phase 4 | Complete |
| DAT-01 | Phase 3 | Complete |
| DAT-02 | Phase 3 | Complete |
| DAT-03 | Phase 6 | Complete |
| DAT-04 | Phase 6 | Complete |
| DAT-05 | Phase 6 | Complete |
| DAT-06 | Phase 3 | Complete |
| DAT-07 | Phase 7 | Complete |
| DAT-08 | Phase 7 | Complete |
| DAT-09 | Phase 7 | Complete |
| DAT-10 | Phase 7 | Complete |
| DAT-11 | Phase 7 | Complete |
| PERF-01 | Phase 8 | Complete |
| PERF-02 | Phase 8 | Complete |
| PERF-03 | Phase 8 | Complete |
| PERF-04 | Phase 8 | Complete |
| TEST-01 | Phase 9 | Complete |
| TEST-02 | Phase 9 | Pending |
| TEST-03 | Phase 9 | Pending |
| TEST-04 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after roadmap creation — all 31 requirements mapped to phases*
