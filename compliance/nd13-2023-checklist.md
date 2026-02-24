# Nghi dinh 13/2023/ND-CP Compliance Checklist

## Overview

Nghi dinh 13/2023/ND-CP (Decree 13/2023) is Vietnam's comprehensive personal data protection regulation, effective from July 1, 2023. This document maps the decree's requirements to TBS ERP's technical implementations.

**Last reviewed**: 2025-01-15
**Next review**: 2025-07-15
**Reviewer**: [To be assigned]

---

## Chapter II: Personal Data Processing

### Article 9 — Consent for Data Processing

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| Obtain consent before processing personal data | `UserConsent` model tracks consent with timestamps | Implemented | `tbs-erp-backend/prisma/schema/auth.prisma` — UserConsent model |
| Consent must be specific and informed | Consent types: `data_processing`, `marketing`, `analytics`, `third_party_sharing` | Implemented | `tbs-erp-backend/src/modules/consent/dto/consent.dto.ts` — ConsentType enum |
| Record evidence of consent | IP address and user agent recorded with each consent action | Implemented | `tbs-erp-backend/src/modules/consent/consent.service.ts` — grantConsent() |
| Support consent withdrawal | `POST /consent/revoke` endpoint | Implemented | `tbs-erp-backend/src/modules/consent/consent.controller.ts` |
| Version-tracked consent | `version` field links consent to specific policy version | Implemented | UserConsent model — `@@unique([userId, consentType, version])` |

### Article 11 — Data Minimization

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| Collect only necessary data | Registration requires only email, password, fullName, role | Implemented | `tbs-erp-backend/src/core/auth/dto/register.dto.ts` |
| Retention limits on data | Automated data retention policies with scheduled cleanup | Implemented | `tbs-erp-backend/src/modules/data-retention/data-retention.service.ts` |
| Delete data when no longer needed | Cron job runs daily: expired sessions, old notifications, temp files | Implemented | `DataRetentionService.executeRetentionPolicies()` — `@Cron(EVERY_DAY_AT_MIDNIGHT)` |
| Purpose-bound processing | Data classification decorator marks endpoint sensitivity levels | Implemented | `tbs-erp-backend/src/common/decorators/data-classification.decorator.ts` |

### Article 14 — Right to Access / Data Portability

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| Users can request their data | `POST /data-retention/user/:id/export` endpoint | Implemented | `tbs-erp-backend/src/modules/data-retention/data-retention.controller.ts` |
| Export in structured format | JSON export with profile, sessions, consents, orders, tasks, notifications | Implemented | `DataRetentionService.exportUserData()` |
| Log export requests | Export action logged in audit trail with timestamp and requester | Implemented | Audit log entry with action `EXPORT_USER_DATA` |

### Article 16 — Right to Deletion / Anonymization

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| Users can request data deletion | `POST /data-retention/user/:id/anonymize` endpoint | Implemented | `tbs-erp-backend/src/modules/data-retention/data-retention.controller.ts` |
| Anonymize personal data | PII replaced: email, phone, name, 2FA data, bank details | Implemented | `DataRetentionService.anonymizeUserData()` |
| Retain legally required records | Financial/tax records preserved per Luat Ke toan 2015 (5+ years) | Implemented | Orders and payment records not deleted, only PII removed |
| Log deletion requests | Anonymization action logged with reason and legal basis | Implemented | AuditLog entry with action `ANONYMIZE` |
| Automatic anonymization of inactive users | Users inactive >30 days auto-anonymized in nightly cron | Implemented | `DataRetentionService.anonymizeDeletedUsers()` |

### Article 20 — Data Breach Notification

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| Detect security incidents | Sentry error tracking + structured logging | Implemented | `tbs-erp-backend/src/config/sentry.config.ts` |
| Notify within 72 hours | Sentry alerts configured for security-related errors | Partial | Alert routing to responsible parties needs configuration |
| Document breach details | Audit logs capture all CUD operations with IP addresses | Implemented | `tbs-erp-backend/src/common/interceptors/audit-log.interceptor.ts` |
| Notify affected individuals | Notification service supports email/SMS/push/Zalo channels | Implemented | `tbs-erp-backend/src/modules/notification/notification.service.ts` |

**Action Item**: Configure Sentry alert rules for authentication failures, unauthorized access attempts, and data export events. Set up notification workflow for 72-hour breach reporting to authorities.

### Article 25 — Data Processing Impact Assessment

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| Assess impact of processing activities | Data classification system categorizes all endpoints | Implemented | `DataClassification` enum: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED |
| Document processing purposes | Retention policies document purpose and legal basis for each entity | Implemented | `DataRetentionService.getRetentionPolicies()` |
| Review periodically | Compliance review schedule documented | Planned | `compliance/README.md` — Review Schedule section |

### Article 26 — Cross-border Data Transfer

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| Assess data protection in destination country | China warehouse operations documented | Partial | `compliance/data-flow-diagram.md` — Cross-border section |
| Obtain consent for transfer | `third_party_sharing` consent type available | Implemented | `ConsentType.THIRD_PARTY_SHARING` |
| Implement technical safeguards | TLS 1.2/1.3 for all API communication | Implemented | `nginx/nginx.conf` — SSL configuration |
| Minimize data transferred cross-border | CN warehouse receives only operational data (package IDs, weights, dimensions) | Implemented | `tbs-erp-backend/src/modules/warehouse-cn/` |

**Action Items**:
1. Document specific data fields transferred to China warehouse systems
2. Implement data transfer logging for cross-border operations
3. Conduct formal Data Transfer Impact Assessment (DTIA)

---

## Chapter III: Data Controller Responsibilities

### Article 27 — Organizational Measures

| Requirement | Implementation | Status |
|---|---|---|
| Appoint Data Protection Officer | Responsibility assigned to CEO/COO roles | Implemented |
| Implement data protection policies | Retention policies + classification system | Implemented |
| Train employees on data protection | Training module available in HR system | Partial |
| Maintain records of processing activities | Audit log system captures all CUD operations | Implemented |

### Article 28 — Technical Measures

| Requirement | Implementation | Status | Evidence |
|---|---|---|---|
| Encryption at rest | PostgreSQL encryption + application-level encryption for 2FA secrets | Implemented | `tbs-erp-backend/src/core/auth/auth.service.ts` |
| Encryption in transit | TLS 1.2/1.3 enforced via nginx | Implemented | `nginx/nginx.conf` |
| Access control | JWT + RBAC + Data Scope Guard + CSRF protection | Implemented | `tbs-erp-backend/src/core/rbac/`, `tbs-erp-backend/src/common/guards/` |
| Authentication | Password hashing (bcrypt) + 2FA (TOTP/SMS) | Implemented | `tbs-erp-backend/src/core/auth/` |
| Audit trail | AuditLogInterceptor on all CUD operations | Implemented | `tbs-erp-backend/src/common/interceptors/audit-log.interceptor.ts` |
| Rate limiting | Throttler module: 100 req/min global, 5 req/15min for auth | Implemented | `tbs-erp-backend/src/app.module.ts` — ThrottlerModule |
| Input sanitization | SanitizeHtml decorator for HTML content | Implemented | `tbs-erp-backend/src/common/decorators/sanitize-html.decorator.ts` |

---

## Summary

| Category | Total Requirements | Implemented | Partial | Planned |
|---|---|---|---|---|
| Consent (Art. 9) | 5 | 5 | 0 | 0 |
| Data Minimization (Art. 11) | 4 | 4 | 0 | 0 |
| Right to Access (Art. 14) | 3 | 3 | 0 | 0 |
| Right to Deletion (Art. 16) | 5 | 5 | 0 | 0 |
| Breach Notification (Art. 20) | 4 | 3 | 1 | 0 |
| Impact Assessment (Art. 25) | 3 | 2 | 0 | 1 |
| Cross-border Transfer (Art. 26) | 4 | 3 | 1 | 0 |
| Org. Measures (Art. 27) | 4 | 3 | 1 | 0 |
| Technical Measures (Art. 28) | 7 | 7 | 0 | 0 |
| **TOTAL** | **39** | **35** | **3** | **1** |

**Overall Compliance Rate: 89.7% (35/39 fully implemented)**
