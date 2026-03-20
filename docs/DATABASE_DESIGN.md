# TBS ERP — Database Design Review

**Review Date:** 2026-03-20
**Schema Files:** 36 `.prisma` files across `prisma/schema/`
**ORM:** Prisma (PostgreSQL provider) with `prismaSchemaFolder` + `relationJoins` preview features
**Database:** PostgreSQL (pooled via `DATABASE_URL`, direct via `DIRECT_DATABASE_URL`)

---

## 1. Schema Overview

### Total Model Count

| Domain | Schema File(s) | Models |
|--------|---------------|--------|
| Auth & RBAC | auth.prisma | 6 |
| Order & Fulfillment | order.prisma | 13 |
| Finance | finance.prisma | 22 |
| CRM | crm.prisma | 8 |
| Logistics | logistics.prisma | 7 |
| Warehouse | warehouse.prisma | 9 |
| Container | container.prisma | 1 |
| Customs | customs.prisma | 10 |
| HR | hr.prisma | 12 |
| System & Approval | system.prisma | 21 |
| Tracking | tracking.prisma | 1 |
| Operation Cost | operation-cost.prisma | 2 |
| OKR | okr.prisma | 4 |
| Automation | automation.prisma | 2 |
| Rate Card & Pricing | rate-card.prisma | 6 |
| Analytics | analytics.prisma + crm-analytics.prisma | 2 |
| Order Project | order-project.prisma | 3 |
| Cost Adjustment | cost-adjustment.prisma | 1 |
| Carrier Reconciliation | carrier-reconciliation.prisma | 2 |
| Integration | integration.prisma | 5 |
| CMS | cms.prisma | 9 |
| Blog | blog.prisma | 3 |
| Workplace: Chat | chat.prisma | 4 |
| Workplace: Calendar | calendar.prisma | 4 |
| Workplace: Drive | drive.prisma | 4 |
| Workplace: Company Feed | company-feed.prisma | 3 |
| Workplace: AI Chat | ai-chat.prisma | 2 |
| Workplace: Video | video.prisma | 2 |
| Workplace: Wiki | wiki.prisma | 3 |
| Workplace: Emoji | emoji.prisma | 1 |
| Support Ticket | support-ticket.prisma | 2 |
| Attendance GPS | attendance-gps.prisma | 2 |
| **TOTAL** | **36 files** | **176 models** |

> Note: The project references "95+ models" in early documentation. The current schema has grown significantly to 176 models across 36 schema files as new modules (Workplace, CMS, OKR, Analytics, etc.) were added post-launch.

### Domain Grouping Summary

| Domain Group | Model Count |
|---|---|
| Auth, Users, Sessions | 6 |
| Order Core (Order, Items, Contracts, Quotations, Suppliers) | 13 |
| Finance (AR, AP, Cash, GL, Commission, Vouchers, Wallet) | 22 |
| CRM (Customer, Contact, Wallet, Lead) | 8 |
| Warehouse (Package, QC, Storage) | 9 |
| Container & Customs | 11 |
| Logistics (Fleet, Driver, Delivery) | 7 |
| HR (Employee, Payroll, Leave, Attendance) | 12 |
| System (Approval Engine, Tasks, Notifications, Webhooks) | 21 |
| Analytics & Reporting | 2 |
| Workplace (Chat, Calendar, Drive, Feed, Video, Wiki, AI) | 23 |
| CMS & Blog | 12 |
| Integration & Batch | 5 |
| Pricing & Rate Cards | 6 |
| OKR | 4 |
| Operational Utilities (Cost Adjustment, Carrier Recon, etc.) | 15 |

---

## 2. Data Model Diagram (ERD)

### 2.1 Core Order Chain

```
User ──────────────────────────────────────────────────────────────────────
 |  role: UserRole (22 roles)                                              |
 |  leaderId → User (self-referential hierarchy)                           |
 |                                                                         |
 +──[QuotationCreator]──> Quotation ──> QuotationItem                     |
 |                             |                                            |
 |                             +──[rateCardId]──> RateCard                 |
 |                             |                                            |
 |                             +──[quotationId]──> Contract                |
 |                                                                         |
 +──[MasterOrderSale]──> MasterOrder ──────────────────────────────────────+
                              |                                             |
                              +──> Order (subOrder) <──── Customer ────────+
```

```
MasterOrder
  |
  +──> Order ──────────────────────────────────────────────────────────────
         |                                                                  |
         +──> OrderItem ──> SupplierOrder ──> PaymentVoucher               |
         |         |                                                        |
         |         +──[soft delete: deletedAt]                             |
         |                                                                  |
         +──> Package ──────────────────────────────────────────────────── |
         |       |                                                           |
         |       +──> Container ──> OperationCost                           |
         |       |         |                                                 |
         |       |         +──> CostAllocation ──> Order                   |
         |       |         |                                                 |
         |       |         +──> CustomsDeclaration ──> CustomsDeclarationLine
         |       |                                                           |
         |       +──> TrackingEvent                                         |
         |       +──> QCInspection                                          |
         |       +──> DeliveryPackage ──> Delivery                         |
         |       +──> WeightAuditLog                                        |
         |                                                                   |
         +──> OrderStatusHistory                                             |
         +──> OrderExtraCharge                                               |
         +──> MHHIssue                                                       |
         +──> Complaint ──> Customer                                        |
         +──> AccountReceivable ──> ARAgingSnapshot                        |
         +──> PaymentVoucher ──> PaymentAllocation ──> PaymentAllocationDetail
         +──> CommissionRecord ──> User (Sale)                              |
         +──> CostAdjustment                                                 |
         +──> ReturnRequest                                                  |
         +──> OrderAssignment ──> OrderHandoff                              |
         +──────────────────────────────────────────────────────────────────+
```

### 2.2 Customer Financial Chain

```
Customer
  |
  +──> Wallet ──> WalletTransaction ──[bankTraceId unique]──> BankWebhookTransaction
  |
  +──> AccountReceivable ──> PaymentAllocationDetail
  |       |
  |       +──> ARAgingSnapshot (daily snapshot by customer)
  |
  +──> Order ──> PaymentVoucher ──> PaymentAllocation
  |                     |
  |                     +──> Contract ──> PaymentAllocation
  |
  +──> Contract ──> UnallocatedFundClaim
  |
  +──> DebtNetting ──> DebtNettingItem
  |
  +──> CustomerAnalytics (churn risk, CLV, predicted next order)
  +──> CustomerPriceOverride ──> RateCard
  +──> ARAgingSnapshot
```

### 2.3 User and Employee Chain

```
User
  |
  +──> Session (JWT refresh token, Cascade on delete)
  |
  +──> AuditLog (all CRUD actions, Cascade on delete)
  |         |
  |         +──> AuditLogArchive (cold storage after retention period)
  |
  +──> Employee (1:1 optional — internal staff have Employee record)
  |       |
  |       +──> Attendance ──> AttendanceLocation
  |       +──> LeaveRequest
  |       +──> OvertimeRequest
  |       +──> PayrollRecord
  |       +──> TrainingRecord
  |       +──> PerformanceNote
  |       +──> OnboardingChecklist
  |       |
  |       +──> Employee (managerId self-join — org chart)
  |
  +──> UserConsent (GDPR/NĐ 13/2023 compliance)
```

### 2.4 Approval Engine

```
ApprovalFlowDefinition
  |
  +──> ApprovalFlowNode ──> ApprovalFlowEdge
  |
  +──> Approval (instance) ──[referenceId polymorphic]──> any entity
         |
         +──> ApprovalStep (one per node in flow)
         +──> ApprovalCC (observers)
         +──> ApprovalComment
         +──> ApprovalActionLog
         +──> ApprovalAnalytics (1:1)
```

### 2.5 Finance General Ledger

```
JournalEntry ──> JournalEntryLine ──> ChartOfAccount
                                            |
                                     (type: ASSET|LIABILITY|EQUITY|REVENUE|EXPENSE)
```

### 2.6 Workplace Modules

```
User ──> CalendarEvent (organizer) ──> EventParticipant ──> User
         |                              EventReminder
         +──> MeetingRoom

User ──> ChatConversation (creator) ──> ChatMessage ──> ChatReaction
                                   |     (reply self-join)
                                   +──> ChatParticipant ──> User

User ──> DriveFolder (owner, nested hierarchy) ──> DriveFile
                                                      |
                                                 DriveFileVersion
                                                 DriveFileShare

User ──> AIChatSession ──> AIMessage
User ──> CompanyPost ──> PostReaction, PostComment (self-join for replies)
User ──> VideoRoom ──> VideoParticipant
WikiSpace ──> WikiPage (tree) ──> WikiPageVersion
```

---

## 3. Key Design Patterns

### 3.1 Soft Deletes

Soft delete is applied selectively, not universally:

| Model | Soft Delete Field |
|---|---|
| OrderItem | `deletedAt` |
| QuotationItem | `deletedAt` |
| Contract | `deletedAt` + `deletedBy` |
| CalendarEvent | `deletedAt` |
| CompanyPost | `deletedAt` |
| PostComment | `deletedAt` |
| DriveFolder | `deletedAt` |
| DriveFile | `deletedAt` |
| WikiPage | `deletedAt` |
| Objective (OKR) | `deletedAt` |

**Gap:** Several high-volume models (`Order`, `Customer`, `Package`, `PaymentVoucher`) use status-based lifecycle control (CANCELLED, COMPLETED) rather than a `deletedAt` field. This is intentional (ZERO TRUST principle — no hard deletes), but means filtering logic differs between modules. A consistent approach or a shared `isArchived` flag across all models would simplify service-layer queries.

### 3.2 Audit Fields

Standard fields across most models:

| Field | Type | Notes |
|---|---|---|
| `createdAt` | `DateTime @default(now())` | All models |
| `updatedAt` | `DateTime @updatedAt` | Most models (absent on some immutable logs) |
| `createdBy` | `String` | ID stored as plain string, not FK |

> `createdBy` / `changedBy` / `performedBy` are stored as plain `String` (userId) without a Prisma FK relation, which is intentional to allow audit records to survive user deletion. This avoids cascade deletion issues but prevents join-level integrity enforcement.

### 3.3 Status Management

Two approaches are used:

**Enum-based FSM status** (type-safe, Prisma validates at write):
- `OrderStatus`, `ContractStatus`, `ApprovalStatus`, `QuotationStatus`, `SupplierOrderStatus`, `QCStatus`, `DeliveryStatus`, `ContainerStatus`, `CustomsDeclarationStatus`, `WarehouseCNStatus`, `WarehouseVNStatus`

**String-based status** (flexible, no compile-time validation):
- `SupportTicket.status` — `"OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED"`
- `Lead.status` — `"NEW" | "CONTACTING" | "QUOTED" | "CONVERTED" | "LOST"`
- `BankWebhookTransaction.status` — `"PENDING" | "AUTO_CREDITED" | "FAILED" | "DUPLICATE"`
- `Candidate.status`, `ExpenseClaim.status`, `PackageConsolidation.status`

**Recommendation:** Migrate the string-based statuses for `SupportTicket`, `Lead`, and `ExpenseClaim` to enums to gain type safety and database-level constraint enforcement.

### 3.4 Monetary Precision

| Use Case | Precision | Examples |
|---|---|---|
| All monetary amounts (VND, CNY) | `Decimal(18, 2)` | `amount`, `totalAmount`, `paidAmount`, `netSalary` |
| Exchange rates | `Decimal(18, 4)` | `exchangeRateUsed`, `exchangeRateSnapshot`, `rate` |
| Percentage rates | `Decimal(5, 2)` or `Decimal(5, 4)` | `discountPercent`, `taxRate`, `commissionRate` |
| Weight (kg) | `Decimal(10, 2)` | `actualWeight`, `cnWeight`, `vnWeight` |
| Volume (m3) | `Decimal(10, 4)` | `currentVolume`, `maxVolume` |
| Quantity (units) | `Decimal(15, 3)` | `declaredQuantity`, `currentQty` |
| Proportion / allocation | `Decimal(10, 6)` | `proportion` in `CostAllocation` |

This is well-designed. `Decimal(18,2)` supports values up to 9,999,999,999,999,999.99 VND — sufficient for any conceivable transaction.

### 3.5 Column and Table Naming Convention

- All Prisma field names use **camelCase** in schema
- All database columns use **snake_case** via `@map("snake_case")`
- All table names use **snake_case plural** via `@@map("table_name")`
- Pattern is applied consistently across all 176 models

Examples:
```
passwordHash  String  @map("password_hash")
createdAt     DateTime @default(now()) @map("created_at")
@@map("users")
```

### 3.6 Encrypted Fields

Fields annotated with `/// @encrypted` are application-layer encrypted before persistence (not database-level encryption):

| Model | Encrypted Fields |
|---|---|
| User | `twoFactorSecret`, `twoFactorBackupCodes`, `resetToken` |
| Session | `refreshToken` |
| Employee | `bankName`, `bankAccount`, `taxCode`, `insuranceId` |
| Vendor | `bankName`, `bankAccount` |
| ApiKey | `key` |

### 3.7 Array Fields (PostgreSQL Arrays)

Several models use PostgreSQL native arrays instead of junction tables:

| Model | Array Field | Concern |
|---|---|---|
| Order | (none) | Fine |
| Package | `imageUrls String[]` | Fine for URLs |
| Contract | `attachments String[]` | Fine for URLs |
| SupplierOrder | `attachments String[]` | Fine for URLs |
| User | `twoFactorBackupCodes String[]` | Fine, small set |
| ApprovalFlowDefinition | (stored as JSON) | Fine |
| WebhookEndpoint | `events String[]`, `permissions String[]` | Fine |
| OrderStageConfig | `primaryRoles UserRole[]` | Uses enum array — PostgreSQL-specific |

The `primaryRoles UserRole[]` in `OrderStageConfig` is a PostgreSQL enum array. This works but is not portable and cannot be filtered efficiently with an index on individual enum values.

---

## 4. Index Strategy

### 4.1 Composite Indexes Found

The following composite indexes exist across the schema:

**Order module:**
```sql
idx_orders_customer_status         (customer_id, status)
idx_orders_service_type_status     (service_type, status)
idx_orders_branch_created_at       (branch, created_at)
idx_master_orders_customer_status  (customer_id, overall_status)
idx_master_orders_sale_status      (sale_id, overall_status)
idx_order_items_order_deleted      (order_id, deleted_at)
idx_extra_charges_order_status     (order_id, status)
(status, branch)                   — on orders
(saleId, status)                   — on orders
(status, createdAt)                — on orders
(status, createdAt, saleId)        — on orders   ← 3-column index
```

**Finance module:**
```sql
idx_ar_status_due_date             (status, due_date)
idx_ar_status_created              (status, created_at)
idx_ap_status_due_date             (status, due_date)
idx_ap_status_created              (status, created_at)
idx_payment_vouchers_status_created (status, created_at)
idx_invoices_order_status          (order_id, status)
idx_invoices_customer_status       (customer_id, status)
idx_invoices_status_created        (status, created_at)
idx_journal_entries_posted_period  (is_posted, period_year, period_month)
(status, createdBy)                — on payment_vouchers
(status, amount)                   — on payment_vouchers
(type, createdAt)                  — on payment_vouchers, cash_transactions
```

**CRM module:**
```sql
idx_customers_sale_active          (sale_id, is_active)
idx_customers_tier_active          (tier, is_active)
idx_customers_active_created       (is_active, created_at)
idx_quotations_customer_status     (customer_id, status)
idx_quotations_status_created      (status, created_at)
idx_contracts_customer_status      (customer_id, status)
idx_contracts_sale_status          (sale_id, status)
idx_contracts_status_effective     (status, effective_date)
```

**Warehouse / Package:**
```sql
idx_packages_container_vn_status   (container_id, warehouse_vn_status)
idx_packages_vn_status_created     (warehouse_vn_status, created_at)
idx_packages_high_risk_cn          (is_high_risk, warehouse_cn_status)
idx_weight_audit_package_created   (package_id, created_at)
(orderId, warehouseCNStatus)       — on packages
(containerId, warehouseCNStatus)   — on packages
```

**HR:**
```sql
idx_employees_dept_status          (department_code, status)
idx_employees_branch_status        (branch, status)
idx_overtime_requests_employee_date (employee_id, date)
idx_overtime_requests_employee_status (employee_id, status)
```

**System / Approval:**
```sql
idx_approvals_reference_type       (reference_id, type)
idx_approvals_status_type_created  (status, type, created_at)
idx_notifications_user_read_created (user_id, is_read, created_at)
idx_notifications_user_type_read   (user_id, type, is_read)
```

**Tracking:**
```sql
idx_tracking_events_package_time   (package_id, event_timestamp)
idx_tracking_events_container_time (container_id, event_timestamp)
idx_tracking_events_tracking_time  (tracking_number, event_timestamp)
```

**Auth:**
```sql
idx_users_role_active              (role, is_active)
idx_users_active_created           (is_active, created_at)
(entity, entityId)                 — on audit_logs
(userId, createdAt)                — on audit_logs
```

**Customs:**
```sql
idx_customs_declarations_container_status (container_id, status)
idx_customs_declarations_status_created   (status, created_at)
idx_customs_declarations_status_channel   (status, channel)
```

### 4.2 Unique Constraints

| Model | Unique Constraint |
|---|---|
| User | `email`, `phone`, `saleCode` |
| Session | (none — refresh tokens indexed but not unique) |
| UserConsent | `(userId, consentType, version)` |
| Customer | `code` |
| Order | `code` |
| MasterOrder | `code` |
| Contract | `code` |
| Quotation | `code` |
| Package | `code` |
| Container | `code` |
| CommissionRecord | `orderId` — 1 commission per order |
| ExchangeRate | `(from, to, date)` |
| ClosedPeriod | `(year, month)` |
| RevenueTarget | `(year, month, branch)` |
| PaymentAllocation | `code` |
| Attendance | `(employeeId, date)` — one record per employee per day |
| PayrollRecord | `(employeeId, month, year)` |
| ApprovalFlowDefinition | `(triggerType, version)` |
| ApprovalFlowNode | `(flowDefinitionId, nodeKey)` |
| ApprovalStep | `(approvalId, stepNumber)` |
| ApprovalCC | `(approvalId, userId)` |
| ApprovalAnalytics | `approvalId` — 1:1 |
| WalletTransaction | `bankTraceId` — idempotency |
| PaymentVoucher | `bankTraceId` — idempotency |
| BankWebhookTransaction | `bankTraceId`, `walletTransactionId` |
| DeliveryPackage | `(deliveryId, packageId)` |
| ChatParticipant | `(conversationId, userId)` |
| ChatReaction | `(messageId, userId, emoji)` |
| DriveFileVersion | `(fileId, version)` |
| DriveFileShare | `(fileId, userId)`, `shareToken` |
| EventParticipant | `(eventId, userId)` |
| VideoParticipant | `(roomId, userId)` |
| PostReaction | `(postId, userId, type)` |
| OKRTaskLink | `(keyResultId, taskId)` |
| HSCodeKeyword | `(hsCodeId, keyword)` |
| CustomsTaxAllocation | `(declarationId, orderId)` |
| RateCardDiscount | `(rateCardId, customerTier)` |
| CustomerPriceOverride | `(customerId, rateCardId)` |
| SyncLog | `idempotencyKey` |
| LegalDocument | `(type, version, locale)` |
| WikiPage | `(spaceId, slug)` |
| WikiPageVersion | `(pageId, version)` |

### 4.3 Missing or Potentially Useful Indexes

The following gaps were identified through analysis:

| Table | Missing Index | Justification |
|---|---|---|
| `orders` | `(master_order_id, status)` | Filtering sub-orders by status under a master order is a common query |
| `order_status_history` | `(order_id, to_status)` | Finding when an order reached a specific status |
| `supplier_orders` | `(status, created_at)` | Dashboard/report queries filter by status and sort by date |
| `complaints` | `(created_at)` | Missing single-column index; only composite indexes exist |
| `wallet_transactions` | `(wallet_id, type)` | Filtering by transaction type within a wallet |
| `journal_entry_lines` | `(account_code, entry_id)` | GL report queries pivot on account code |
| `customs_declaration_lines` | `(declaration_id, compliance_status)` | Compliance dashboard filtering |
| `delivery` | `(status, branch, scheduled_at)` | Dispatch board queries filter all three dimensions |
| `audit_logs` | `(entity, entity_id, action)` | Filtering specific action types for an entity |
| `outbox_events` | `(aggregate_type, status)` | Outbox worker polling by entity type |
| `notifications` | `(user_id, priority, is_read)` | High-priority unread notification queries |
| `batch_jobs` | `(type, status)` | Job monitoring queries |

---

## 5. Optimization Recommendations

### 5.1 Table Partitioning Candidates

The following tables are excellent candidates for PostgreSQL table partitioning:

**`audit_logs` — Range partition by `created_at` (monthly)**
- Growth rate: every CRUD operation on every entity writes a row
- Estimated: 100,000+ rows/month at moderate usage
- Retention policy already implemented (archiving to `audit_log_archives`)
- Partition scripts exist: `scripts/partition-audit-log.sql` and `scripts/create-audit-partition.sh`
- Recommendation: Implement monthly partitions; the migration `20260317_performance_indexes` already references partial indexes

**`orders` — Range partition by `created_at` (yearly)**
- Core business table; grows with business volume
- Partitioning by year keeps active partitions small for hot queries
- Reference partition SQL exists in `prisma/migrations/partitioning-orders.sql` and `partitioning.sql`
- Status: Scripts exist but may not be applied to production

**`tracking_events` — Range partition by `event_timestamp` (monthly)**
- Every package and container movement produces events
- Historical events are rarely queried individually
- Time-based queries (last 30 days of events for a package) benefit greatly

**`notifications` — Range partition by `created_at` (monthly)**
- High write volume; most reads are recent unread notifications
- Old notifications can age out to cold partition quickly

**`wallet_transactions`** — Range partition by `created_at` (monthly if volume warrants)

### 5.2 N+1 Query Risks

The following patterns risk N+1 queries at the application layer if not handled with `include` + `select`:

| Service | Risk Pattern |
|---|---|
| Order list with customer name | `Order` -> `Customer` — common in list views |
| Package list with order status | `Package` -> `Order` |
| Commission report | `CommissionRecord` -> `Order` -> `Customer` (3 joins) |
| AR aging with customer info | `ARAgingSnapshot` -> `Customer` |
| Approval list with reference data | `Approval` -> `ApprovalStep[]` -> `ApprovalStep.approvalMode` |
| Delivery dispatch board | `Delivery` -> `Order` -> `Customer`, `Delivery` -> `Driver`, `Delivery` -> `Vehicle` |
| Container tracking | `Container` -> `Package[]` -> `Order[]` — potentially hundreds of packages per container |

**Recommendation:** Ensure all list-endpoint queries use explicit `select` with only required fields. Avoid `include: { order: true }` without `select`; always project only the fields needed (e.g., `include: { order: { select: { code: true, status: true } } }`).

### 5.3 Large Text Fields

| Model | Field | Type | Concern |
|---|---|---|---|
| AIMessage | `content` | `String @db.Text` | LLM responses can be very large; consider chunking |
| WikiPage | `content` | `String @db.Text` | Rich HTML; can grow to 100KB+ |
| WikiPageVersion | `content` | `String @db.Text` | Every version stores full content — high storage |
| BlogPost | `content` | `String @db.Text` | Rich HTML |
| BlogComment | `content` | `String @db.Text` | Fine |
| Page (CMS) | `content` | `String @db.Text` | Fine |
| LegalDocument | `content` | `String @db.Text` | Fine |
| WebhookDelivery | `response` | `String? @db.Text` | Truncated to 4KB per comment; verify enforcement |
| Complaint | `description` | `String` | No length limit; consider `@db.VarChar(2000)` |
| ApprovalFlowNode | `fieldPermissions` | `Json?` | Fine |

**WikiPageVersion recommendation:** Consider a content-diff approach storing only changed blocks rather than full HTML snapshots per version. Current design will accumulate significant storage for active wiki spaces.

### 5.4 Foreign Key Cascade Analysis

| Relationship | Cascade Behavior | Risk |
|---|---|---|
| `Order` -> `OrderItem` | `onDelete: Cascade` | Intended — items die with order |
| `Order` -> `Package` | `onDelete: Cascade` | Intended |
| `Order` -> `OrderStatusHistory` | `onDelete: Cascade` | Intended |
| `Order` -> `CommissionRecord` | `onDelete: Cascade` | CAUTION: deleting order loses commission history |
| `User` -> `AuditLog` | `onDelete: Cascade` | CAUTION: deleting user destroys audit trail |
| `User` -> `Session` | `onDelete: Cascade` | Intended — logout all sessions |
| `Container` -> `CustomsDeclaration` | `onDelete: Cascade` | CAUTION: destroying declaration if container deleted |
| `Container` -> `CostAllocation` | `onDelete: Cascade` | CAUTION: cost allocation data lost |
| `MasterOrder` -> `Order` | `onDelete: Cascade` | CAUTION: would delete all sub-orders |
| `Order` -> `Contract` | `onDelete: SetNull` | Safe |
| `Order` -> `Container` | `onDelete: SetNull` | Safe |
| `Employee` -> `PayrollRecord` | `onDelete: Cascade` | CAUTION: payroll destroyed if employee deleted |

**Critical recommendation:** The `User -> AuditLog (Cascade)` delete is a compliance risk. Under NĐ 13/2023 and business audit requirements, audit logs must survive user deletion. Change this to `onDelete: Restrict` or `onDelete: SetNull` (with a nullable `userId`) to protect the audit trail. The `AuditLogArchive` model already demonstrates the separation needed.

**Critical recommendation:** `Employee -> PayrollRecord (Cascade)` should be `onDelete: Restrict` since payroll records are legal financial documents.

### 5.5 Denormalized Counters

Several models maintain denormalized counts that require coordinated updates:

| Model | Denormalized Field | Source of Truth |
|---|---|---|
| `Customer` | `totalOrders Int` | Count of `Order` rows |
| `Customer` | `totalRevenue Decimal` | Sum of completed order amounts |
| `Customer` | `currentDebt Decimal` | Sum of open AR amounts |
| `QuotationTemplate` | `usageCount Int` | Count of uses |
| `ResponseTemplate` | `usageCount Int` | Count of uses |
| `HSCodeLibrary` | `usageCount Int` | Count of declaration line uses |
| `BlogPost` | `viewCount Int`, `likeCount Int` | Incremental updates |
| `CompanyPost` | `viewCount Int` | Incremental updates |
| `CustomEmoji` | `usageCount Int` | Incremental updates |

These fields are valid for performance (avoiding COUNT queries on large tables) but risk inconsistency if updates fail. They should be maintained via database-level triggers or be clearly documented as eventually-consistent with periodic reconciliation jobs.

---

## 6. Migration History

### 6.1 Migration List

All migrations are in `tbs-erp-backend/prisma/migrations/`:

| Migration | Date | Description |
|---|---|---|
| `20260301_partitioning_and_archiving` | 2026-03-01 | PostgreSQL table partitioning setup + audit log archiving |
| `20260306_container_code_format` | 2026-03-06 | Container code format change |
| `20260307_chat_module` | 2026-03-07 | Chat, conversations, participants, reactions |
| `20260308_ai_chat_module` | 2026-03-08 | AI Chat session and message models |
| `20260308_attendance_gps` | 2026-03-08 | GPS attendance tracking, office locations |
| `20260308_custom_emoji` | 2026-03-08 | Custom company emoji for chat |
| `20260310_order_project` | 2026-03-10 | Order-as-Project: stage configs, assignments, handoffs |
| `20260311_analytics_snapshot` | 2026-03-11 | DailyMetricSnapshot model |
| `20260311_crm_analytics` | 2026-03-11 | CustomerAnalytics churn prediction model |
| `20260311_dynamic_pricing_vas_export` | 2026-03-11 | Dynamic pricing, VAS, export configurations |
| `20260311_rate_card_volume_tiers` | 2026-03-11 | RateCardVolumeTier, RateCardSeasonalRule |
| `20260311_warehouse_slotting` | 2026-03-11 | StorageBin model for ABC-class bin management |
| `20260317120000_add_partial_indexes` | 2026-03-17 | Partial indexes on high-volume tables |
| `20260317_add_reporting_materialized_views` | 2026-03-17 | PostgreSQL materialized views for reporting |
| `20260317_add_trgm_gin_indexes` | 2026-03-17 | GIN indexes for trigram full-text search |
| `20260317_performance_indexes` | 2026-03-17 | Batch of composite index additions |
| `20260317_performance_materialized_views` | 2026-03-17 | Additional materialized views |
| `20260320_finance_fk_relations_and_audit_fields` | 2026-03-20 | Finance FK constraints + audit fields (latest) |

### 6.2 Utility Scripts (not Prisma migrations)

| File | Purpose |
|---|---|
| `partitioning.sql` | Base partitioning SQL for core tables |
| `partitioning-orders.sql` | Orders table-specific partitioning script |
| `seed-master-orders.ts` | TypeScript seed data for master orders |

### 6.3 Latest Migration

The latest migration is `20260320_finance_fk_relations_and_audit_fields` (2026-03-20), which added explicit FK relations and audit fields to the Finance module.

### 6.4 Migration Observations

- The `20260317_*` batch (5 migrations in one day) introduced GIN trigram indexes, materialized views, and partial indexes — this is a significant performance tuning batch
- Materialized views are managed outside Prisma schema since Prisma does not support views natively; they live in raw SQL migration files
- The partitioning scripts (`partitioning.sql`, `partitioning-orders.sql`) are in the `migrations/` directory but are plain SQL scripts, not Prisma migration folders — they require manual application or separate tooling

---

## 7. Additional Observations

### 7.1 Polymorphic Reference Pattern

Several models use string-typed `entityId` / `referenceId` for polymorphic associations:

| Model | Polymorphic Fields |
|---|---|
| `AuditLog` | `entity String`, `entityId String?` — references any table |
| `Approval` | `type ApprovalType`, `referenceId String` — any approvable entity |
| `Task` | `entityType String?`, `entityId String?` — ORDER, CUSTOMER, APPROVAL |
| `Document` | `entityType DocumentEntityType`, `entityId String` |
| `Notification` | `type NotificationType?`, `referenceId String?` |
| `ChatConversation` | `referenceType String?`, `referenceId String?` — ORDER, APPROVAL |

This pattern is pragmatic for an ERP with many entity types but has trade-offs: no FK enforcement, no cascade on referenced entity deletion, and harder to join. Consider documenting the valid `entityType`/`referenceId` combinations and enforcing them at the application service layer.

### 7.2 Self-Referential Models

| Model | Relation | Use Case |
|---|---|---|
| `User` | `leaderId -> User` | Sales hierarchy (Sale -> Leader -> Director) |
| `Employee` | `managerId -> Employee` | Org chart |
| `Contract` | `parentId -> Contract` | Appendix contracts |
| `Quotation` | `parentQuotationId -> Quotation` | Version history |
| `Objective` | `parentId -> Objective` | OKR tree |
| `DriveFolder` | `parentId -> DriveFolder` | Nested folders |
| `WikiPage` | `parentId -> WikiPage` | Wiki page tree |
| `Page` (CMS) | `parentId -> Page` | CMS page hierarchy |
| `BlogCategory` | `parentId -> BlogCategory` | Category tree |
| `BlogComment` | `parentId -> BlogComment` | Reply threads |
| `PostComment` | `parentId -> PostComment` | Reply threads |
| `ChatMessage` | `replyToId -> ChatMessage` | Message replies |
| `MenuItem` | `parentId -> MenuItem` | Menu hierarchy |
| `ApprovalFlowNode` | `outgoing/incoming edges` | DAG-based approval flow |

All hierarchical models use adjacency list pattern (parent FK on same table). For deeply nested structures like Wiki pages or Drive folders, consider adding a `path` or `ancestors` materialized path column if tree traversal becomes a performance issue at scale.

### 7.3 Idempotency Keys

Three mechanisms prevent duplicate financial records:

1. `PaymentVoucher.bankTraceId` — `@unique` — bank transaction deduplication
2. `WalletTransaction.bankTraceId` — `@unique` — wallet credit deduplication
3. `SyncLog.idempotencyKey` — `@unique` — external sync deduplication
4. `BankWebhookTransaction.bankTraceId` — `@unique` — webhook deduplication

This is a strong design pattern that prevents double-crediting. Ensure the application always sets `bankTraceId` before writing, and catches unique constraint violations to return idempotent responses.

### 7.4 Exchange Rate Snapshot Pattern

Multiple models store exchange rate snapshots to lock the rate at transaction time:

- `OrderItem.exchangeRateUsed` — rate at time of purchase
- `SupplierOrder.exchangeRateUsed` — rate at time of supplier order
- `QuotationItem.exchangeRateSnapshot` — rate at time of quotation
- `Quotation.exchangeRateSnapshot` — rate at quotation level
- `PaymentVoucher.exchangeRateAtOrder` + `exchangeRateAtPayment` + `exchangeRateDiff` — full rate lifecycle
- `CustomsDeclaration.exchangeRateUsed` — rate at customs declaration

This correctly implements the REAL vs DECLARED principle from the architecture spec. The `ExchangeRate` table (`@@unique([from, to, date])`) serves as the canonical rate source.

---

## 8. Summary Scorecard

| Category | Assessment | Score |
|---|---|---|
| Schema completeness | 176 models covering all business domains | Excellent |
| Naming conventions | Consistent camelCase/snake_case mapping | Excellent |
| Monetary precision | Decimal(18,2) throughout | Excellent |
| Index coverage | Comprehensive composite indexes on hot paths | Very Good |
| Soft delete consistency | Selective — not universal | Needs Review |
| Audit trail | AuditLog + AuditLogArchive pattern | Very Good |
| Cascade safety | Several risky Cascade deletes on financial data | Needs Fix |
| Enum usage | Strong enum coverage for FSM states | Very Good |
| String-based status | 5-6 models still use plain strings | Needs Improvement |
| Idempotency | bankTraceId unique constraints in place | Excellent |
| Partitioning readiness | Scripts exist; implementation status unclear | Needs Verification |
| N+1 risk mitigation | Responsibility of service layer; schemas do not prevent | Application-level |

---

*Generated by Claude Code — TBS ERP Backend Developer Agent*
*Schema files read: 36 | Models documented: 176 | Migrations listed: 18*
