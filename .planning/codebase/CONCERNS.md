# Codebase Concerns

**Analysis Date:** 2026-03-18

## Tech Debt

### Unimplemented Integration Stubs

**Tracking Provider Integration:**
- Issue: Kuaidi100 and 17Track APIs have empty stub implementations returning `[]`
- Files: `tbs-erp-backend/src/modules/tracking/domain/tracking-provider.service.ts` (lines 70, 112)
- Impact: Package tracking features in Vietnam logistics are non-functional; orders show no real-time tracking data
- Fix approach: Implement Kuaidi100 API calls (line 71 has endpoint + params documented), implement 17Track API with status mapping, integrate with order notification system

**Shipping Carrier Integration:**
- Issue: GHTK, GHN, ViettelPost tracking/rates/pickups all throw `NotImplementedException`
- Files: `tbs-erp-backend/src/modules/integration/shipping/shipping.service.ts` (lines 52, 82, 112, 226)
- Impact: Shipping module is only a metadata service; real rate quotes and booking unavailable
- Fix approach: Implement carrier-specific adapters for each Vietnamese carrier (GHTK, GHN, ViettelPost, J&T); create webhook handlers for carrier status updates; normalize rate responses to standard interface

**Notification Channels:**
- Issue: Email and SMS sending are placeholders using console logging only
- Files: `tbs-erp-backend/src/modules/notification/notification.service.ts` (lines 194, 215)
- Impact: No actual emails or SMS sent; critical business notifications (order confirmations, payment reminders) reach only in-app channel
- Fix approach: Integrate email provider (SES, SendGrid) with retry logic already present; integrate SMS provider (Twilio, Zalo ZNS); implement webhook handling for delivery status

**Exchange Rate Integration:**
- Issue: Vietcombank API integration is unimplemented
- Files: `tbs-erp-backend/src/modules/exchange-rate/exchange-rate.service.ts` (line 259)
- Impact: Exchange rates must be manually maintained; FX operations may use stale rates affecting order profitability
- Fix approach: Implement Vietcombank API call; add caching with short TTL (1 hour); emit events for AR and cost recalculation when rates change

**Banking Integration:**
- Issue: Bank balance inquiry, transaction history, automatic reconciliation, and transfers are unimplemented
- Files: `tbs-erp-backend/src/modules/integration/banking/banking.service.ts` (lines 51, 78, 107, 139)
- Impact: Bank reconciliation requires manual import of statements; accounts receivable aging may be out-of-sync with actual deposits
- Fix approach: Implement bank API SDK (Techcombank, Vietcombank APIs); standardize transaction parsing; create reconciliation match engine with GL entries

### Field-Level Encryption Disabled

**Encryption Provider Non-Functional:**
- Issue: `PrismaEncryptionProvider` (lines 9-22 in prisma-encryption.provider.ts) is a non-functional stub. The `$extends()` call does NOT replace the singleton PrismaService instance, so encryption has NO effect on the application
- Files: `tbs-erp-backend/src/core/database/prisma-encryption.provider.ts`
- Impact: PII fields (phone, email, identity documents) stored in plaintext in PostgreSQL. GDPR/PDPA compliance at risk
- Current mitigation: `FIELD_ENCRYPTION_KEY` env var logs warning if not set; only marks feature as disabled
- Recommendations:
  1. Implement encryption in PrismaService itself via `createPrismaEncryptionExtension()` with proper extension syntax
  2. OR use database-native encryption (PostgreSQL pgcrypto for specific columns)
  3. Test end-to-end that searchable fields use deterministic encryption, others use randomized
  4. Add integration tests verifying plaintext is never returned via logs/error messages

---

## Known Bugs

### Document Soft-Delete Without Storage Cleanup

**Document Orphaning:**
- Symptoms: Soft-deleted documents remain in S3/MinIO storage indefinitely; storage cost increases over time
- Files: `tbs-erp-backend/src/modules/document/document.service.ts` (lines 135-137)
- Trigger: Any `DELETE` endpoint call on a Document record
- Workaround: Manual S3 cleanup via AWS CLI after document soft-delete
- Issue detail: `TODO` at line 135 notes that actual storage object cleanup is only attempted via event listener, but no cron job exists to purge old soft-deleted documents. Event-driven cleanup is unreliable if events are lost.
- Safe fix: Add `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)` handler in DocumentService to find documents deleted >30 days ago and emit purge events with retry logic

### Missing Complaint Throttling

**DoS Risk on Complaint Submission:**
- Symptoms: Complaint form could be spammed by single customer or bot (no rate limiting)
- Files: `tbs-erp-backend/src/modules/complaint/complaint.service.ts` (line 57)
- Trigger: Rapid POST requests to `/complaints` endpoint
- Current mitigation: None detected
- Issue detail: `TODO` at line 57 explicitly notes `@Throttle()` decorator is missing from controller
- Safe fix: Add `@Throttle({ default: { limit: 5, ttl: 3600000 } })` to `complaint.controller.ts` POST handler (max 5 complaints per hour)

### Newsletter Export Not Implemented

**CMS Feature Incomplete:**
- Symptoms: "Export Excel" button in newsletter UI does nothing or throws error
- Files: `tbs-erp-backend/src/modules/cms-newsletter/newsletter.controller.ts` (line 51)
- Trigger: Admin clicks export button
- Workaround: Manual CSV export from database query
- Issue detail: `TODO` at line 51 marks Excel export as pending; only list/search/create are functional

---

## Security Considerations

### Password Hash Algorithm Exposure Risk

**Auth Service:**
- Risk: Multiple `bcrypt` password verification calls without timing-attack resistance verification; library version not locked
- Files: `tbs-erp-backend/src/core/auth/auth.service.ts` (many lines use bcrypt)
- Current mitigation: Uses bcrypt.compare() which is timing-safe by design
- Recommendations:
  1. Lock bcrypt version to `^5.x` to prevent downgrade to vulnerable versions
  2. Add integration tests verifying failed password check takes similar time as successful check
  3. Consider adding rate limiting to login endpoint (already has `@Throttle()` on controller but verify global config applies)

### JWT Token Exposure via Logs

**Auth/Error Handling:**
- Risk: Full JWT tokens may be logged in error messages or printed in stack traces
- Files: `tbs-erp-backend/src/core/auth/auth.service.ts`, `tbs-erp-backend/src/common/filters/sentry-exception.filter.ts`
- Current mitigation: `sanitizeUser()` method at line 1205 in auth.service.ts masks user details, but does not sanitize token fields in error context
- Recommendations:
  1. Add error sanitization filter to mask `authorization` headers in all logged errors
  2. Verify Sentry integration doesn't capture auth headers via `beforeSend()` hook
  3. Add request/response sanitization to hide tokens from debug logs

### Webhook Signature Validation Gaps

**Banking and Shipping Webhooks:**
- Risk: Bank and carrier webhooks may accept unsigned or improperly validated payloads
- Files: `tbs-erp-backend/src/modules/integration/banking/bank-webhook.service.ts`, `tbs-erp-backend/src/modules/integration/shipping/shipping.service.ts` (line 226)
- Current mitigation: `handleCarrierWebhook()` has TODO at line 226 noting signature validation is not implemented
- Recommendations:
  1. Implement HMAC-SHA256 signature validation for all incoming webhooks
  2. Add webhook IP allowlisting for known carrier ranges
  3. Create integration tests with fake signed payloads to verify rejection of unsigned requests
  4. Log all webhook validation failures for audit trail

---

## Performance Bottlenecks

### Full Document Listing Without Pagination Default

**Document Module:**
- Problem: `getByEntity()` at line 103 in document.service.ts uses `take: 500` with no offset, allowing full table scans for large deployments
- Files: `tbs-erp-backend/src/modules/document/document.service.ts` (line 103)
- Cause: Hard-coded limit to 500 documents per entity without pagination parameters
- Improvement path:
  1. Add `skip` and `take` parameters to `getByEntity()` method signature
  2. Update controller endpoint to accept `page` and `limit` query params
  3. Cache frequently accessed entity document lists (order contracts, invoices) in Redis with 5-minute TTL

### Large State Machine Specs Without Memoization

**Order/Customs FSMs:**
- Problem: `order-status.machine.spec.ts` (795 lines) and `customs-status.machine.spec.ts` (795 lines) appear to run full test suite on every state machine validation
- Files: `tbs-erp-backend/src/modules/order/domain/order-status.machine.spec.ts`, `tbs-erp-backend/src/modules/customs-declaration/domain/customs-status.machine.spec.ts`
- Cause: Tests validate all 15+ transitions × 9 FSMs × multiple service types = 1000s of assertions
- Improvement path:
  1. Split tests into `describe()` blocks by state transition class (e.g., "CONSULTING to QUOTATION", "COMPLETED to SETTLEMENT")
  2. Use lazy evaluation in test fixtures to avoid re-computing invalid transitions for each test
  3. Benchmark test runtime and add performance markers if suite exceeds 10 seconds

### AI Tool Registry Size

**AI Assistant Module:**
- Problem: `tool-registry.ts` (989 lines) defines all ~50 AI tools inline with full prompt text and validation schemas
- Files: `tbs-erp-backend/src/modules/ai-assistant/tools/tool-registry.ts`
- Cause: Tools are loaded into memory on startup; any tool addition requires re-deployment
- Improvement path:
  1. Move tool definitions to database (AITool model) with lazy loading
  2. Implement tool registry caching layer that reloads on schedule or via admin API
  3. Profile memory usage before/after database migration

### N+1 Query Risk in Order List

**Order Read Service:**
- Problem: `order-read.service.ts` (890 lines) uses Prisma `include` for multiple relations without depth control; complex orders may fetch 100+ related records
- Files: `tbs-erp-backend/src/modules/order/order-read.service.ts`
- Cause: Service always includes all relations (items, statusHistory, approvals, containers) regardless of endpoint usage
- Improvement path:
  1. Create separate query builders: `findByIdWithAllRelations()`, `findByIdForList()` (minimal fields), `findByIdForDetail()` (full relations)
  2. Use Prisma `select` instead of `include` in list endpoints to avoid loading unused relations
  3. Add Prisma query logging middleware to detect N+1 patterns in integration tests

---

## Fragile Areas

### Order Status Machine Service Type Delegation

**Files:** `tbs-erp-backend/src/modules/order/domain/order-status.machine.ts`

**Why fragile:**
- Lines 21-23 note FSM delegates to external transition maps in `@common/constants` for actual validation
- MHH deposit gate rule (lines 55-63) is duplicated in both FSM and `DepositGateService`; if rules diverge, orders may get stuck
- `getNextStatuses()` (lines 72-81) filters SOURCING dynamically but service type may change after quotation — inconsistent behavior possible

**Safe modification:**
1. Always modify MHH rules in BOTH `OrderStatusMachine` AND `DepositGateService` together
2. Add integration test that creates MHH order, advances to PENDING_DEPOSIT, then verifies SOURCING is available
3. Add constraint in Order schema to prevent serviceType change after QUOTATION (soft enforcement in service)

**Test coverage:** Spec file exists (`order-status.machine.spec.ts` 795 lines), but verify MHH transition tests pass with changing customer tier

---

### Customs Declaration Status Machine with Listener Coupling

**Files:**
- `tbs-erp-backend/src/modules/customs-declaration/customs-declaration.service.ts`
- `tbs-erp-backend/src/modules/customs-declaration/listeners/container-customs.listener.ts`

**Why fragile:**
- Listener at line 75 auto-generates declaration code and creates declaration when container hits CUSTOMS status
- If listener fails silently (event emitter swallows error), declarations may not be created but Container status advances
- `generateDeclarationCode()` at line 124 uses YYYYMM pattern, but month rollover at midnight UTC may create duplicates if 2 containers entered customs within same second on month boundary

**Safe modification:**
1. Make listener throw hard errors instead of logging; let EventEmitter bubble up
2. Add integration test that mocks time at month boundary and triggers duplicate code generation
3. Use deterministic nonce (container ID hash) in code generation to prevent collisions: `CD-${yyyymm}-${containerIdHash}`
4. Add database constraint `UNIQUE(code, year)` to ensure codes never collide even if listener retries

**Test coverage:** Spec exists (`customs-status.machine.spec.ts` 795 lines), but no listener integration tests detected

---

### Warehouse CN Consolidation Service with Dynamic Cost Allocation

**Files:** `tbs-erp-backend/src/modules/warehouse-cn/warehouse-cn-consolidation.service.ts`

**Why fragile:**
- Generates consolidation code via line 107 comment (CONS-YYYYMM-XXXX)
- Consolidation groups 3+ orders into single shipment; if ANY order later gets cancelled, cost allocation must be recalculated
- No observed listener for order cancellation → consolidation cost reallocation event chain
- `slotting.service.ts` (1031 lines) determines warehouse slot allocation, highly complex state machine for physical space

**Safe modification:**
1. When order.status transitions to CANCELLED, emit `order.cancelled` event
2. In consolidation listener, find affected consolidations and emit `consolidation.rebalance` event
3. Rebalance handler recalculates per-order consolidation cost using DYNAMIC_ALLOCATION principle
4. Add audit log entry tracking cost changes per order item

**Test coverage:** Integration tests needed for multi-order consolidation cancellation scenarios

---

### Complaint FSM Without Issue Escalation Path

**Files:** `tbs-erp-backend/src/modules/complaint/complaint.service.ts`

**Why fragile:**
- Complaint FSM allows INVESTIGATING → PENDING_RESOLUTION, but no path to escalate unresolved complaints to management
- `complaint.service.ts` line 57 TODO notes throttling is missing; without rate limiting, spam complaints may clog investigation queue
- No observed SLA timer for complaint response (compare to approval module which has `SlaTracker`)

**Safe modification:**
1. Add `ESCALATED` status between INVESTIGATING and PENDING_RESOLUTION
2. Implement `@Throttle()` on POST controller as noted in TODO
3. Add SLA clock via event listener on complaint creation; fire alert if SLA breached
4. Add test verifying complaint cannot be RESOLVED without investigation step

---

### Cache Invalidation Coordination Gaps

**Files:**
- `tbs-erp-backend/src/core/cache/cache-invalidation.service.ts`
- Multiple module listeners (crm, order, customs)

**Why fragile:**
- Cache keys use module-specific patterns (e.g., `order:${id}`, `customer:${id}`)
- If two events (order.created, customer.tier_updated) occur in quick succession, cache may be partially invalidated
- No observed transaction wrapper around cache invalidation + database write
- `cache-invalidation.service.ts` is called from many listeners; if single listener forgets to call it, stale cache stays

**Safe modification:**
1. Implement cache invalidation as part of Prisma `$transaction()` where possible
2. Create facade method `invalidateCacheAfterWrite()` that all services must call post-update
3. Add integration test with 100 concurrent operations to surface race conditions
4. Log all cache invalidation operations at DEBUG level for audit trail

---

## Test Coverage Gaps

### Backend Unit Test Count

**Untested areas:**
- Files: Only 22 `.spec.ts` files found in backend (`tbs-erp-backend/src`)
- Codebase: 60K+ lines of backend code
- Estimated coverage: <5% line coverage
- Risk: High

**Untested services:**
- `tbs-erp-backend/src/modules/warehouse-vn/warehouse-vn.service.ts` (981 lines) - no spec file
- `tbs-erp-backend/src/modules/rate-card/rate-card.service.ts` (941 lines) - no spec file
- `tbs-erp-backend/src/modules/integration/accounting/accounting.service.ts` (1068 lines) - no spec file

**Priority fixes:**
1. Add unit tests for all 9 FSMs (order, supplier-order, container, quotation, complaint, cash, warehouse-cn, warehouse-vn, customs)
2. Add integration tests for deposit gate, cost allocation, and approval workflows
3. Implement E2E tests for multi-step order flows (CONSULTING → QUOTATION → PENDING_DEPOSIT → SOURCING → ... → COMPLETED)

### Frontend Test Coverage

**Untested areas:**
- No `.test.tsx`, `.test.ts`, or `.spec.tsx` files detected in `tbs-erp-frontend/src`
- Framework hooks (`use-orders.ts`, `use-customers.ts`, etc.) untested
- Critical components (data-table, form-error-summary) untested
- Risk: High regression risk on UI refactors

**Recommendations:**
1. Set up Vitest + React Testing Library
2. Add component snapshot tests for shared UI components
3. Add hook tests for data fetching flows
4. Add E2E tests for critical user journeys (order creation, payment confirmation)

---

## Missing Critical Features

### Data Export Gaps

**CMS Newsletter Export:**
- Problem: Newsletter list cannot be exported to Excel (line 51 TODO in newsletter.controller.ts)
- Blocks: Admin reporting on subscriber engagement
- Workaround: Manual DB query + CSV import

**Contact Export:**
- Problem: CRM contacts cannot be exported (line 49 TODO in contacts.controller.ts)
- Blocks: Backup of lead data, external CRM sync

**Recommendation:** Use existing `VasExcelExportService` pattern from general-ledger module as template; implement generic Excel export utility

---

## Scaling Limits

### Database Row Limits

**Audit Logs:**
- Current capacity: AuditLog table likely 10M+ rows after 6 months of production
- Limit: Unindexed searches become O(n); query timeout after 50M rows
- Scaling path: Implement table partitioning by month (via migration script in `tbs-erp-backend/scripts/partition-audit-log.sql`); archive to cold storage after 2 years

**Orders & Order Items:**
- Current capacity: Single order table can grow to 500K+ rows per year for TBS scale (1000 orders/day)
- Limit: JOIN operations with order items and status history slow down after 1M rows
- Scaling path: Create `OrderArchive` table for completed orders >2 years old; add materialized view for order metrics; implement read replicas for reporting

**Session Table:**
- Current capacity: 100 concurrent users = ~100 active sessions; max 10K total sessions
- Limit: Unindexed user_id lookups timeout after 100K rows
- Scaling path: Migrate to Redis-backed session store (already used for auth tokens); add index on `(user_id, expires_at)`

### API Rate Limits

**Current mitigation:**
- Global throttle configured in AppModule (exact limits not visible)
- Per-endpoint throttle on login, complaint (none on others)

**Scaling risk:**
- No per-tenant or per-customer rate limiting
- Bulk import endpoints (`/orders/import-excel`) accept arbitrary batch size
- Unprotected endpoints (public search, blog) could be scraped

**Recommendations:**
1. Implement per-customer rate limiting based on subscription tier
2. Add max batch size limit to all bulk import endpoints (default 1000)
3. Enable request timeout (30s) to prevent slow client stalls

---

## Dependencies at Risk

### Prisma ORM Version Lock

**Risk:** `prisma` and `@prisma/client` versions managed via `package.json` lock; major version upgrades require schema migrations
- Migration path: Test schema changes in dev environment; run `prisma migrate deploy` before production deployment

### Encryption Library

**Risk:** Field encryption implementation delegates to `crypto` module; if Node.js crypto APIs change, decryption may fail
- Migration plan: Add abstraction layer (EncryptionProvider interface) to support pluggable crypto implementations

### MinIO/S3 Compatibility

**Risk:** Drive module uses AWS SDK S3 client; MinIO compatibility tested but not guaranteed across versions
- Migration plan: Add integration tests using MinIO test container; test all operations (upload, download, delete, presigned URLs)

---

*Concerns audit: 2026-03-18*
