---
phase: 3
slug: transaction-consistency
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x + grep-based checks |
| **Config file** | `tbs-erp-backend/package.json` jest section |
| **Quick run command** | `npx jest --testPathPattern='transactional-emitter\|graceful-shutdown' --no-coverage -x` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run grep-based existence/pattern checks
- **After every plan wave:** Run `npx jest --no-coverage` for full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | DAT-02 | unit | `npx jest --testPathPattern='transactional-emitter' --no-coverage -x` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | DAT-01 | grep | `grep -rn "executeInTransaction\|\\$transaction" [target files]` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 2 | DAT-06 | unit | `npx jest --testPathPattern='graceful-shutdown' --no-coverage -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tbs-erp-backend/src/core/events/__tests__/transactional-emitter.spec.ts` — test stubs for deferred emit
- [ ] `tbs-erp-backend/src/core/shutdown/__tests__/graceful-shutdown.spec.ts` — test stubs for shutdown orchestration

*TDD tasks will create these inline.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SIGTERM completes in-flight BullMQ jobs | DAT-06 | Requires running process + signal | 1. Start backend 2. Enqueue a slow job 3. Send SIGTERM 4. Verify job completes and process exits cleanly |
| Transaction rollback on mid-operation failure | DAT-01 | Requires database state inspection | 1. Trigger order status change 2. Simulate failure mid-transaction 3. Verify no partial state in DB |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
