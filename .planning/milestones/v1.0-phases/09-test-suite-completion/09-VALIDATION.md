---
phase: 9
slug: test-suite-completion
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-20
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `tbs-erp-backend/package.json` jest section |
| **Quick run command** | `npx jest --testPathPattern='(order.service\|auth.service\|general-ledger\|throttler\|file-validation\|roles.guard).spec' --no-coverage -x` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run jest for the modified spec file
- **After every plan wave:** Run full test suite
- **Before `/gsd:verify-work`:** All tests must pass
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | TEST-01 | unit | `npx jest --testPathPattern='order.service.spec' --no-coverage` | self-created | pending |
| 09-01-02 | 01 | 1 | TEST-02 | unit | `npx jest --testPathPattern='auth.service.spec' --no-coverage` | exists (extend) | pending |
| 09-02-01 | 02 | 1 | TEST-03 | unit | `npx jest --testPathPattern='general-ledger' --no-coverage` | self-created | pending |
| 09-02-02 | 02 | 1 | TEST-04 | unit | `npx jest --testPathPattern='(throttler\|file-validation\|roles.guard).spec' --no-coverage` | self-created | pending |

---

## Wave 0 Requirements

- [x] auth.service.spec.ts already exists — extended by Plan 01
- [x] All other spec files are self-created by plan tasks

---

## Manual-Only Verifications

*All phase behaviors have automated verification via jest tests.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify
- [x] Sampling continuity
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated
