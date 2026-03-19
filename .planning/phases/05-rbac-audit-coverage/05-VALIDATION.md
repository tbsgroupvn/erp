---
phase: 5
slug: rbac-audit-coverage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x + grep-based checks |
| **Config file** | `tbs-erp-backend/package.json` |
| **Quick run command** | `npx jest --testPathPattern='rbac-audit' --no-coverage -x` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run grep-based pattern checks
- **After every plan wave:** Run `npx jest --testPathPattern='rbac' --no-coverage`
- **Before `/gsd:verify-work`:** RBAC audit test must pass
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | SEC-01 | grep | `grep -rn "@Roles\|@Public" src/modules/ \| wc -l` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 2 | SEC-02 | unit | `npx jest --testPathPattern='rbac-audit' --no-coverage -x` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | SEC-03 | grep | `grep -n "DataScopeService\|applyScopeFilter" src/modules/crm/` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] RBAC audit test file created inline via TDD tasks

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sales user sees only own customers | SEC-03 | Requires authenticated API call with specific role | 1. Login as SALE user 2. GET /customers 3. Verify only own customers returned |
| CEO sees all customers | SEC-03 | Requires authenticated API call | 1. Login as CEO 2. GET /customers 3. Verify all customers returned |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
