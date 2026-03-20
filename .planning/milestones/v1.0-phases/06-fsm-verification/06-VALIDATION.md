---
phase: 6
slug: fsm-verification
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-19
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `tbs-erp-backend/package.json` jest section |
| **Quick run command** | `npx jest --testPathPattern='status.machine.spec' --no-coverage -x` |
| **Full suite command** | `npx jest --testPathPattern='(status.machine\|lifecycle.integration)' --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern='{modified-spec}' --no-coverage -x`
- **After every plan wave:** Run full FSM + lifecycle test suite
- **Before `/gsd:verify-work`:** All FSM spec files + lifecycle tests must pass
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | DAT-03 | unit | `npx jest --testPathPattern='status.machine.spec' --no-coverage` | ✅ (extend) | ⬜ pending |
| 06-02-01 | 02 | 1 | DAT-04 | integration | `npx jest --testPathPattern='order-lifecycle' --no-coverage` | ❌ (self-created) | ⬜ pending |
| 06-02-02 | 02 | 1 | DAT-05 | integration | `npx jest --testPathPattern='container-lifecycle' --no-coverage` | ❌ (self-created) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] FSM spec files already exist for all 9 FSMs — tasks extend them with exhaustive matrices
- [x] Lifecycle integration test files are self-created by Plan 02 tasks

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated
