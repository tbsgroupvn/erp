# Milestones

## v1.0 Hardening & Quality (Shipped: 2026-03-20)

**Phases completed:** 9 phases, 24 plans, 48 tasks
**Timeline:** 3 days (2026-03-18 to 2026-03-20)
**Execution time:** ~1.67 hours total
**Requirements:** 31/31 satisfied

**Key accomplishments:**
- Standardized all backend errors to DomainException with 50+ error codes, correlation IDs, and Sentry integration
- Added error boundaries at all route levels + Vietnamese toast notifications preventing white-screen crashes
- Implemented TransactionalEmitter for outbox-safe event emission + graceful shutdown with 30s worker drain
- Applied HTML sanitization on all text fields, file upload validation, and rate limiting (60 req/min global)
- Verified RBAC for all 22 roles with @Roles/@Public on every controller + automated audit integration test
- Bulletproofed all 9 FSMs with NxN exhaustive transition matrix tests (640+ assertions)
- Enforced deposit gates (4 tiers), anti-fraud checks, AR aging auto-block, COD enforcement, and approval escalation
- Optimized query performance with select projections, verified indexes, structured logging, and slow query detection
- Created unit test coverage for OrderService, AuthService, GeneralLedgerService + Phase 4-5 regression specs

**Tech debt accepted:**
- 3 missing frontend error message mappings (RATE_LIMIT_EXCEEDED, FILE_TOO_LARGE, FILE_TYPE_NOT_ALLOWED)
- FSM assertTransition throws BadRequestException instead of DomainException
- Integration tests excluded from default jest run (needs npm run test:integration)
- RBAC audit integration test has soft enforcement

---

