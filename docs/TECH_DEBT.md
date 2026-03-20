# TBS ERP - Tech Debt Tracker

**Created:** 2026-03-20
**Source:** v1.0 Milestone Audit + Finance Audit findings
**Total open items:** 14
**Total fixed items (closed):** 5

---

## Summary by Severity

| Severity | Open | Fixed | Accepted |
|----------|------|-------|----------|
| HIGH     | 2    | 0     | 0        |
| MEDIUM   | 6    | 0     | 0        |
| LOW      | 6    | 5     | 1        |
| **Total**| **14** | **5** | **1**  |

---

## Prioritized Debt Table

| ID      | Severity | Category          | Description                                                                                                                                    | File(s)                                                                                                                                                  | Effort | Status   |
|---------|----------|-------------------|------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|--------|----------|
| TD-001  | HIGH     | Error Handling    | 3 frontend error message mappings missing: `RATE_LIMIT_EXCEEDED`, `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`. Toast falls back to generic message instead of specific Vietnamese text. Breaks 2 of 5 E2E flows. | `tbs-erp-frontend/src/lib/utils/error-messages.ts`                                                                                                       | S      | Open     |
| TD-002  | HIGH     | FSM / Domain Layer | `BaseStatusMachine.assertTransition` throws `BadRequestException` instead of `DomainException`. Error codes `ORDER_INVALID_TRANSITION` and `CONTAINER_INVALID_TRANSITION` are registered in the error registry but are never thrown. Breaks integration between FSM layer and Phase 1 error standardization (INT-02). | `tbs-erp-backend/src/common/domain/base-status-machine.ts`, `tbs-erp-backend/src/modules/order/domain/order-status.machine.ts`                          | S      | Open     |
| TD-003  | MEDIUM   | Testing / CI      | Integration test files (`order-lifecycle`, `container-lifecycle`, RBAC audit) are excluded from default Jest run via `testPathIgnorePatterns`. They will not execute on `npm test` or in a standard CI jest step. Requires dedicated `npm run test:integration` script that does not yet exist in `package.json`. | `tbs-erp-backend/package.json`, affected test files under `src/`                                                                                          | S      | Open     |
| TD-004  | MEDIUM   | Testing / RBAC    | RBAC audit integration test has soft enforcement: the strict `expect()` assertion is commented out and replaced with `expect(true).toBe(true)`, meaning the test always passes regardless of actual RBAC behaviour. Affects SEC-02. | RBAC audit integration test file (path in `testPathIgnorePatterns`)                                                                                      | M      | Open     |
| TD-005  | MEDIUM   | Finance / FX      | FX Revaluation does not store the original booking rate on AR/AP records at the time of invoice creation. `recordRealizedGainLoss` requires `bookingRate` to be passed by the caller, which means the rate is not authoritative and can drift if the caller uses a stale value. No migration or schema field exists to persist it at source. | `tbs-erp-backend/src/modules/general-ledger/exchange-rate-gl.service.ts`, `tbs-erp-backend/prisma/schema/finance.prisma`                                 | M      | Open     |
| TD-006  | MEDIUM   | Integration Stub  | Chinese carrier tracking providers (Kuaidi100, 17Track) return empty arrays. The circuit breaker and retry infrastructure is wired, but the actual HTTP calls are stubs. `fetchFromAnyProvider` always resolves with `{ provider: 'none', events: [] }` in production. | `tbs-erp-backend/src/modules/tracking/domain/tracking-provider.service.ts`                                                                               | L      | Open     |
| TD-007  | MEDIUM   | Integration Stub  | Vietnamese shipping carriers (GHTK, GHN, ViettelPost, J&T, VNPost, DHL, FedEx) throw `NotImplementedException` for `trackShipment`, `getRates`, and `bookPickup`. Gated behind `SHIPPING_INTEGRATION_ENABLED=false`. API credentials and carrier adapters are not implemented. | `tbs-erp-backend/src/modules/integration/shipping/shipping.service.ts`                                                                                   | L      | Open     |
| TD-008  | MEDIUM   | Integration Stub  | Email and SMS notification delivery are logger-only stubs. `callEmailProvider` logs a masked email and returns without sending. `callSmsProvider` logs a masked phone and returns without sending. Both paths have `withRetry` wiring but no actual provider (SES, SendGrid, Twilio, Zalo ZNS) integrated. | `tbs-erp-backend/src/modules/notification/notification.service.ts`                                                                                       | M      | Open     |
| TD-009  | LOW      | Code Quality      | Stale TODO comment in `complaint.service.ts`: `// TODO: Add @Throttle(...)`. The `@Throttle` decorator was already applied at the controller level. The service-level comment is misleading and should be removed. | `tbs-erp-backend/src/modules/complaint/complaint.service.ts`                                                                                             | S      | Open     |
| TD-010  | LOW      | Observability     | Slow query logger uses `EXPLAIN` instead of `EXPLAIN ANALYZE`. This is a deliberate production-safe choice (avoids executing the plan twice), documented in the plan key-decisions. Logged here for visibility in case future environments can tolerate the extra cost. | Query performance module / slow query detection (Phase 8)                                                                                                | S      | Accepted |
| TD-011  | LOW      | Frontend / DX     | `global-error.tsx` exports a component named `GlobalError` but the file is `app/global-error.tsx`, which Next.js treats as the top-level crash boundary. The naming is misleading but functionally correct. Additionally, `error.tsx` uses `window.location.reload()` instead of the Next.js `reset` prop — documented design decision, not a bug. | `tbs-erp-frontend/src/app/global-error.tsx`, `tbs-erp-frontend/src/app/error.tsx`                                                                        | S      | Open     |
| TD-012  | LOW      | Security / Crypto | `PrismaEncryptionProvider` is a non-functional stub. The `$extends()` call inside `onModuleInit` does not replace the injected PrismaService singleton, so PII field encryption/decryption has no effect at runtime. The provider itself carries a `@deprecated` jsdoc warning. Actual extension logic exists in `prisma-encryption.extension.ts` but is not wired. | `tbs-erp-backend/src/core/database/prisma-encryption.provider.ts`, `tbs-erp-backend/src/core/encryption/prisma-encryption.extension.ts`                 | L      | Open     |
| TD-013  | LOW      | Storage / Cleanup | Document soft-delete emits a `document.deleted` event but no listener or cron job actually deletes the S3/MinIO object. A TODO comment in `delete()` acknowledges this. Soft-deleted documents accumulate indefinitely in object storage. | `tbs-erp-backend/src/modules/document/document.service.ts`                                                                                               | M      | Open     |
| TD-014  | LOW      | Feature Stub      | Newsletter subscriber export (`GET /cms/newsletter/export/excel`) returns `{ message: 'Export feature coming soon' }`. Controller endpoint is live and RBAC-protected but produces no file. | `tbs-erp-backend/src/modules/cms-newsletter/newsletter.controller.ts`                                                                                    | S      | Open     |
| TD-F01  | LOW      | Finance Bug       | FX Realized Gain/Loss AR reversed logic — fixed in finance audit.                                                                              | `exchange-rate-gl.service.ts`                                                                                                                            | -      | Fixed    |
| TD-F02  | LOW      | Finance Bug       | AR aging `nettedAmount` inconsistency — fixed in finance audit.                                                                                | `ar-aging-calculator.service.ts`                                                                                                                          | -      | Fixed    |
| TD-F03  | LOW      | Schema            | Missing FK relations in `finance.prisma` — fixed in finance audit.                                                                             | `prisma/schema/finance.prisma`                                                                                                                           | -      | Fixed    |
| TD-F04  | LOW      | Finance Bug       | Commission rounding precision error — fixed in finance audit.                                                                                  | Commission module                                                                                                                                         | -      | Fixed    |
| TD-F05  | LOW      | Business Logic    | Attachment threshold conflict between complaint and order rules — fixed in finance audit.                                                      | Complaint + Order modules                                                                                                                                 | -      | Fixed    |

---

## Remediation Priority Order

The following ordering is recommended for sprint planning, based on severity and effort:

### Sprint 1 — Quick wins (S-effort items)
1. **TD-001** — Add 3 lines to `error-messages.ts` to restore 2 broken E2E flows.
2. **TD-002** — Replace `BadRequestException` with `DomainException` in `base-status-machine.ts` (one-line change per throw site).
3. **TD-003** — Add `test:integration` script to `package.json` and remove affected paths from `testPathIgnorePatterns`.
4. **TD-009** — Delete stale TODO comment from `complaint.service.ts`.
5. **TD-014** — Implement Excel export for newsletter subscribers using existing `exceljs` / `xlsx` dependency.
6. **TD-011** — Rename `GlobalError` component to match file convention or add explanatory comment.

### Sprint 2 — Medium-effort items
1. **TD-004** — Restore strict RBAC audit assertion and fix any roles that do not pass.
2. **TD-005** — Add `bookingFxRate Decimal?` field to AR/AP schema, populate it on invoice creation, and read it in `recordRealizedGainLoss`.
3. **TD-008** — Integrate one email provider (SES or SendGrid) and one SMS provider (Zalo ZNS or Twilio); gate behind env flags.
4. **TD-013** — Implement cron job or event listener to purge S3/MinIO objects for documents soft-deleted more than N days ago.

### Sprint 3 — Large-effort items (requires external credentials)
1. **TD-006** — Implement Kuaidi100 and 17Track HTTP adapters; wire API credentials via config.
2. **TD-007** — Implement GHTK, GHN, ViettelPost carrier adapters for rate query and tracking.
3. **TD-012** — Refactor `PrismaEncryptionProvider` to provide the extended Prisma client as the actual injectable, replacing the non-functional stub.

---

## Field Reference

| Field   | Values |
|---------|--------|
| Severity | `HIGH` — correctness break or security gap; `MEDIUM` — missing integration or weak test coverage; `LOW` — polish, stubs, documentation |
| Effort  | `S` = < 2h; `M` = 2-8h; `L` = > 8h (may span multiple sessions or require external setup) |
| Status  | `Open` — not yet addressed; `Fixed` — resolved; `Accepted` — known and intentionally deferred |

---

## Audit Trail

| Date       | Event |
|------------|-------|
| 2026-03-18 | v1.0 Phase 1-4 completed; tech debt list started |
| 2026-03-19 | v1.0 Phase 5-7 completed; INT-01, INT-02, INT-03 identified |
| 2026-03-20 | v1.0 milestone audit finalized; finance audit items TD-F01..F05 fixed and closed; this document created |
