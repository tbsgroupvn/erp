# TBS Order ERP — Hardening & Quality

## What This Is

TBS Order ERP is an internal enterprise resource planning system for a Vietnamese cross-border trade company. It manages the full order lifecycle from customer consultation through sourcing, shipping (China→Vietnam), customs, warehousing, and delivery — with integrated finance, HR, CRM, and logistics modules. This milestone focuses on hardening the existing system: finding and fixing bugs, standardizing error handling, optimizing database performance, verifying RBAC coverage, and validating the core order workflow FSM.

## Core Value

The order lifecycle (17+ statuses across 9 FSMs) must be bulletproof — no state can be skipped, no unauthorized role can mutate data, and no query can bottleneck under production load.

## Requirements

### Validated

- ✓ Order-centric data model with 95+ Prisma models across 17 schema files — existing
- ✓ 9 FSM state machines enforcing blocking flow (Order, Supplier Order, Container, Quotation, Complaint, Payment Voucher, Warehouse CN, Warehouse VN, Customs) — existing
- ✓ 22-role RBAC with data scoping (CEO→all, Sales→own customers) — existing
- ✓ JWT auth (15min access + 7d refresh) with TOTP 2FA — existing
- ✓ BullMQ async job processing for finance events, notifications — existing
- ✓ Redis caching + WebSocket real-time updates — existing
- ✓ Repository pattern (Controller → Service → Repository → Prisma) — existing
- ✓ Real vs Declared weight separation (cnWeight/vnWeight) — existing
- ✓ Soft deletes with audit logging on all CRUD — existing
- ✓ Next.js 14 App Router frontend with shadcn/ui + Zustand + TanStack Query — existing
- ✓ Docker + Nginx deployment infrastructure — existing
- ✓ Workplace modules (Chat, Calendar, Company Feed, Drive) — existing

### Active

- [ ] Bug regression scan & fix across entire codebase
- [ ] Full-stack error handling standardization (BE exception filters + FE error boundaries)
- [ ] Prisma query performance audit & optimization (N+1, missing indexes, slow joins)
- [ ] RBAC verification for all 22 roles across all endpoints
- [ ] Order FSM workflow verification (17+ statuses, all transitions, edge cases)

### Out of Scope

- New feature development — this milestone is hardening only
- Third-party integration implementation (tracking, shipping, banking stubs) — separate milestone
- Field-level encryption (PrismaEncryptionProvider) — requires dedicated security milestone
- Mobile app development — web-first
- Database schema changes — fix code, not schema

## Context

**Known issues from codebase scan (.planning/codebase/CONCERNS.md):**
- Tracking provider stubs (Kuaidi100, 17Track) returning empty arrays
- Shipping carrier integrations (GHTK, GHN, ViettelPost) throwing NotImplementedException
- Email/SMS notifications using console.log only
- PrismaEncryptionProvider is non-functional stub
- Document soft-delete without S3 storage cleanup
- Missing complaint throttling (DoS risk)
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

- **No schema changes**: Fix code behavior, not database structure
- **No API contract changes**: Existing frontend must continue working
- **Backward compatible**: All fixes must preserve existing functionality
- **Test coverage**: Critical fixes must include test verification

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hardening before new features | System stability is prerequisite for feature velocity | — Pending |
| Full-stack error handling | Consistent UX requires both BE and FE standardization | — Pending |
| Audit-first approach for performance | No known bottlenecks yet, systematic scan needed | — Pending |

---
*Last updated: 2026-03-18 after initialization*
