---
phase: 8
slug: query-performance-optimization
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-19
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | grep-based checks + TypeScript compilation |
| **Config file** | `tbs-erp-backend/package.json` |
| **Quick run command** | `npx tsc --noEmit --pretty 2>&1 \| head -30` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run grep-based pattern checks
- **After every plan wave:** Run `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** TypeScript compilation must pass
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | PERF-01 | grep | `grep -n "select:" src/modules/container/container.repository.ts` | yes | pending |
| 08-01-02 | 01 | 1 | PERF-04 | grep | `grep -n "500\|SLOW_QUERY_THRESHOLD" src/core/database/prisma.service.ts` | yes | pending |
| 08-02-01 | 02 | 1 | PERF-02 | grep | `grep -n "@@index" prisma/schema/order.prisma` | yes | pending |
| 08-02-02 | 02 | 1 | PERF-03 | grep | `grep -rn "console.log" src/ --include="*.ts" \| grep -v spec \| grep -v script` | yes | pending |

---

## Wave 0 Requirements

- [x] All files being modified already exist — no Wave 0 dependencies

---

## Manual-Only Verifications

*All phase behaviors have automated verification via grep/tsc checks.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify
- [x] Sampling continuity
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated
