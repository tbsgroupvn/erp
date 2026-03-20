---
phase: 1
slug: backend-error-standardization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `tbs-erp-backend/jest.config.ts` or `package.json` jest section |
| **Quick run command** | `npm test -- --testPathPattern='error\|filter\|exception' --bail` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern='error\|filter\|exception' --bail`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | ERR-01 | unit | `npm test -- --testPathPattern='domain-exception'` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | ERR-01 | unit | `npm test -- --testPathPattern='error-code'` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | ERR-02 | unit | `npm test -- --testPathPattern='http-exception.filter'` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | ERR-03 | unit | `npm test -- --testPathPattern='ws.gateway'` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 2 | ERR-06 | unit | `npm test -- --testPathPattern='processor'` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tbs-erp-backend/src/common/exceptions/__tests__/` — test stubs for domain exceptions and error codes
- [ ] `tbs-erp-backend/src/common/filters/__tests__/` — test stubs for exception filters
- [ ] Existing jest infrastructure covers framework install

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sentry breadcrumb contains requestId | ERR-06 | Requires Sentry DSN and live capture | 1. Trigger 500 error 2. Check Sentry dashboard for requestId tag |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
