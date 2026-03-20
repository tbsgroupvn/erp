---
phase: 09-test-suite-completion
plan: 02
subsystem: testing
tags: [jest, nestjs, auth, general-ledger, throttler, rbac, file-validation, regression]

# Dependency graph
requires:
  - phase: 09-test-suite-completion/01
    provides: Order module unit test patterns (NestJS TestingModule, mock providers)
  - phase: 04-input-validation-rate-limiting
    provides: CustomThrottlerGuard, FileValidationPipe implementations to test
  - phase: 05-rbac-audit-coverage
    provides: RolesGuard DomainException upgrade to test
provides:
  - AuthService verifyLoginOtp and refreshToken unit tests (8 cases)
  - GeneralLedgerService createJournalEntry and closePeriod unit tests (9 cases)
  - CustomThrottlerGuard regression spec (4 tests)
  - FileValidationPipe regression spec (5 tests)
  - RolesGuard regression spec (5 tests)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Object.create(Prototype) for testing guards without constructor DI"
    - "Encrypted TOTP secret test helper matching constructor key derivation"

key-files:
  created:
    - tbs-erp-backend/src/modules/general-ledger/general-ledger.service.spec.ts
    - tbs-erp-backend/src/common/guards/custom-throttler.guard.spec.ts
    - tbs-erp-backend/src/common/pipes/file-validation.pipe.spec.ts
    - tbs-erp-backend/src/core/rbac/guards/roles.guard.spec.ts
  modified:
    - tbs-erp-backend/src/core/auth/auth.service.spec.ts

key-decisions:
  - "Object.create(CustomThrottlerGuard.prototype) to test overridden methods without ThrottlerGuard constructor DI"
  - "createEncryptedSecret() helper replicates AuthService constructor's PBKDF2 key derivation for test TOTP secrets"
  - "bcrypt.compare/hash mocked via jest.spyOn for refreshToken rotation tests"

patterns-established:
  - "Guard regression tests use direct prototype instantiation when constructor requires injected dependencies"
  - "Pipe regression tests use direct new instantiation with config object"

requirements-completed: [TEST-02, TEST-03, TEST-04]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 9 Plan 02: Auth/GL Unit Tests and Phase 4-5 Regression Specs Summary

**AuthService extended with verifyLoginOtp (3 cases) + refreshToken (5 cases), GeneralLedgerService spec created (9 cases), and 3 regression specs for CustomThrottlerGuard, FileValidationPipe, RolesGuard (14 cases total) -- 49 tests passing across 5 suites**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T00:36:54Z
- **Completed:** 2026-03-20T00:38:16Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extended AuthService spec with verifyLoginOtp (valid OTP, expired token, wrong token type) and refreshToken (valid session, not found, expired, token mismatch, inactive user) -- 8 new test cases
- Created GeneralLedgerService spec covering createJournalEntry (balanced, unbalanced, <2 lines, zero line, invalid account, inactive account, closed period) and closePeriod (open, already closed) -- 9 test cases
- Created 3 regression specs for Phase 4-5 hardening: CustomThrottlerGuard (4 tests), FileValidationPipe (5 tests), RolesGuard (5 tests) -- all verifying DomainException error codes

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend AuthService spec + create GeneralLedgerService spec** - `73cb5d4` (test)
2. **Task 2: Regression specs for Phase 4-5 guards and pipes** - `b2cbd70` (test)

**Plan metadata:** (pending)

## Files Created/Modified
- `tbs-erp-backend/src/core/auth/auth.service.spec.ts` - Extended with verifyLoginOtp (3 cases) and refreshToken (5 cases)
- `tbs-erp-backend/src/modules/general-ledger/general-ledger.service.spec.ts` - New: createJournalEntry (7 cases) + closePeriod (2 cases)
- `tbs-erp-backend/src/common/guards/custom-throttler.guard.spec.ts` - New: WS bypass, userId/IP tracker, RATE_LIMIT_EXCEEDED DomainException
- `tbs-erp-backend/src/common/pipes/file-validation.pipe.spec.ts` - New: valid file, null, undefined, FILE_TOO_LARGE, FILE_TYPE_NOT_ALLOWED
- `tbs-erp-backend/src/core/rbac/guards/roles.guard.spec.ts` - New: no decorator, empty roles, valid role, no user FORBIDDEN, wrong role FORBIDDEN

## Decisions Made
- Object.create(CustomThrottlerGuard.prototype) used to test overridden methods without ThrottlerGuard constructor DI dependencies
- createEncryptedSecret() helper replicates AuthService constructor PBKDF2 key derivation for test TOTP secrets
- bcrypt.compare/hash mocked via jest.spyOn for refreshToken rotation tests

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 31 hardening requirements complete (TEST-02, TEST-03, TEST-04 marked done)
- Full test suite passing: 49 tests across 5 spec files for this plan
- Milestone hardening complete -- all 9 phases, 24 plans executed

## Self-Check: PASSED

All 5 spec files verified on disk. Both task commits (73cb5d4, b2cbd70) confirmed in git log. SUMMARY.md created at expected path.

---
*Phase: 09-test-suite-completion*
*Completed: 2026-03-20*
