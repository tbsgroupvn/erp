# Technology Stack: ERP Hardening

**Project:** TBS Order ERP - Hardening & Quality Milestone
**Researched:** 2026-03-18
**Overall confidence:** HIGH

## Approach: Minimal Additions, Maximum Leverage

This is a hardening milestone, not a greenfield build. The existing stack (NestJS 11, Prisma 6, Next.js 14, Jest 29, Vitest 4, Playwright 1.58) is mature and well-configured. The goal is to add **only** the tools that fill specific hardening gaps -- error tracking, query profiling, RBAC verification, FSM testing depth -- without introducing unnecessary complexity.

**Guiding principle:** Use what already exists. Add surgical tools for gaps. Do not rearchitect.

---

## What Already Exists (DO NOT Replace)

Before listing additions, here is what the codebase already has that is sufficient for hardening:

| Capability | Existing Tool | Status | Notes |
|------------|---------------|--------|-------|
| Exception filters | `HttpExceptionFilter`, `PrismaExceptionFilter`, `SentryExceptionFilter` | Working | Covers HTTP, Prisma, and catch-all. Response format standardized. |
| Performance interceptor | `PerformanceInterceptor` + `MetricsService` | Working | Prometheus histograms, slow request logging (>1s warn, >5s error), Server-Timing headers |
| Query profiling | `PrismaService` query events + `prisma-performance.extension.ts` | Working | Slow query logging (>200ms warn, >2s error), Prometheus model/operation histograms |
| Prometheus metrics | `prom-client 15.1.0` + custom `MetricsService` | Working | HTTP, DB, cache, auth, memory, event loop metrics already defined |
| Health checks | `@nestjs/terminus 11.0.0` | Working | DB health check with reconnect logic |
| Error boundaries | `ErrorBoundary` + `withErrorBoundary` HOC | Working | Vietnamese UI, dev-mode stack traces, reset/reload buttons |
| Request logging | `LoggingInterceptor` | Working | Method, URL, status, duration, userId, IP, user-agent |
| Audit logging | `AuditLogInterceptor` | Working | CRUD audit trail |
| Rate limiting | `@nestjs/throttler 6.3.0` | Partial | Global throttle exists but per-endpoint coverage is incomplete |
| Test infrastructure | Jest 29 + Vitest 4 + Playwright 1.58 + supertest 7.2.2 | Working | 14 spec files exist, FSM base class + all 9 FSM machines tested |
| Auth testing | `@nestjs/testing 11.1.15` | Working | Test module builder available |
| RBAC guards | `RolesGuard` + `@Roles()` decorator | Working | Reflector-based, allows-all when no decorator (needs audit) |

---

## Recommended Additions

### 1. Error Tracking: @sentry/nestjs

| Property | Value |
|----------|-------|
| Package | `@sentry/nestjs` |
| Version | `^10.44.0` |
| Purpose | Replace hand-rolled `SentryExceptionFilter` with official SDK integration |
| Confidence | HIGH (official Sentry SDK, NestJS docs recommend it) |

**Why:** The current `SentryExceptionFilter` dynamically imports `@sentry/node` with `try/catch` -- fragile, no tracing, no cron monitoring. The official `@sentry/nestjs` package provides:
- `@SentryExceptionCaptured()` decorator for automatic error capture
- `@SentryTraced()` for performance spans on service methods
- `@SentryCron()` for monitoring scheduled tasks (report-scheduler, customs-reminder)
- Automatic request context, user context, and breadcrumb collection
- Built-in scrubbing of sensitive data

**Why not keep the current approach:** The hand-rolled filter works for basic capture, but misses distributed tracing (no spans for Prisma queries, BullMQ jobs, Redis calls), does not integrate with NestJS lifecycle hooks, and requires manual maintenance of the Sentry scope setup.

**Integration points:**
- Replace `SentryExceptionFilter` with `SentryModule.forRoot()` in `AppModule`
- Decorate critical services (`OrderService`, `DepositGateService`, `CustomsDeclarationService`) with `@SentryTraced()`
- Decorate cron jobs in `ReportSchedulerService` and `CustomsReminderService` with `@SentryCron()`
- Remove the dynamic `import('@sentry/node')` pattern from `sentry-exception.filter.ts`

```bash
cd tbs-erp-backend && npm install @sentry/nestjs@^10.44.0
```

**Sources:**
- [Sentry NestJS SDK docs](https://docs.sentry.io/platforms/javascript/guides/nestjs/)
- [NestJS Sentry recipe](https://docs.nestjs.com/recipes/sentry)
- [npm @sentry/nestjs](https://www.npmjs.com/package/@sentry/nestjs)

---

### 2. Integration Testing: testcontainers

| Property | Value |
|----------|-------|
| Package | `testcontainers` |
| Version | `^11.13.0` |
| Purpose | Real PostgreSQL + Redis containers for integration tests |
| Confidence | HIGH (standard for Node.js integration testing, actively maintained) |

**Why:** Current test coverage is <5% line coverage with only 14 spec files. Unit tests with mocked Prisma clients cannot catch:
- N+1 query patterns
- Transaction isolation failures (P2034 serialization errors)
- Index effectiveness on real data volumes
- Cache invalidation race conditions
- RBAC guard behavior with real auth pipeline

Testcontainers spins up real PostgreSQL 15 and Redis 7 Docker containers per test suite, runs `prisma migrate deploy`, seeds test data, and tears down after. This catches real database behavior that mocks hide.

**Why not use a shared test database:** Shared databases cause flaky tests from parallel test contamination. Testcontainers provides isolated, reproducible environments per suite.

**Integration points:**
- Create `test/setup-integration.ts` with PostgreSQL + Redis container setup
- Use `PrismaService.cleanDatabase()` (already exists) between test cases
- Run integration tests with existing `npm run test:integration` script
- CI pipeline (GitHub Actions) already supports Docker, no infra changes needed

```bash
cd tbs-erp-backend && npm install -D testcontainers@^11.13.0
```

**Sources:**
- [testcontainers npm](https://www.npmjs.com/package/testcontainers)
- [NestJS + Testcontainers guide](https://dev.to/medaymentn/improving-intergratione2e-testing-using-nestjs-and-testcontainers-3eh0)
- [Testcontainers for Node.js](https://node.testcontainers.org/)

---

### 3. OpenTelemetry Tracing (for Prisma Query Analysis): @prisma/instrumentation

| Property | Value |
|----------|-------|
| Package | `@prisma/instrumentation` |
| Version | `^6.3.0` (matches Prisma client version) |
| Purpose | Distributed tracing of Prisma queries for N+1 detection and slow query analysis |
| Confidence | MEDIUM (official Prisma package, but requires OpenTelemetry collector setup) |

**Why:** The existing `prisma-performance.extension.ts` logs slow queries but cannot:
- Correlate multiple queries belonging to a single API request
- Detect N+1 patterns (multiple queries to same model within one handler)
- Show query execution plans or parameter distributions
- Feed into Sentry performance monitoring

**Critical decision -- lightweight vs full observability:**

For this hardening milestone, use `@prisma/instrumentation` connected to Sentry (which supports OpenTelemetry) rather than deploying a full Jaeger/Zipkin stack. Sentry already collects performance data; adding Prisma spans gives query-level visibility inside existing Sentry traces.

**Integration points:**
- Register `PrismaInstrumentation` in Sentry SDK setup
- Sentry will automatically create spans for each Prisma operation
- Existing `prisma-performance.extension.ts` continues running for Prometheus metrics (complementary, not redundant)

```bash
cd tbs-erp-backend && npm install @prisma/instrumentation@^6.3.0
```

**Deferred:** Full OpenTelemetry collector (Jaeger/Zipkin) is out of scope for this milestone. Sentry's built-in OTel support is sufficient for query profiling during hardening.

**Sources:**
- [Prisma OpenTelemetry tracing docs](https://www.prisma.io/docs/orm/prisma-client/observability-and-logging/opentelemetry-tracing)
- [Prisma Client extensions docs](https://www.prisma.io/docs/orm/prisma-client/client-extensions/middleware)

---

### 4. RBAC Audit Script (No New Package -- Custom Tooling)

| Property | Value |
|----------|-------|
| Package | None (custom script) |
| Purpose | Automated scanning of all controller endpoints for `@Roles()` decorator coverage |
| Confidence | HIGH (uses existing `@nestjs/core` Reflector + TypeScript AST, no external deps) |

**Why:** The `RolesGuard` allows all authenticated users when no `@Roles()` decorator is present (line 23: `return true`). This is a security gap: any authenticated user (including WAREHOUSE_VN_STAFF) can access endpoints without explicit role gating. The hardening task is to:
1. Enumerate all controller endpoints
2. Check which ones have `@Roles()` decorators
3. Generate a coverage report showing unprotected endpoints
4. Add `@Roles()` to every unprotected endpoint

**This does NOT require a new library.** Use the existing `@nestjs/core` `DiscoveryService` to enumerate routes at runtime, or write a static TypeScript AST scanner using TypeScript's compiler API (already a dev dependency).

**Implementation approach:**
- Create `scripts/rbac-audit.ts` that uses `ts-morph` (or raw TypeScript compiler API) to scan all `*.controller.ts` files
- For each `@Get()`, `@Post()`, `@Patch()`, `@Delete()` method, check for `@Roles()` decorator
- Output a table of unprotected endpoints with recommended roles based on module context
- Run as `npx ts-node scripts/rbac-audit.ts`

**Why not use a RBAC library (nestjs-rbac, etc.):** The existing `RolesGuard` + `@Roles()` + CASL integration is sufficient. The gap is coverage audit, not capability.

---

### 5. FSM Property-Based Testing: fast-check

| Property | Value |
|----------|-------|
| Package | `fast-check` |
| Version | `^3.22.0` |
| Purpose | Property-based testing for FSM transition exhaustiveness |
| Confidence | MEDIUM (well-established library, but requires custom FSM test harness) |

**Why:** The existing 9 FSM spec files test specific transitions (DRAFT -> ACTIVE, etc.) but do not verify:
- That NO invalid transition is possible (exhaustive negative testing)
- That all reachable states have at least one exit path (no dead-end states except terminals)
- That multi-step paths (e.g., CONSULTING -> ... -> COMPLETED) always terminate
- Edge cases like rapid state changes, concurrent transitions

Property-based testing generates random sequences of state transitions and verifies invariants hold for all of them. For 9 FSMs with 5-17 states each, manual enumeration of all paths is impractical. `fast-check` generates thousands of random valid/invalid paths automatically.

**Integration points:**
- Create `*.property.spec.ts` files alongside existing `*.machine.spec.ts` files
- Define FSM invariants: "no state can transition to itself", "all non-terminal states have at least one valid next state", "every terminal state has zero valid next states"
- Use `fast-check`'s `fc.constantFrom()` to generate random status values from the enum
- Run as part of existing `npm test` suite

```bash
cd tbs-erp-backend && npm install -D fast-check@^3.22.0
```

**Sources:**
- [fast-check npm](https://www.npmjs.com/package/fast-check)
- Property-based testing is well-documented for state machine verification in the testing community

---

### 6. Next.js Error Pages: error.tsx Convention (No New Package)

| Property | Value |
|----------|-------|
| Package | None (Next.js built-in `error.tsx` file convention) |
| Purpose | Per-route error boundaries complementing the existing `ErrorBoundary` component |
| Confidence | HIGH (official Next.js App Router feature) |

**Why:** The existing `ErrorBoundary` React component is used in `layout.tsx` and `tong-quan/page.tsx`, but Next.js App Router has a built-in `error.tsx` convention that provides:
- Automatic error isolation per route segment
- Server Component error handling (the React `ErrorBoundary` only catches client-side errors)
- Built-in `reset()` function for retry
- `global-error.tsx` for root layout errors

The existing `ErrorBoundary` component should be kept for use within pages (wrapping individual widgets), while `error.tsx` files handle route-level errors.

**Implementation:**
- Create `src/app/(dashboard)/error.tsx` for dashboard-wide error boundary
- Create `src/app/(dashboard)/don-hang/error.tsx` for order module errors
- Create `src/app/global-error.tsx` for root layout failures
- Connect `componentDidCatch` in existing `ErrorBoundary` to Sentry via `@sentry/nextjs`

**Sources:**
- [Next.js error handling docs](https://nextjs.org/docs/app/getting-started/error-handling)
- [error.tsx API reference](https://nextjs.org/docs/app/api-reference/file-conventions/error)

---

### 7. Frontend Error Tracking: @sentry/nextjs

| Property | Value |
|----------|-------|
| Package | `@sentry/nextjs` |
| Version | `^10.44.0` |
| Purpose | Frontend error tracking + performance monitoring |
| Confidence | HIGH (official Sentry SDK for Next.js) |

**Why:** The `ErrorBoundary` component has a TODO on line 59: "Send to error reporting service (Sentry, LogRocket, etc.)". Currently, frontend errors are only logged to console. For a production ERP with 22 roles and hundreds of pages, console logging is insufficient.

`@sentry/nextjs` provides:
- Automatic error capture in both Client and Server Components
- Source map upload for readable stack traces
- Performance monitoring (page load, route changes)
- Session replay for debugging user-reported issues
- Integration with backend Sentry project for end-to-end tracing

```bash
cd tbs-erp-frontend && npm install @sentry/nextjs@^10.44.0
```

**Sources:**
- [Sentry Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

---

## Additions NOT Recommended

| Tool | Why Considered | Why Rejected |
|------|---------------|--------------|
| **Prisma Optimize / Query Insights** | AI-driven query analysis | Requires Prisma Cloud account. Self-hosted analysis via existing `prisma-performance.extension.ts` + Sentry tracing is sufficient for hardening. |
| **Clinic.js** | Node.js performance profiling | No longer actively maintained; may not work correctly with Node 22. The existing Prometheus + Sentry combo covers this need. |
| **OpenTelemetry Collector (Jaeger/Zipkin)** | Full distributed tracing | Over-engineered for hardening. Sentry's built-in OTel support provides adequate tracing. Defer to a dedicated observability milestone. |
| **nestjs-rbac** | Role-based access control library | The existing `RolesGuard` + CASL integration is more than sufficient. The gap is coverage audit, not RBAC capability. |
| **express-rate-limit** | Additional rate limiting | `@nestjs/throttler` (already installed v6.3.0) covers this. Just need to add `@Throttle()` decorators to unprotected endpoints. |
| **pino / winston** | Structured logging | NestJS's built-in Logger with the existing `LoggingInterceptor` is sufficient. Switching logging frameworks during hardening adds risk with no benefit. |
| **k6** | Load testing | Already in `package.json` scripts (`test:load`). No new package needed; just write test scenarios. |
| **@faker-js/faker** | Test data generation | Useful but not critical for hardening. Test factories can use simple helpers. Defer if needed. |
| **prisma-dbml-generator** | Database documentation | Nice-to-have, not a hardening tool. |
| **helmet** | HTTP security headers | Already installed (v8.0.0). Just verify it is properly configured in `main.ts`. |

---

## Full Installation Summary

### Backend (tbs-erp-backend)

```bash
# Production dependencies
npm install @sentry/nestjs@^10.44.0 @prisma/instrumentation@^6.3.0

# Dev dependencies (testing only)
npm install -D testcontainers@^11.13.0 fast-check@^3.22.0
```

### Frontend (tbs-erp-frontend)

```bash
npm install @sentry/nextjs@^10.44.0
```

### Total new packages: 5

| Package | Type | Size Impact | Why |
|---------|------|-------------|-----|
| `@sentry/nestjs` | prod | ~2MB | Error tracking + tracing (replaces hand-rolled filter) |
| `@prisma/instrumentation` | prod | ~200KB | Query tracing via Sentry OTel |
| `testcontainers` | dev | ~5MB | Real DB integration tests |
| `fast-check` | dev | ~1MB | FSM property-based testing |
| `@sentry/nextjs` | prod | ~3MB | Frontend error tracking |

---

## Stack Diagram After Hardening

```
                         FRONTEND (Next.js 14)
  +----------------------------------------------------------+
  |  error.tsx (per-route)  |  ErrorBoundary (per-widget)     |
  |  @sentry/nextjs         |  Sentry session replay          |
  +----------------------------------------------------------+
                              |
                         BACKEND (NestJS 11)
  +----------------------------------------------------------+
  |  @sentry/nestjs                                           |
  |    - SentryModule.forRoot()                               |
  |    - @SentryTraced() on critical services                 |
  |    - @SentryCron() on scheduled tasks                     |
  |  @prisma/instrumentation -> Sentry OTel spans             |
  +----------------------------------------------------------+
  |  EXISTING (unchanged)                                     |
  |    - HttpExceptionFilter + PrismaExceptionFilter          |
  |    - PerformanceInterceptor + MetricsService (Prometheus) |
  |    - LoggingInterceptor + AuditLogInterceptor             |
  |    - RolesGuard + @Roles() (audit coverage, not replace)  |
  |    - @nestjs/throttler (add decorators, not replace)      |
  +----------------------------------------------------------+
                              |
                         TESTING
  +----------------------------------------------------------+
  |  testcontainers (PostgreSQL 15 + Redis 7 containers)      |
  |  fast-check (FSM property-based testing)                  |
  |  EXISTING: Jest 29, Vitest 4, Playwright 1.58, supertest  |
  +----------------------------------------------------------+
```

---

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| @sentry/nestjs | HIGH | Official SDK, verified on npm (v10.44.0), NestJS docs recommend it |
| @sentry/nextjs | HIGH | Official SDK, same version line as backend |
| testcontainers | HIGH | v11.13.0 on npm, widely used, Docker support in CI confirmed |
| @prisma/instrumentation | MEDIUM | Official Prisma package but requires Sentry OTel setup; integration complexity moderate |
| fast-check | MEDIUM | Well-established (v3.22.0) but custom FSM test harness must be built |
| RBAC audit script | HIGH | No external deps, uses existing TypeScript compiler API |
| error.tsx convention | HIGH | Built into Next.js 14, no packages needed |

---

## Sources

- [Sentry NestJS SDK](https://docs.sentry.io/platforms/javascript/guides/nestjs/) - HIGH confidence
- [NestJS Sentry recipe](https://docs.nestjs.com/recipes/sentry) - HIGH confidence
- [npm @sentry/nestjs v10.44.0](https://www.npmjs.com/package/@sentry/nestjs) - HIGH confidence
- [Prisma OpenTelemetry tracing](https://www.prisma.io/docs/orm/prisma-client/observability-and-logging/opentelemetry-tracing) - MEDIUM confidence
- [Prisma query optimization docs](https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance) - HIGH confidence
- [Testcontainers for Node.js](https://node.testcontainers.org/) - HIGH confidence
- [npm testcontainers v11.13.0](https://www.npmjs.com/package/testcontainers) - HIGH confidence
- [fast-check npm](https://www.npmjs.com/package/fast-check) - MEDIUM confidence
- [Next.js error handling](https://nextjs.org/docs/app/getting-started/error-handling) - HIGH confidence
- [NestJS exception filters](https://docs.nestjs.com/exception-filters) - HIGH confidence
- [NestJS testing docs](https://docs.nestjs.com/fundamentals/testing) - HIGH confidence

---

*Stack research: 2026-03-18*
