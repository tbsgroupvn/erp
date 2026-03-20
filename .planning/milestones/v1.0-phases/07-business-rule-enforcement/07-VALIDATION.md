---
phase: 7
slug: business-rule-enforcement
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-19
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `tbs-erp-backend/package.json` jest section |
| **Quick run command** | `npx jest --testPathPattern='(deposit-gate\|voucher.validator\|credit-check\|cod\|escalation)' --no-coverage -x` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run targeted jest for modified spec files
- **After every plan wave:** Run full business rule test suite
- **Before `/gsd:verify-work`:** All business rule tests must pass
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | DAT-07 | unit | `npx jest --testPathPattern='deposit-gate' --no-coverage -x` | self-created | pending |
| 07-01-02 | 01 | 1 | DAT-08 | unit | `npx jest --testPathPattern='voucher.validator' --no-coverage -x` | self-created | pending |
| 07-02-01 | 02 | 1 | DAT-09 | unit | `npx jest --testPathPattern='credit-check\|delivery-dispatch' --no-coverage -x` | self-created | pending |
| 07-02-02 | 02 | 1 | DAT-10 | unit | `npx jest --testPathPattern='cod' --no-coverage -x` | self-created | pending |
| 07-03-01 | 03 | 1 | DAT-11 | unit | `npx jest --testPathPattern='escalation' --no-coverage -x` | self-created | pending |

---

## Wave 0 Requirements

- [x] All test files are self-created by plan tasks (no external Wave 0 dependencies)

---

## Manual-Only Verifications

*All phase behaviors have automated verification via unit tests.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify
- [x] Sampling continuity
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated
