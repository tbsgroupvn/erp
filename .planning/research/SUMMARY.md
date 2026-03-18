# Project Research Summary

**Project:** TBS Order ERP - Hardening & Quality Milestone
**Domain:** Production ERP hardening (error handling, security, correctness, performance)
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

TBS Order ERP is a mature, 60K+ LOC production system built on NestJS 11, Prisma 6, PostgreSQL 15, and Next.js 14. It serves 50-70 users across 22 roles managing cross-border trade operations through 9 enforced state machines. The system has strong foundations -- exception filters, performance interceptors, audit logging, CQRS read separation, cache invalidation, and dead letter queue monitoring all exist. However, it has critical coverage gaps: <5% test coverage (14 backend spec files), 24 of 91 controllers missing `@Roles()` decorators (default-allow security gap), N+1 query risks in list endpoints that `include` all relations, and zero frontend error tracking. The hardening goal is surgical: fix gaps without rearchitecting, add only 5 new packages, and deploy changes in isolated batches.

The recommended approach is a 4-phase progression -- Error Handling, RBAC Security, FSM Correctness, Query Performance -- where each phase depends on the previous one. This ordering is not arbitrary: error codes must exist before RBAC can return proper 403 responses, security must be verified before optimizing queries that might expose data, and business logic correctness must be confirmed before optimizing incorrect queries. All four research streams converge on this ordering independently, which gives high confidence it is correct.

The biggest risk is the "big bang" anti-pattern: deploying all hardening changes simultaneously. The pitfalls research identified 14 specific failure modes, 5 of them critical. The most dangerous are (1) breaking event listeners by removing their try-catch blocks during error standardization (causing silent data loss in order state transitions and commission records), (2) adding wrong role restrictions during RBAC audit and locking entire role groups out of production, and (3) changing error response shapes that break all 50+ frontend hooks. Mitigation: deploy each phase independently, never combine error handling changes with RBAC changes with query optimizations in a single release. Each phase must be deployable and rollbackable on its own.

## Key Findings

### Recommended Stack

The existing stack requires no replacement -- only surgical additions. The codebase already has exception filters, Prometheus metrics, health checks, error boundaries, audit logging, rate limiting infrastructure, and test tooling (Jest, Vitest, Playwright, supertest). The hardening adds exactly 5 packages.

**New additions (production):**
- `@sentry/nestjs ^10.44.0`: Replace hand-rolled SentryExceptionFilter with official SDK; adds distributed tracing, cron monitoring, automatic context capture
- `@prisma/instrumentation ^6.3.0`: Prisma query spans via OpenTelemetry into Sentry; enables N+1 detection by correlating queries per request
- `@sentry/nextjs ^10.44.0`: Frontend error tracking + performance monitoring; fills the `TODO` in ErrorBoundary (line 59) for error reporting

**New additions (dev only):**
- `testcontainers ^11.13.0`: Real PostgreSQL + Redis containers for integration tests; catches transaction isolation failures and index effectiveness that mocks cannot
- `fast-check ^3.22.0`: Property-based testing for FSM transition exhaustiveness; generates random valid/invalid transition sequences to verify invariants across 9 FSMs

**Explicitly rejected:** Prisma Optimize (requires cloud account), Clinic.js (unmaintained), full OpenTelemetry collector (over-engineered for this milestone), nestjs-rbac (existing guard is sufficient), pino/winston (switching loggers adds risk with no benefit).

See: `.planning/research/STACK.md`

### Expected Features

**Must have (table stakes):**
- Standardized error responses with machine-readable error codes and request correlation IDs
- Frontend error boundaries (`error.tsx`, `global-error.tsx`) preventing white-screen crashes
- Query performance optimization (select projections replacing include-everything patterns)
- RBAC endpoint coverage verification (all 91 controllers audited for `@Roles()`)
- FSM transition verification (9 FSMs with negative path testing)
- Transaction consistency (all multi-write operations wrapped in `$transaction()`)
- Input validation completeness and rate limiting coverage on bulk/public endpoints
- Test coverage for critical paths (order lifecycle, auth, finance -- currently <5%)
- Graceful shutdown (verify `enableShutdownHooks()`, BullMQ worker cleanup, Prisma disconnect)

**Should have (differentiators):**
- Automated RBAC audit matrix (CI step that catches missing `@Roles()`)
- FSM transition coverage report with visual state diagrams
- Query performance regression detection (query count assertions in integration tests)
- Request tracing with correlation IDs via AsyncLocalStorage
- Database connection pool monitoring with alerts at 80%/90% thresholds
- Automated data integrity checks (nightly cron for orphaned records, stuck orders)
- Idempotency keys for write operations (prevent duplicate orders, double payments)

**Defer (post-hardening):**
- Circuit breakers for external services (integrations are stubs currently)
- Load testing baseline (requires infrastructure, do after functional correctness)
- Canary deployments (team too small to justify)
- Chaos testing (needs >30% test coverage first, currently <5%)
- Full field-level encryption (touches every query, requires data migration)
- Microservices extraction (strengthen module boundaries now, extract later)

See: `.planning/research/FEATURES.md`

### Architecture Approach

The hardening effort touches all 6 architectural layers (presentation, application, domain, repository, infrastructure, common) but adds very few new components. The primary work is MODIFY (17 existing files) and AUDIT (91 controllers, 9 FSMs, cache invalidation paths), with only 6 new files added (AllExceptionsFilter, error codes enum, 3 integration test suites, 1 index migration). The architecture research identified 4 key patterns: Exception Filter Chain (ordered pipeline where each filter handles a specific exception type), CQRS Read Separation (already exists, needs optimization), Guard-Based Access Audit (audit decorator coverage, not change guard implementation), and Request-Scoped Query Counter (AsyncLocalStorage for N+1 detection).

**Major components and hardening actions:**
1. **Exception Filter Chain** -- Add `AllExceptionsFilter` as catch-all; modify existing 3 filters for requestId + errorCode; standardize error response contract across backend and frontend
2. **RBAC Guard System** -- Audit 91 controllers (24 missing `@Roles()`); verify DataScopeGuard usage in repositories; add automated coverage test. Guard implementation is correct -- the gap is decorator coverage
3. **9 FSM State Machines** -- Add integration tests exercising service layer (not just machine class); verify MHH deposit gate consistency between FSM and DepositGateService; add transition metrics
4. **Query Layer** -- Split `OrderReadService` include-everything queries into select-projected variants; add request-scoped query counter for N+1 detection; add missing composite indexes with CONCURRENTLY

See: `.planning/research/ARCHITECTURE.md`

### Critical Pitfalls

1. **Silent event listener failures** -- EventEmitter2 is fire-and-forget; removing try-catch from `@OnEvent` handlers causes silent data loss (orders stuck, commissions never created). Keep catch-and-log, route failures to DLQ with retry. This is the most dangerous mistake because it looks like a "fix" during error standardization
2. **Wrong role assignments during RBAC audit** -- No specification document maps roles to endpoints. Adding `@Roles()` with incorrect role lists locks out entire user groups in production. Create role-endpoint matrix with business sign-off BEFORE adding decorators; deploy per-module, not all at once
3. **Error response shape changes breaking frontend** -- 50+ frontend hooks parse error responses with specific expectations. Changing a field name or type silently breaks all error handling UI. Type the response contract, write contract tests, coordinate backend+frontend changes atomically
4. **Cache additions without invalidation** -- 20+ event handlers in CacheInvalidationService; adding a new cache key without corresponding invalidation in every relevant handler produces stale data bugs that auto-resolve after TTL (30s-5min), making them nearly impossible to reproduce
5. **FSM positive-only test coverage** -- Testing happy paths (A->B works) without negative paths (A->C should fail) creates false confidence. For 17 statuses, there are 272 possible transitions; most should be invalid. Negative path matrix plus concurrency tests are more important than positive paths

See: `.planning/research/PITFALLS.md`

## Implications for Roadmap

Based on combined research from all 4 streams, the hardening milestone should be structured as 4 sequential phases with clear dependency ordering.

### Phase 1: Error Handling Standardization (Foundation)

**Rationale:** Every subsequent phase produces errors (403 from RBAC, FSM transition failures, query timeouts) that need consistent handling. Error codes, response format, and request correlation must be established first. Both FEATURES.md and ARCHITECTURE.md independently identify this as the foundation.

**Delivers:**
- `AllExceptionsFilter` catch-all for unhandled exceptions
- Standardized error code enum (`ERR_VALIDATION`, `ERR_NOT_FOUND`, `ERR_FSM_INVALID_TRANSITION`, etc.)
- Request ID correlation across backend error responses
- Frontend `error.tsx` and `global-error.tsx` route-level error boundaries
- Sentry integration (backend `@sentry/nestjs`, frontend `@sentry/nextjs`)
- Frontend API client error code mapping to Vietnamese user messages
- Global `onError` callback in QueryProvider for toast standardization

**Addresses features:** Standardized error responses, frontend error boundaries, structured logging verification
**Uses stack:** `@sentry/nestjs`, `@sentry/nextjs`, Next.js `error.tsx` convention
**Avoids pitfalls:** P1 (keep listener try-catch), P3 (type error response contract), P8 (Decimal serialization), P9 (emit events after transaction commit), P12 (keep console.log stubs as Logger.warn)

### Phase 2: RBAC Security Audit

**Rationale:** Security gaps must be closed before query optimization (which might change data access patterns). Phase 1's error codes enable proper 403 responses. This phase requires business stakeholder input -- not purely engineering.

**Delivers:**
- Complete audit of 91 controllers for `@Roles()` coverage
- DataScopeGuard verification (every repository applies `request.dataScope`)
- Role-endpoint permission matrix document
- Automated RBAC coverage test (`test/integration/rbac-coverage.spec.ts`)
- 403 logging with role and endpoint for production monitoring
- Missing `@Roles()` decorators added per module

**Addresses features:** RBAC endpoint coverage verification, audit logging completeness for access control
**Avoids pitfalls:** P2 (role-endpoint matrix with sign-off before adding decorators), P10 (audit DataScope separately from Roles)

### Phase 3: FSM Correctness Verification

**Rationale:** Business logic correctness must be verified before performance optimization. Phase 2's RBAC on status-change endpoints must be in place. No point optimizing queries for incorrect business flows.

**Delivers:**
- Comprehensive negative path tests for all 9 FSMs (every invalid transition asserted)
- Integration tests exercising service layer (OrderService.changeStatus() with real FSMs, gates, validators)
- MHH deposit gate consistency verification between FSM and DepositGateService
- Concurrency test for parallel status transitions on same order
- Transaction consistency audit (all multi-write operations in `$transaction()`)
- FSM transition metrics in BaseStatusMachine

**Addresses features:** FSM transition verification, transaction consistency, test coverage for critical paths
**Uses stack:** `fast-check` for property-based testing, `testcontainers` for real DB integration tests
**Avoids pitfalls:** P5 (negative path matrix, concurrency tests), P9 (events after commit), P13 (unique IDs per test, transaction rollback isolation)

### Phase 4: Query Performance Optimization

**Rationale:** With correctness assured (Phases 1-3), optimize for performance. Queries being optimized are now known to be correct and properly secured. Cache changes can be tested against known-good behavior.

**Delivers:**
- Request-scoped query counter via AsyncLocalStorage for N+1 detection
- Select projections replacing include-everything patterns in list endpoints
- Purpose-specific query methods: `findForList()`, `findForDetail()`, `findForExport()`
- Composite database indexes (CREATE INDEX CONCURRENTLY)
- Cache invalidation path verification
- Materialized view refresh optimization (CONCURRENTLY with unique indexes)
- Query performance integration tests with query count assertions
- Prisma query tracing via @prisma/instrumentation into Sentry

**Addresses features:** Query performance optimization, health check hardening (BullMQ queue depth), rate limiting coverage on remaining endpoints
**Uses stack:** `@prisma/instrumentation`, `testcontainers` for performance test assertions
**Avoids pitfalls:** P4 (cache key registry, pair every set with invalidation), P6 (distinct TypeScript return types per query variant), P7 (CREATE INDEX CONCURRENTLY), P14 (REFRESH MATERIALIZED VIEW CONCURRENTLY)

### Phase Ordering Rationale

- **Error handling before RBAC:** RBAC violations need proper 403 error codes and response format from Phase 1
- **RBAC before FSM:** RBAC audit may reveal FSM bypass paths (endpoints that allow status changes without proper role checks), requiring Phase 3 re-verification
- **FSM before queries:** Query optimization on incorrect business logic wastes effort and masks bugs with stale cache
- **Each phase independently deployable:** Avoids the "big bang" anti-pattern (PITFALLS.md cross-cutting warning). Each phase can be rolled back without affecting others
- **Feature dependencies validated:** FEATURES.md dependency graph (`Transaction consistency -> Error handling`, `RBAC coverage -> Test infrastructure`, `Query optimization -> Structured logging`) all align with this ordering

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (RBAC):** Requires business stakeholder input to build role-endpoint matrix. 22 roles with domain-specific permissions cannot be inferred from code alone. The researcher flagged this as "NOT a pure engineering task."
- **Phase 4 (Query Performance):** Cache invalidation path analysis across 20+ event handlers needs systematic mapping. Index creation on production tables requires ops coordination and staging validation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Error Handling):** NestJS exception filter chain is well-documented. Sentry SDK integration is official and straightforward. Next.js error.tsx is built-in convention.
- **Phase 3 (FSM Verification):** FSM testing patterns are well-established. 9 FSM spec files already exist as templates. Property-based testing with fast-check has clear documentation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All 5 recommended packages are official SDKs or well-established libraries. Versions verified on npm. No speculative additions. Explicit rejection list with rationale for 10 considered-but-rejected tools. |
| Features | HIGH | Feature landscape derived from direct codebase analysis of existing implementations and gaps. Table stakes vs differentiators distinction is clear and actionable. Dependency graph validated against architecture. |
| Architecture | HIGH | All modification and addition targets identified by file path. Architecture is MODIFY-heavy (17 files) not ADD-heavy (6 files), reducing risk. Component responsibility table maps every change. |
| Pitfalls | HIGH | 14 pitfalls identified from codebase analysis with specific file references and line numbers. Critical pitfalls (P1, P2, P3, P4, P5) have concrete prevention strategies. Phase-specific warning matrix provides deployment-time checklist. |

**Overall confidence:** HIGH

### Gaps to Address

- **Role-endpoint specification:** No authoritative document defines which of the 22 roles should access which endpoints. RBAC audit (Phase 2) requires business stakeholder input to create this. Cannot be resolved through code analysis alone.
- **Graceful shutdown verification:** Current state of `enableShutdownHooks()` in `main.ts` is unknown. Need to verify during Phase 1 implementation whether shutdown hooks are enabled and BullMQ workers close cleanly.
- **Real query performance baselines:** No current P50/P95/P99 latency measurements exist for critical endpoints. Phase 4 will need to establish baselines before optimizing. Consider adding k6 scenarios against staging.
- **Notification channel stubs:** DLQ alerts and error notifications currently route to `console.log` stubs. Until real email/SMS integration exists, monitoring alerts from Phases 1-4 are only visible in application logs. This is acceptable for hardening but limits operational visibility.
- **Audit log partitioning:** Partition script exists (`scripts/partition-audit-log.sql`) but application status unknown. At scale (200+ users), unpartitioned AuditLog table becomes the second performance bottleneck after query optimization. Verify during Phase 4.

## Sources

### Primary (HIGH confidence)
- [Sentry NestJS SDK](https://docs.sentry.io/platforms/javascript/guides/nestjs/) -- official integration guide
- [Sentry Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/) -- official integration guide
- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters) -- filter ordering, registration
- [NestJS Events](https://docs.nestjs.com/techniques/events) -- EventEmitter2 fire-and-forget behavior
- [Next.js Error Handling](https://nextjs.org/docs/app/getting-started/error-handling) -- error.tsx convention
- [Prisma Query Optimization](https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance) -- select vs include
- [Testcontainers for Node.js](https://node.testcontainers.org/) -- integration test containers
- Codebase analysis: Direct file reads of 91 controllers, 9 FSMs, 60+ services, all filters/guards/interceptors

### Secondary (MEDIUM confidence)
- [Prisma OpenTelemetry Tracing](https://www.prisma.io/docs/orm/prisma-client/observability-and-logging/opentelemetry-tracing) -- @prisma/instrumentation setup
- [fast-check npm](https://www.npmjs.com/package/fast-check) -- property-based FSM testing
- [NestJS Error Handling Patterns - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/error-handling-nestjs/)
- [RBAC Best Practices - Oso](https://www.osohq.com/learn/rbac-best-practices)

### Tertiary (needs validation during implementation)
- [NestJS Event Emitter Event Loss Issue #1063](https://github.com/nestjs/event-emitter/issues/1063) -- confirms fire-and-forget limitation
- [Prisma Race Condition Discussion #10709](https://github.com/prisma/prisma/discussions/10709) -- concurrent transaction handling

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
