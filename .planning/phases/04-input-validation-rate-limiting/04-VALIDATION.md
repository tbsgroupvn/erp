---
phase: 4
slug: input-validation-rate-limiting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 4 — Validation Strategy

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
- **Before `/gsd:verify-work`:** Full TypeScript compilation must pass
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | SEC-04 | grep | `grep -n "APP_GUARD.*ThrottlerGuard" src/app.module.ts` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 2 | SEC-05 | grep | `grep -rn "@SanitizeHtml" src/modules/ \| wc -l` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 2 | SEC-06 | grep | `grep -rn "FileValidationPipe\|fileFilter" src/modules/ \| wc -l` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing TypeScript infrastructure covers compilation checks
- No additional test framework needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rate limit returns 429 with Retry-After header | SEC-04 | Requires live HTTP requests | 1. Send 6 complaint requests in 1 hour 2. Verify 6th returns 429 |
| Script tags sanitized in stored text | SEC-05 | Requires DB inspection | 1. Submit comment with `<script>alert(1)</script>` 2. Verify stored text has no script tag |
| Oversized file upload rejected | SEC-06 | Requires file upload | 1. Upload 15MB PDF to document endpoint 2. Verify 413/400 with FILE_TOO_LARGE error |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
