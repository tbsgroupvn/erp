# TBS ERP -- RICE Prioritization Report

> **Date**: 2026-03-21
> **Methodology**: RICE Framework (Reach x Impact x Confidence / Effort)
> **Scope**: Top 15 features/improvements identified from codebase analysis, security audit, and architecture review
> **Project**: TBS ORDER ERP (NestJS + Next.js 14 + PostgreSQL)

---

## Scoring Legend

| Factor | Scale | Description |
|--------|-------|-------------|
| **Reach** | 1-10 | Number of users/roles affected per quarter (1 = 1 role, 10 = all 22 roles + external) |
| **Impact** | 0.25 / 0.5 / 1 / 2 / 3 | Minimal / Low / Medium / High / Massive |
| **Confidence** | 50% / 80% / 100% | Low / Medium / High certainty in estimates |
| **Effort** | 1-10 | Person-weeks required (1 = 1 day, 10 = 10+ weeks) |
| **RICE Score** | (R x I x C) / E | Higher = higher priority |

---

## RICE Prioritization Table

| # | Feature / Improvement | Reach | Impact | Confidence | Effort | RICE Score | Category |
|---|----------------------|-------|--------|------------|--------|------------|----------|
| 1 | **P0 Security: Fix encryption stub + rotate keys** (CF-01/02) | 10 | 3 | 1.0 | 2 | **15.00** | Security |
| 2 | **P0 Security: Fix IDOR on CRM + add DataScopeGuard** (BAC-01/08) | 8 | 3 | 1.0 | 1.5 | **16.00** | Security |
| 3 | **P0 Security: Fix JWT 7d lifetime + file upload security** (CF-03, SDI-01/02/03) | 10 | 3 | 1.0 | 2 | **15.00** | Security |
| 4 | **P0 Security: Remove iframe XSS from sanitizeHtml + add URI whitelist** (INJ-01/02/03) | 10 | 3 | 1.0 | 1 | **30.00** | Security |
| 5 | **Document controller: Add @Roles + DataScopeGuard** (BAC-02/03) | 10 | 2 | 1.0 | 1 | **20.00** | Security |
| 6 | **Unallocated Funds: Build frontend UI** | 4 | 2 | 0.8 | 3 | **2.13** | Feature Gap |
| 7 | **Cost Adjustment: Build frontend UI** | 5 | 2 | 0.8 | 3 | **2.67** | Feature Gap |
| 8 | **Carrier Reconciliation: Build frontend UI** | 4 | 2 | 0.8 | 4 | **1.60** | Feature Gap |
| 9 | **Lost & Found: Build frontend UI** | 3 | 1 | 0.8 | 3 | **0.80** | Feature Gap |
| 10 | **Data Retention / GDPR Compliance: Build frontend UI** | 2 | 2 | 0.8 | 3 | **1.07** | Feature Gap |
| 11 | **Order controller refactoring** (600 lines, F quality) | 8 | 1 | 0.8 | 4 | **1.60** | Tech Debt |
| 12 | **CRM controller refactoring** (315 lines, missing DataScopeGuard) | 7 | 1 | 0.8 | 3 | **1.87** | Tech Debt |
| 13 | **Customer credit control: Build dedicated management UI** | 6 | 2 | 0.8 | 4 | **2.40** | Feature Gap |
| 14 | **QuickQuote: Complete MHH pricing model on frontend** | 6 | 2 | 0.8 | 2 | **4.80** | Feature Gap |
| 15 | **P1 Security: Auth hardening** (brute-force backoff, SMS OTP TOCTOU, rate limits) | 10 | 2 | 0.8 | 3 | **5.33** | Security |

---

## Sorted by RICE Score (Descending)

| Rank | Feature / Improvement | RICE Score | Category | Recommendation |
|------|----------------------|------------|----------|----------------|
| **1** | **Fix frontend XSS: remove iframe + style from sanitizeHtml, add ALLOWED_URI_REGEXP** | **30.00** | Security | Quickest security win. Single-file fix in `sanitize-html.ts`. Deploy immediately. Remove `iframe`, `video` from ALLOWED_TAGS, remove `style` from ALLOWED_ATTR, add `ALLOWED_URI_REGEXP: /^(https?\|mailto\|tel\|#):/i`. |
| **2** | **Document controller: add @Roles() + DataScopeGuard to all GET endpoints** | **20.00** | Security | Currently any authenticated user can read ALL documents (contracts, customs, financials). Add proper role decorators and row-level filtering via DataScopeService. Single controller change, ~30min fix. |
| **3** | **Fix CRM IDOR + add DataScopeGuard** | **16.00** | Security | SALE users can currently modify any customer via PATCH /customers/:id. Add ownership verification and DataScopeGuard to CrmController. Also blocks customer data leakage between branches. |
| **4** | **Activate field-level encryption + rotate committed keys** | **15.00** | Security | PII (phone, email, bankAccount, taxCode) stored in plaintext. Encryption extension exists but was never activated in PrismaService. Rotate all keys committed to git history. Highest DREAD score (14-15). |
| **5** | **Fix JWT 7d access token + file upload MIME/size validation** | **15.00** | Security | JWT lifetime must be reduced from 7d to 15m. Add MIME type whitelist and 50MB max file size to upload DTO. Both are config/DTO changes with immediate security ROI. |
| **6** | **Auth hardening: brute-force backoff, SMS OTP fix, rate limiting** | **5.33** | Security | Fix TOCTOU in SMS OTP (extract userId from JWT, not body). Add exponential backoff to login. Add @MaxLength on LoginDto. Rate-limit public endpoints. Multiple small fixes across auth module. |
| **7** | **QuickQuote: Complete MHH pricing model on frontend** | **4.80** | Feature Gap | Backend has full MHH price calculator (`mhh-price-calculator.service.ts`) and QuickQuote endpoint. Frontend drawer exists (`quick-quote-drawer.tsx`) with VCT support. MHH mode needs product sourcing line items, vendor selection, and sourcing fee breakdown in the UI. Sales team (6+ roles) uses this daily. |
| **8** | **Cost Adjustment: Build frontend management UI** | **2.67** | Feature Gap | Backend has full CRUD with approval workflow (create/approve/reject + GL entry + commission recalculation). No frontend page exists. Accountants currently have no way to access this. Build page at `/tai-chinh/dieu-chinh-chi-phi` with DataTable + approval actions. |
| **9** | **Customer credit control: Build dedicated management UI** | **2.40** | Feature Gap | Backend has `CreditOverdraftService` with temp overdraft, `credit-check.guard.ts`, credit limit fields. Customer detail page shows creditLimit and currentDebt but lacks: overdraft request UI, credit limit adjustment workflow, credit alerts dashboard. Build at `/khach-hang/han-muc-tin-dung`. |
| **10** | **Unallocated Funds: Build frontend management UI** | **2.13** | Feature Gap | Backend has list/claim/approve workflow for unmatched wallet transactions. Finance team has no UI to view or process these. Build page at `/tai-chinh/tien-chua-phan-bo` with transaction list + claim + approval flow. |
| **11** | **CRM controller refactoring: extract sub-controllers, add DataScopeGuard** | **1.87** | Tech Debt | 315 lines mixing customer CRUD, wallet ops, leads, analytics, interaction notes. Extract into `CustomerWalletController`, `LeadController`, `InteractionNoteController`. Also resolves BAC-08 (missing DataScopeGuard). |
| **12** | **Order controller refactoring** | **1.60** | Tech Debt | 600 lines, largest controller in the codebase. Mixes order CRUD, status transitions, cancellation, return requests, deposit gate, 3-way matching, MHH pricing. Extract domain sub-controllers: `OrderStatusController`, `OrderCancellationController`, `OrderFinanceController`. |
| **13** | **Carrier Reconciliation: Build frontend management UI** | **1.60** | Feature Gap | Backend supports file upload (GHTK, GHN, Viettel Post, J&T), auto-matching, exception handling, and confirmation with COD wallet credit. Accountants need UI at `/tai-chinh/doi-soat-van-chuyen` with file upload, match results table, exception resolution panel. Most complex frontend of the 5 missing UIs. |
| **14** | **Data Retention / GDPR Compliance: Build frontend admin UI** | **1.07** | Feature Gap | Backend has policy listing, manual execution, user data export (ND 13/2023 Article 14), and anonymization (Article 16). Only CEO/COO access. Low reach but legally required for Vietnamese data protection compliance. Build minimal admin page at `/cai-dat/bao-luu-du-lieu`. |
| **15** | **Lost & Found: Build frontend management UI** | **0.80** | Feature Gap | Backend has item registration, matching, claiming, and disposal workflow. Used by warehouse staff only. Lower business impact but improves package traceability. Build page at `/kho-viet-nam/hang-that-lac` with item list + match/claim/dispose actions. |

---

## Scoring Rationale

### Security Items (Ranks 1-6)

Security fixes dominate the top of the list because:
- **Reach = 10**: Security vulnerabilities affect every user of the system
- **Impact = 2-3 (High/Massive)**: Exploitation leads to data breach, privilege escalation, or system compromise
- **Confidence = 1.0 (100%)**: Vulnerabilities are confirmed by code-level audit with reproducible attack vectors
- **Effort = 1-3**: Most fixes are surgical changes to specific files (DTOs, guards, config)

The XSS fix (Rank 1) scores highest because it requires changing a single file (`sanitize-html.ts`) while protecting all CMS/blog/wiki/feed content across the entire platform.

### Feature Gap Items (Ranks 7-15)

Five backend modules have no frontend UI: Lost & Found, Unallocated Funds, Cost Adjustment, Carrier Reconciliation, and Data Retention. Each has a complete backend API but zero frontend pages. Scoring factors:

- **Reach** varies by role count: Cost Adjustment impacts 11 roles, Lost & Found only 3 roles
- **Impact = 1-2**: Features work via Swagger/API but are unusable for non-technical staff
- **Confidence = 0.8**: Backend APIs are implemented and tested, reducing frontend risk
- **Effort = 2-4**: Standard CRUD pages with DataTable, forms, and status workflows

### Tech Debt Items (Ranks 11-12)

Controller refactoring scores lower because:
- **Impact = 1 (Medium)**: Code quality improvement, not new functionality
- No user-facing change until combined with security fixes (e.g., CRM DataScopeGuard)
- Order controller at 600 lines and CRM at 315 lines both exceed the recommended 150-line controller limit

---

## Implementation Roadmap

### Sprint 1 (Week 1) -- Security P0
- [ ] Fix XSS in sanitize-html.ts (Rank 1)
- [ ] Add @Roles to Document controller (Rank 2)
- [ ] Fix CRM IDOR + DataScopeGuard (Rank 3)
- [ ] Reduce JWT to 15min + file upload validation (Rank 5)

### Sprint 2 (Week 2) -- Security P0 + Quick Feature Win
- [ ] Activate encryption + rotate keys (Rank 4)
- [ ] Auth hardening bundle (Rank 6)
- [ ] QuickQuote MHH frontend completion (Rank 7)

### Sprint 3-4 (Weeks 3-4) -- Feature Gap Closure
- [ ] Cost Adjustment frontend UI (Rank 8)
- [ ] Customer credit control UI (Rank 9)
- [ ] Unallocated Funds frontend UI (Rank 10)

### Sprint 5-6 (Weeks 5-6) -- Tech Debt + Remaining Features
- [ ] CRM controller refactoring (Rank 11)
- [ ] Order controller refactoring (Rank 12)
- [ ] Carrier Reconciliation frontend UI (Rank 13)

### Sprint 7 (Week 7) -- Compliance + Housekeeping
- [ ] Data Retention admin UI (Rank 14)
- [ ] Lost & Found frontend UI (Rank 15)

---

## Key Files Referenced

### Security Fixes
- `tbs-erp-frontend/src/lib/utils/sanitize-html.ts` -- XSS fix
- `tbs-erp-backend/src/modules/document/document.controller.ts` -- @Roles fix
- `tbs-erp-backend/src/modules/crm/crm.controller.ts` -- IDOR + DataScopeGuard
- `tbs-erp-backend/src/core/database/prisma-encryption.provider.ts` -- Encryption activation
- `tbs-erp-backend/src/core/auth/dto/login.dto.ts` -- @MaxLength
- `tbs-erp-backend/.env.docker.example` -- JWT_EXPIRES_IN

### Backend Modules Missing Frontend UI
- `tbs-erp-backend/src/modules/lost-and-found/` -- 3 files, complete API
- `tbs-erp-backend/src/modules/unallocated-funds/` -- 3 files, complete API
- `tbs-erp-backend/src/modules/cost-adjustment/` -- 3 files, complete API with approval workflow
- `tbs-erp-backend/src/modules/carrier-reconciliation/` -- 3 files, file upload + reconciliation
- `tbs-erp-backend/src/modules/data-retention/` -- 3 files, GDPR/ND13 compliance

### Feature Enhancement
- `tbs-erp-frontend/src/components/shared/quick-quote-drawer.tsx` -- MHH mode completion
- `tbs-erp-frontend/src/features/orders/mhh-price-calculator.tsx` -- Existing MHH calculator
- `tbs-erp-backend/src/modules/crm/domain/credit-overdraft.service.ts` -- Credit control backend

---

*Report generated: 2026-03-21 | Based on codebase analysis, security audit (2026-03-17), and architecture review*
