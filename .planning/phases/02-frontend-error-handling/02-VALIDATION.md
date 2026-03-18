---
phase: 2
slug: frontend-error-handling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + grep-based checks |
| **Config file** | `tbs-erp-frontend/package.json` |
| **Quick run command** | `grep -rn "toast.error" tbs-erp-frontend/src/lib/hooks/ \| wc -l` |
| **Full suite command** | `cd tbs-erp-frontend && npx next build` |
| **Estimated runtime** | ~60 seconds (build check) |

---

## Sampling Rate

- **After every task commit:** Run grep-based existence checks
- **After every plan wave:** Run `npx next build` to verify no compilation errors
- **Before `/gsd:verify-work`:** Full build must succeed
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | ERR-04 | file-check | `test -f tbs-erp-frontend/src/app/global-error.tsx` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | ERR-04 | file-check | `test -f tbs-erp-frontend/src/app/(dashboard)/error.tsx` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | ERR-05 | grep | `grep -rn "parseApiError\|getErrorMessage" tbs-erp-frontend/src/lib/` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | ERR-05 | grep | `grep -c "onError" tbs-erp-frontend/src/lib/providers/query-provider.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing build infrastructure covers framework install
- No test framework needed — validation via file existence, grep, and build checks

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard error page shows retry UI (not white screen) | ERR-04 | Requires rendering a broken component | 1. Add `throw new Error('test')` to a dashboard page 2. Navigate to it 3. Verify error UI shows with retry button |
| Public error page shows branded design | ERR-04 | Requires visual inspection | 1. Add `throw new Error('test')` to a public page 2. Navigate to it 3. Verify branded error page (not Next.js default) |
| API error shows Vietnamese toast | ERR-05 | Requires API call failure | 1. Trigger a known API error 2. Verify toast with Vietnamese message appears 3. Verify requestId shown in toast |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
