# TBS Order ERP

## What This Is

TBS Order ERP is an internal enterprise resource planning system for a Vietnamese cross-border trade company. It manages the full order lifecycle from customer consultation through sourcing, shipping (China->Vietnam), customs, warehousing, and delivery — with integrated finance, HR, CRM, and logistics modules. The system has been hardened with standardized error handling, verified RBAC for all 22 roles, bulletproofed FSMs, and comprehensive business rule enforcement.

## Core Value

The order lifecycle (17+ statuses across 9 FSMs) must be bulletproof — no state can be skipped, no unauthorized role can mutate data, and no query can bottleneck under production load.

## Requirements

### Validated

- ✓ Order-centric data model with 95+ Prisma models across 17 schema files — existing
- ✓ 9 FSM state machines enforcing blocking flow — existing
- ✓ 22-role RBAC with data scoping (CEO->all, Sales->own customers) — existing
- ✓ JWT auth (15min access + 7d refresh) with TOTP 2FA — existing
- ✓ BullMQ async job processing for finance events, notifications — existing
- ✓ Redis caching + WebSocket real-time updates — existing
- ✓ Repository pattern (Controller -> Service -> Repository -> Prisma) — existing
- ✓ Real vs Declared weight separation (cnWeight/vnWeight) — existing
- ✓ Soft deletes with audit logging on all CRUD — existing
- ✓ Next.js 14 App Router frontend with shadcn/ui + Zustand + TanStack Query — existing
- ✓ Docker + Nginx deployment infrastructure — existing
- ✓ Workplace modules (Chat, Calendar, Company Feed, Drive) — existing
- ✓ Standardized error handling (DomainException + 50+ error codes + correlation IDs) — v1.0
- ✓ Frontend error boundaries + Vietnamese toast notifications — v1.0
- ✓ TransactionalEmitter for outbox-safe event emission — v1.0
- ✓ Graceful shutdown (30s BullMQ worker drain + WebSocket close + Prisma disconnect) — v1.0
- ✓ HTML sanitization (@SanitizeHtmlStrict) on all user text fields — v1.0
- ✓ File upload validation (size + MIME type) — v1.0
- ✓ Rate limiting (CustomThrottlerGuard, 60 req/min global) — v1.0
- ✓ @Roles/@Public on every controller endpoint — v1.0
- ✓ Automated RBAC audit integration test — v1.0
- ✓ NxN exhaustive FSM transition matrix tests (all 9 FSMs, 640+ assertions) — v1.0
- ✓ Order + container lifecycle integration tests — v1.0
- ✓ Deposit gate enforcement (4 tiers: NEW=100%, REGULAR=70%, VIP=50%, STRATEGIC=30%) — v1.0
- ✓ Anti-fraud checks (missing order code, closed orders, missing docs, revenue threshold) — v1.0
- ✓ AR aging auto-block (90 days -> block new orders + delivery) — v1.0
- ✓ COD enforcement (24h submission deadline) — v1.0
- ✓ Approval escalation (SLA-based auto-escalation) — v1.0
- ✓ Select projections on list endpoints (no N+1) — v1.0
- ✓ Structured NestJS logger (zero console.log in production) — v1.0
- ✓ Slow query detection (500ms threshold + EXPLAIN plan logging) — v1.0
- ✓ Unit tests for OrderService, AuthService, GeneralLedgerService — v1.0
- ✓ Phase 4-5 regression specs (throttler, file validation, roles guard) — v1.0

### Active

(None yet — define in next milestone)

### Out of Scope

- Third-party integration implementation (tracking, shipping, banking stubs) — separate milestone
- Field-level encryption (PrismaEncryptionProvider) — requires dedicated security milestone
- Mobile app development — web-first
- Microservices extraction — strengthen boundaries only
- Chaos testing — need higher test coverage first

## Context

**Current state (post v1.0):**
- 31/31 hardening requirements satisfied
- 8 tech debt items accepted (see MILESTONES.md)
- All database indexes verified present in Prisma schema

**Remaining known issues:**
- Tracking provider stubs (Kuaidi100, 17Track) returning empty arrays
- Shipping carrier integrations (GHTK, GHN, ViettelPost) throwing NotImplementedException
- Email/SMS notifications using console.log only
- PrismaEncryptionProvider is non-functional stub
- Document soft-delete without S3 storage cleanup
- Newsletter export not implemented

**Architecture layers:**
- Presentation: NestJS controllers + WebSocket gateway
- Application: Service layer with business logic
- Domain: FSMs, validators, calculators
- Repository: Prisma query abstraction
- Infrastructure: Auth, Cache, Queue, Metrics, Storage, Logger, Email
- Common: Guards, Filters, Interceptors, Pipes, Decorators

**Tech stack:** NestJS 11 + Prisma 6 + PostgreSQL 15 + Redis 7 + Next.js 14 + React 18 + TypeScript 5.7

## Constraints

- **Backward compatible**: All changes must preserve existing functionality
- **Test coverage**: Critical changes must include test verification

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hardening before new features | System stability is prerequisite for feature velocity | ✓ Good — 31 requirements shipped in 3 days |
| Full-stack error handling | Consistent UX requires both BE and FE standardization | ✓ Good — DomainException + error boundaries + Vietnamese toasts |
| ErrorCode as const object (not enum) | Runtime flexibility and tree-shaking | ✓ Good — 50+ codes, easy to extend |
| TransactionalEmitter collector pattern | Zero coupling vs Prisma middleware approach | ✓ Good — clean deferred emit after tx commit |
| EXPLAIN (not EXPLAIN ANALYZE) for slow queries | Production safety — no re-execution | ✓ Good — sufficient for diagnostics |
| NxN exhaustive FSM tests (not sampling) | Mathematically complete coverage | ✓ Good — caught 4 pre-existing transition bugs |
| Manual service instantiation in tests | Test isolation without TestingModule overhead | ✓ Good — adopted in Phases 6-9 |

---
*Last updated: 2026-03-20 after v1.0 milestone*
