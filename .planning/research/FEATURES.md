# Feature Landscape: ERP Hardening

**Domain:** Production hardening for existing ERP system (TBS Order ERP)
**Researched:** 2026-03-18
**Mode:** Ecosystem research -- table stakes vs differentiators for ERP hardening

---

## Table Stakes

Features that production ERP systems **must** have. Missing any of these creates operational risk, user distrust, or compliance exposure. TBS already has partial coverage in several areas; the table notes what exists vs what is missing.

| Feature | Why Expected | Complexity | Current State | Notes |
|---------|--------------|------------|---------------|-------|
| **Standardized error responses (BE)** | Consistent API error format enables FE to display actionable messages; debugging requires structured errors | Low | Partial -- `HttpExceptionFilter`, `PrismaExceptionFilter`, `SentryExceptionFilter` exist but no `error.tsx` files in Next.js App Router | Filters handle HTTP and Prisma errors well. Gap: unhandled promise rejections in service layer, no catch-all for non-HTTP contexts (WebSocket, BullMQ worker errors). Need: ensure every service method that can throw uses domain-specific exceptions, not raw `throw new Error()` |
| **Frontend error boundaries** | Prevents white-screen crashes; users see recovery UI instead of blank page | Low | Partial -- `ErrorBoundary` component exists in `shared/`, used in dashboard layout. No `error.tsx` or `global-error.tsx` route files | Next.js App Router expects `error.tsx` at route segment levels for automatic catch. Current class-based ErrorBoundary works but misses server component errors. Priority: add `global-error.tsx` at app root, `error.tsx` at `(dashboard)/` and `(public)/` levels |
| **Query performance optimization** | N+1 queries and full-table scans cause timeouts under load; users abandon slow ERPs | High | Partial -- `QueryAnalyzerService` exists with EXPLAIN ANALYZE, index suggestions, unused index detection. 562 index directives in schema. Known N+1 risk in `order-read.service.ts` | Good tooling exists but hasn't been applied. `order-read.service.ts` always includes all relations. Need: split into `findForList()` (select, no deep includes) vs `findForDetail()` (full includes). Apply `select` over `include` for list endpoints across all modules |
| **RBAC endpoint coverage verification** | Any unprotected endpoint is an authorization bypass; enterprise ERP cannot have open admin routes | Med | Partial -- `RolesGuard` + `@Roles()` decorator pattern exists. 22 roles defined. `DataScopeGuard` does row-level filtering | No automated verification that every controller method has `@Roles()`. Need: integration test that scans all controller methods via reflection and asserts `@Roles()` is present (except explicitly public routes). Manual audit insufficient for 60+ endpoints |
| **FSM transition verification** | Invalid state transitions corrupt order lifecycle; ERP's core value proposition breaks | Med | Good -- 9 FSM spec files exist (14 total spec files). `BaseStatusMachine` pattern with `validateTransition()` | Tests exist for all 9 FSMs. Gap: MHH service-type-specific transition (deposit gate) has dual validation in FSM and `DepositGateService` -- rules could diverge. Need: integration test that exercises full MHH order lifecycle from CONSULTING to COMPLETED, verifying deposit gate is enforced at the FSM level |
| **Health checks (liveness/readiness)** | Orchestrators (Docker, K8s) need health endpoints to restart unhealthy instances and route traffic away from degraded ones | Low | Good -- `HealthController` exists with `/health`, `/health/live`, `/health/ready`, `/health/detailed`. Checks DB, Redis, memory, disk | Solid implementation. Minor gap: no BullMQ queue health check. If Redis is up but queue workers are stalled, readiness still returns OK. Consider adding queue backlog depth check |
| **Audit logging completeness** | Compliance (SOX, PDPA), forensic investigation, change tracking for finance data | Med | Good -- `AuditLogInterceptor` captures all CUD operations with sanitized bodies, IP, user agent, session, impersonation tracking | Well-implemented. Gap: read-access audit for sensitive data (PII, salary, bank details) not logged. Need: selective read-audit for HR salary views and bank account queries. Also: audit log table partitioning script exists but may not be applied |
| **Rate limiting coverage** | Prevents DoS, brute force, and API abuse; required for any internet-facing endpoints | Low | Partial -- `ThrottlerModule` configured globally (100/min). Auth endpoints throttled (5/15min). Complaint service has TODO for throttle | Missing per-endpoint throttle on: bulk import (`/orders/import-excel`), public endpoints (blog, search), document upload. Complaint controller has no `@Throttle()` despite TODO at line 57 |
| **Transaction consistency** | Multi-table writes (order + status history + events) must be atomic; partial writes corrupt data | Med | Partial -- Prisma `$transaction()` used in some services. No systematic pattern enforced | Some services use transactions, others don't. Critical paths (order status change, cost allocation, deposit recording) must all use interactive transactions. Need: audit all multi-write operations and wrap in `$transaction()` |
| **Input validation completeness** | Malformed input causes server errors, XSS, injection; enterprise ERP handles financial data | Med | Partial -- `class-validator` DTOs with `ValidationPipe`. `sanitize-html.decorator.ts` exists. Some DTOs may have incomplete validation | DTOs exist for most endpoints. Gap: file upload size/type validation may be inconsistent. HTML sanitization decorator exists but may not be applied to all user-input text fields (comments, notes, descriptions) |
| **Graceful shutdown** | In-flight requests and BullMQ jobs must complete before process exit; prevents data corruption | Low | Unknown -- not verified in `main.ts` | NestJS supports `app.enableShutdownHooks()`. Need: verify shutdown hooks are enabled, BullMQ workers close gracefully, Prisma disconnects cleanly. Without this, deploys may corrupt in-flight transactions |
| **Dead letter queue monitoring** | Failed async jobs (finance allocation, notifications) must be surfaced, not silently lost | Low | Good -- `DlqMonitorService` checks 3 DLQ sources every 5 minutes with alert thresholds and cooldown | Well-implemented with threshold alerts and cooldown. Minor gap: alerts go to event emitter but notification channels are console.log stubs. Until email/SMS works, DLQ alerts are only visible in logs |
| **Test coverage for critical paths** | Untested code in order lifecycle, finance allocation, auth = high regression risk | High | Poor -- 14 backend spec files for 60K+ LOC (<5% coverage). 13 E2E specs (Playwright). No frontend unit tests | Priority: service-level tests for `OrderService`, `OrderStatusService`, `AuthService`, `GeneralLedgerService`. Current FSM unit tests are good but no service integration tests beyond 2 files in `test/integration/` |
| **Structured logging** | Centralized log analysis, incident correlation, performance debugging | Low | Good -- `ElkLoggerService` for ELK-structured logging in production. Console output in dev | Implementation exists. Need: verify all modules use injected logger (not `console.log`). Grep found notification service uses `console.log` for email/SMS stubs -- these should use logger even in stub mode |

## Differentiators

Features that set a **hardened** ERP apart from a basic one. Not expected by users, but dramatically improve operational reliability and developer confidence. Build these after table stakes.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Automated RBAC audit matrix** | Generate a role-endpoint permission matrix from code, compare against spec. Catches missed `@Roles()` decorators and over-permissive access in CI | Med | Use NestJS `DiscoveryService` to scan all route handlers, extract `@Roles()` metadata, generate matrix. Run as CI step. No production ERP tool exists for this -- custom build required |
| **FSM transition coverage report** | Prove that every valid transition AND every invalid transition is tested. Generate visual state diagram from code | Med | XState has visualization tools, but TBS uses custom FSMs. Build a script that reads transition maps from constants, generates DOT/Mermaid diagram, and cross-references spec files to compute coverage percentage |
| **Query performance regression detection** | Detect when a code change introduces N+1 or slow queries before production. Run Prisma query count assertions in integration tests | Med | `QueryAnalyzerService` tooling exists. Extend: add Prisma middleware that counts queries per request in test mode. Assert query count in integration tests (e.g., order list should be <= 3 queries) |
| **Canary deployment support** | Roll out backend changes to subset of users/traffic, validate metrics before full rollout | High | Requires Nginx/load balancer configuration + feature flags. Overkill for current team size (<100 users) unless growth is imminent |
| **Circuit breaker for external services** | When Kuaidi100, GHTK, or bank API is down, fail fast instead of timing out. Recover automatically when service returns | Med | Use `opossum` or `cockatiel` library. Wrap all external HTTP calls in circuit breaker. Emit metrics when circuit opens/closes. Especially important for shipping rate quotes that block order creation |
| **Request tracing (correlation IDs)** | Trace a single user request across backend services, BullMQ jobs, WebSocket events. Essential for debugging production issues | Low-Med | Generate UUID per request in middleware, propagate via `AsyncLocalStorage` (NestJS-CLS). Attach to all log entries, Sentry breadcrumbs, BullMQ job metadata. Low complexity per-request, medium to thread through all services |
| **Database connection pool monitoring** | Surface connection exhaustion before it causes 500 errors. Alert when pool usage exceeds 80% | Low | Prisma connection pool has configurable `connection_limit`. Add periodic check of active connections vs pool size. Log warning at 80%, alert at 90% |
| **Automated data integrity checks** | Scheduled jobs that verify business invariants: no orphaned order items, no orders stuck in intermediate states for >7 days, no negative account balances | Med | Run nightly via `@Cron()`. Query for data anomalies. Emit alerts. Catches silent data corruption that manual testing misses |
| **Load testing baseline** | Establish response time baselines (P50, P95, P99) for critical endpoints. Detect regressions in CI | High | Use k6 or Artillery against staging. Requires test data seeding, separate environment. Valuable but requires infrastructure investment |
| **Idempotency keys for write operations** | Prevent duplicate order creation, double payment recording from network retries or client-side bugs | Med | Add `idempotencyKey` header/parameter to POST endpoints. Cache key -> response in Redis for 24h. Return cached response for duplicate key. Critical for financial operations |

## Anti-Features

Features to explicitly **NOT** build during hardening. These are common traps that distract from stability work.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **New business modules** | Hardening milestone exists precisely to stop feature creep. New modules introduce new bugs while existing ones remain unverified | Document feature requests in backlog. Return to them after hardening metrics (test coverage, error rates) improve |
| **Schema migrations** | PROJECT.md constraint: "No schema changes." Schema changes require coordinated BE+FE changes, migration testing, rollback plans | Fix code behavior. If a schema issue blocks a critical fix, flag it for a separate database milestone |
| **Full field-level encryption** | CONCERNS.md notes `PrismaEncryptionProvider` is non-functional. Implementing real encryption touches every query, requires migration of existing data, breaks search | Flag for dedicated security milestone. In hardening: document which fields need encryption, verify no PII appears in logs/error messages |
| **API contract changes** | PROJECT.md constraint: "No API contract changes." Frontend must continue working unchanged | If a response shape is wrong, fix the backend to match the documented contract. Do not change what the frontend expects |
| **Custom monitoring dashboard** | Building a custom metrics UI is a rabbit hole. Use existing tools | Configure Grafana dashboards over Prometheus metrics already being collected. Bull Board already exists for queue monitoring |
| **Microservices extraction** | Splitting the monolith during hardening adds deployment complexity and distributed system failure modes | Strengthen module boundaries (clear interfaces, no circular dependencies) so extraction is possible later, but don't do it now |
| **Performance optimization without measurement** | Premature optimization wastes effort on non-bottlenecks | Use `QueryAnalyzerService` to identify actual slow queries. Use `PerformanceInterceptor` to find slow endpoints. Optimize only what's measured as slow |
| **Automated chaos testing** | Chaos engineering (killing pods, injecting latency) requires mature monitoring, runbooks, and recovery procedures first | Build monitoring and alerting first. Chaos testing is a differentiator for mature systems, not a hardening activity for a system with <5% test coverage |

## Feature Dependencies

```
Transaction consistency ──> Error handling standardization (must handle tx rollback errors)
RBAC endpoint coverage ──> Test infrastructure (need reflection-based scanning)
Query performance optimization ──> Structured logging (need to log slow queries)
FSM transition verification ──> Existing FSM spec files (extend, don't rewrite)
Frontend error boundaries ──> Error handling standardization (BE must return consistent errors for FE to display)
DLQ monitoring (already done) ──> Notification channels (currently console.log -- alerts are invisible)
Test coverage ──> All other features (tests verify that hardening actually works)
Rate limiting coverage ──> Input validation (throttle + validate = defense in depth)
Request tracing ──> Structured logging (correlation IDs must appear in log entries)
Automated data integrity ──> Transaction consistency (integrity checks find violations that atomic writes prevent)
Idempotency keys ──> Transaction consistency (idempotency check + write must be atomic)
```

## Dependency-Ordered Build Sequence

Based on dependency analysis, the recommended build order is:

1. **Error handling standardization** (BE + FE) -- foundation for everything else
2. **Transaction consistency** -- prevents data corruption that makes other hardening moot
3. **Input validation + rate limiting** -- defense in depth, low effort
4. **Test infrastructure + critical path tests** -- verify that items 1-3 actually work
5. **RBAC endpoint audit** -- requires test infrastructure from step 4
6. **Query performance optimization** -- measured optimization, not premature
7. **FSM verification deepening** -- extend existing good tests
8. **Graceful shutdown + health check hardening** -- operational readiness
9. **Request tracing + correlation IDs** -- debugging in production
10. **Differentiators** (integrity checks, idempotency, circuit breakers) -- only after table stakes

## MVP Recommendation

Prioritize (highest impact on production stability):

1. **Error handling standardization** -- consistent error responses prevent user confusion and enable FE error boundaries. Low complexity, high visibility.
2. **Transaction consistency audit** -- wrap all multi-write operations in `$transaction()`. Prevents silent data corruption. Medium complexity, critical impact.
3. **Frontend error boundaries** -- add `error.tsx` and `global-error.tsx` to prevent white-screen crashes. Low complexity, high user trust.
4. **Test coverage for critical paths** -- service-level tests for order lifecycle, auth, and finance. High complexity, but highest long-term ROI.
5. **RBAC endpoint audit** -- verify every endpoint is protected. Medium complexity, security-critical.

Defer:
- **Circuit breakers**: External service stubs return empty data anyway; circuit breaker is meaningless until integrations are real.
- **Load testing baseline**: Valuable but requires infrastructure. Do after functional correctness is established.
- **Canary deployments**: Team and user base are too small to justify the infrastructure overhead.
- **Automated chaos testing**: System needs >30% test coverage before chaos testing provides value. Currently at <5%.

## Sources

- [NestJS Error Handling Patterns - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/error-handling-nestjs/)
- [NestJS Exception Filters - Official Docs](https://docs.nestjs.com/exception-filters)
- [Next.js Error Handling - Official Docs](https://nextjs.org/docs/app/getting-started/error-handling)
- [Prisma Best Practices - Official Docs](https://www.prisma.io/docs/orm/more/best-practices)
- [Prisma Query Optimization - Official Docs](https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance)
- [RBAC Best Practices 2025 - Oso](https://www.osohq.com/learn/rbac-best-practices)
- [BullMQ Dead Letter Queues - OneUptime](https://oneuptime.com/blog/post/2026-01-21-bullmq-dead-letter-queue/view)
- [BullMQ Going to Production - Official Docs](https://docs.bullmq.io/guide/going-to-production)
- [Production Readiness Checklist - GoReplay](https://goreplay.org/blog/production-readiness-checklist-20250808133113/)
- [Production Readiness Checklist - SigNoz](https://signoz.io/guides/production-readiness-checklist/)
- [Prisma + NestJS Error Handling - Ivan Stepanian](https://www.ivanstepanian.com/en/blog/prisma-and-nestjs-error-handling-made-easy)
- Codebase analysis: `HttpExceptionFilter`, `PrismaExceptionFilter`, `SentryExceptionFilter`, `AuditLogInterceptor`, `PerformanceInterceptor`, `MetricsInterceptor`, `DlqMonitorService`, `QueryAnalyzerService`, `HealthController`, `ErrorBoundary`

---

*Feature landscape analysis: 2026-03-18*
