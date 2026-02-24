# Data Flow Documentation

## Overview

This document describes the data flows within TBS ERP, with particular attention to:
- Personal data lifecycle (registration through deletion)
- Cross-border data transfers (China-Vietnam)
- Financial data flows (subject to Vietnamese tax law retention)
- Data classification at each stage

These flows are documented to comply with:
- **ND 13/2023/ND-CP Article 25** — Data Processing Impact Assessment
- **ND 13/2023/ND-CP Article 26** — Cross-border Data Transfer
- **ISO 27001 A.8** — Asset Management (Information Lifecycle)

---

## 1. User Data Flow

### Registration -> Storage -> Processing -> Deletion

```
[User Registration]
        |
        v
[Input Validation]  <-- class-validator DTOs
        |               tbs-erp-backend/src/core/auth/dto/register.dto.ts
        v
[Password Hashing]  <-- bcrypt with salt
        |               tbs-erp-backend/src/core/auth/auth.service.ts
        v
[User Record Created]  <-- Classification: RESTRICTED
        |                   tbs-erp-backend/prisma/schema/auth.prisma (User model)
        |
        v
[Consent Collection]  <-- Required: data_processing
        |                  Optional: marketing, analytics, third_party_sharing
        |                  tbs-erp-backend/src/modules/consent/consent.service.ts
        |
        +--------+--------+--------+
        |        |        |        |
        v        v        v        v
    [Sessions] [Audit]  [Tasks] [Orders]
    (30-day    (2-year  (active (5-year
     cleanup)  archive)  only)  retention)
        |
        v
[User Deactivation]  <-- isActive = false
        |
        v (30-day grace period)
        |
[Anonymization]  <-- PII replaced with anonymized values
        |            tbs-erp-backend/src/modules/data-retention/data-retention.service.ts
        |            - email -> anonymized_xxxx@deleted.local
        |            - fullName -> Anonymized User xxxx
        |            - phone, bankAccount, taxCode -> null
        |            - passwordHash -> 'ANONYMIZED'
        |
        v
[Audit Log Entry]  <-- action: ANONYMIZE, entity: User
                       Legal basis recorded: ND 13/2023 Art. 16
```

### Data Fields and Classification

| Field | Classification | Retention | Notes |
|---|---|---|---|
| email | RESTRICTED | Until anonymization | Unique identifier |
| phone | RESTRICTED | Until anonymization | Optional |
| passwordHash | RESTRICTED | Until anonymization | Bcrypt hashed, never exposed |
| fullName | RESTRICTED | Until anonymization | Anonymized on deletion |
| role | INTERNAL | Indefinite | Organizational data |
| 2FA secrets | RESTRICTED | Until deactivation | Encrypted at rest, cleared on anonymization |
| IP address (sessions) | RESTRICTED | 30 days after expiry | Session cleanup |
| IP address (audit logs) | INTERNAL | 2 years active, then archived | Compliance evidence |

---

## 2. Order Data Flow

### Creation -> CN Warehouse -> VN Warehouse -> Delivery -> Archive

```
[Order Creation]  <-- SALE role creates order
        |             Classification: INTERNAL
        |             tbs-erp-backend/src/modules/order/
        v
[Customer Linking]  <-- customerId references CRM
        |               Classification: CONFIDENTIAL (pricing data)
        v
[Quotation]  <-- Pricing calculation
        |        tbs-erp-backend/src/modules/quotation/
        v
[Deposit Collection]  <-- Financial transaction created
        |                  Classification: CONFIDENTIAL
        |                  tbs-erp-backend/src/modules/cash/
        v
[Sourcing / MHH]  <-- Supplier order to China
        |              tbs-erp-backend/src/modules/supplier-order/
        |
        v
+==========================================+
| CROSS-BORDER: China Operations            |
|                                          |
| [CN Warehouse Receipt]                   |
|     |  tbs-erp-backend/src/modules/      |
|     |  warehouse-cn/                     |
|     v                                    |
| [QC Inspection]                          |
|     |  tbs-erp-backend/src/modules/qc/   |
|     v                                    |
| [Packing & Consolidation]               |
|     |  tbs-erp-backend/src/modules/      |
|     |  container/                        |
|     v                                    |
| [Container Departure]                    |
|                                          |
| Data transferred: Package ID, weight,    |
| dimensions, QC status, photos            |
| Classification: INTERNAL                 |
| NO PII transferred cross-border         |
+==========================================+
        |
        v
[Customs Clearance]  <-- Classification: CONFIDENTIAL
        |                 tbs-erp-backend/src/modules/tracking/
        v
[VN Warehouse Receipt]  <-- Classification: INTERNAL
        |                     tbs-erp-backend/src/modules/warehouse-vn/
        v
[Delivery Assignment]  <-- Driver assignment
        |                   tbs-erp-backend/src/modules/fleet/
        v
[Delivery Confirmation]  <-- POD (Proof of Delivery)
        |                     tbs-erp-backend/src/modules/document/
        v
[Settlement / Invoice]  <-- Classification: CONFIDENTIAL
        |                    tbs-erp-backend/src/modules/invoice/
        v
[Order Completed]  <-- Status: COMPLETED
        |
        v (5-year minimum retention per Vietnamese tax law)
        |
[Archive Review]  <-- DataRetentionService flags for review
                      NO automatic deletion of financial data
```

### Cross-Border Data Minimization (ND 13/2023 Article 26)

Data transferred between VN system and CN Warehouse:

| Field | Transferred | Justification |
|---|---|---|
| Package ID / Code | Yes | Operational necessity |
| Weight / Dimensions | Yes | Logistics calculation |
| QC Photos | Yes | Quality verification |
| QC Status | Yes | Workflow state |
| Order Code | Yes | Reference tracking |
| Customer Name | **No** | Not needed for warehouse operations |
| Customer Phone | **No** | Not needed for warehouse operations |
| Customer Address | **No** | Not needed until VN delivery |
| Pricing / Financial | **No** | Not needed for warehouse operations |
| Employee PII | **No** | CN agent has separate account |

---

## 3. Financial Data Flow

### Invoices -> Payments -> Reports -> Archive

```
[Invoice Created]  <-- From order settlement
        |              Classification: CONFIDENTIAL
        |              tbs-erp-backend/src/modules/invoice/
        v
[Payment Voucher]  <-- Cash module processes payment
        |              Classification: CONFIDENTIAL
        |              tbs-erp-backend/src/modules/cash/
        |
        +--------+--------+
        |        |        |
        v        v        v
    [AR/AP]  [GL Entry] [Commission]
    Account  General    Sales
    Receivable/ Ledger  commission
    Payable  posting   calculation
        |
        v
[Financial Reports]  <-- Dashboard aggregation
        |                Classification: CONFIDENTIAL
        |                tbs-erp-backend/src/modules/dashboard/
        v
[Retention: 10+ years]  <-- Luat Ke toan 2015, Dieu 41
                            No automatic deletion
                            Archive only after manual review
```

### Financial Record Retention (Legal Requirements)

| Record Type | Minimum Retention | Legal Basis | Auto-Delete |
|---|---|---|---|
| Invoices | 10 years | Luat Ke toan 2015, Art. 41 (historical records) | Never |
| Payment Vouchers | 10 years | Luat Ke toan 2015, Art. 41 | Never |
| Receipt Vouchers | 10 years | Luat Ke toan 2015, Art. 41 | Never |
| General Ledger | 10 years | Luat Ke toan 2015, Art. 41 | Never |
| Orders (with financial data) | 5 years | Luat Ke toan 2015, Art. 41 (standard records) | Never (flagged for review) |
| AR/AP Records | 5 years | Luat Ke toan 2015, Art. 41 | Never |
| Commission Records | 5 years | Luat Ke toan 2015, Art. 41 | Never |
| Payroll Records | 5 years | Luat Ke toan 2015, Art. 41 | Never |

---

## 4. Audit Log Data Flow

### Event -> Log -> Archive -> Long-term Storage

```
[CUD Operation]  <-- POST, PUT, PATCH, DELETE
        |
        v
[AuditLogInterceptor]  <-- Global interceptor
        |                    tbs-erp-backend/src/common/interceptors/audit-log.interceptor.ts
        |
        |  Captures:
        |  - userId (who)
        |  - action (CREATE/UPDATE/DELETE)
        |  - entity (what)
        |  - entityId (which record)
        |  - oldData / newData (what changed)
        |  - ipAddress (from where)
        |  - timestamp (when)
        |
        v
[audit_logs table]  <-- Active storage (0-2 years)
        |                Classification: INTERNAL
        |
        v (after 2 years, nightly cron)
        |
[audit_log_archives table]  <-- Archive storage (2+ years)
        |                        Batch processing: 1000 records/batch
        |                        tbs-erp-backend/src/modules/data-retention/
        |                        data-retention.service.ts — archiveAuditLogs()
        v
[Indefinite retention]  <-- Required for compliance evidence
                            ISO 27001 A.12, ND 13/2023 Art. 26
```

### Sensitive Data Exclusion

The following fields are **excluded** from audit logs:

| Excluded Field | Reason |
|---|---|
| password | Credential — never logged |
| currentPassword | Credential — never logged |
| newPassword | Credential — never logged |
| passwordHash | Credential — never logged |
| token | Session credential |
| refreshToken | Session credential |
| resetToken | Password reset credential |

Source: `tbs-erp-backend/src/common/interceptors/audit-log.interceptor.ts` — `SENSITIVE_FIELDS` constant

### Excluded Paths (No Audit Logging)

| Path | Reason |
|---|---|
| /auth/login | Credential submission |
| /auth/register | Credential submission |
| /auth/change-password | Credential change |
| /auth/reset-password | Credential reset |
| /auth/forgot-password | Credential recovery |

---

## 5. Consent Data Flow

```
[User Action]  <-- Grant or revoke consent
        |
        v
[Consent Controller]  <-- Captures IP + User Agent
        |                   tbs-erp-backend/src/modules/consent/consent.controller.ts
        v
[Consent Service]  <-- Validates user, upserts consent record
        |               tbs-erp-backend/src/modules/consent/consent.service.ts
        |
        +--------+--------+
        |                  |
        v                  v
[user_consents]       [audit_logs]
Consent record        Audit entry with
with IP + UA          action: CONSENT_GRANTED
                      or CONSENT_REVOKED
```

### Consent Types and Their Impact

| Consent Type | Impact if Revoked | Required |
|---|---|---|
| `data_processing` | Core service functionality may be limited | Yes (for service use) |
| `marketing` | No marketing emails/notifications | No |
| `analytics` | Usage data not collected for analytics | No |
| `third_party_sharing` | Data not shared with partners/CN warehouse beyond operational minimum | No |

---

## 6. Data Retention Automated Flow

```
[Daily Midnight Cron]  <-- Asia/Ho_Chi_Minh timezone
        |                   @Cron(EVERY_DAY_AT_MIDNIGHT)
        v
[DataRetentionService.executeRetentionPolicies()]
        |
        +-- [1. Archive Audit Logs]     (>2 years -> audit_log_archives)
        |
        +-- [2. Clean Sessions]          (>30 days expired -> DELETE)
        |
        +-- [3. Flag Old Orders]         (>5 years completed -> LOG WARNING, no delete)
        |
        +-- [4. Clean Temp Files]        (>30 days soft-deleted -> DELETE)
        |
        +-- [5. Clean Notifications]     (>90 days read -> DELETE)
        |
        +-- [6. Clean Reset Tokens]      (>1 day expired -> NULLIFY)
        |
        +-- [7. Anonymize Users]         (>30 days inactive -> ANONYMIZE PII)
        |
        v
[DataRetentionReport]  <-- Persisted in data_retention_reports table
        |                   Includes: counts, duration, errors
        v
[Available via API]  <-- GET /data-retention/reports (CEO/COO only)
```

---

## Security Controls by Data Flow Stage

| Stage | Authentication | Authorization | Encryption | Audit | Classification |
|---|---|---|---|---|---|
| User Registration | None (public) | None | TLS + bcrypt | Yes | RESTRICTED |
| Login | Credentials | None | TLS + JWT | Yes (excluded) | RESTRICTED |
| Order CRUD | JWT | RBAC + Data Scope | TLS | Yes | INTERNAL |
| Financial Operations | JWT + 2FA (recommended) | RBAC (Accountant roles) | TLS | Yes | CONFIDENTIAL |
| CN Warehouse Sync | JWT | RBAC (CN Agent role) | TLS | Yes | INTERNAL |
| Data Export | JWT | CEO/COO only | TLS | Yes | RESTRICTED |
| Data Anonymization | JWT | CEO only | TLS | Yes | RESTRICTED |
| Consent Management | JWT | Self-service / CEO/COO | TLS | Yes | RESTRICTED |
| Retention Execution | System (cron) / CEO | CEO (manual) | N/A (internal) | Yes | INTERNAL |
