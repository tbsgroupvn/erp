# TBS ERP Compliance Documentation

## Overview

This directory contains the compliance posture documentation for TBS ERP, a logistics and supply chain management system operating between Vietnam and China.

TBS ERP handles sensitive data including:
- **Personal data** of employees, customers, and business contacts
- **Financial records** including invoices, payment vouchers, and accounting data
- **Cross-border logistics data** between China and Vietnam warehouses
- **Business intelligence** including pricing, contracts, and commission structures

## Regulatory Framework

### Primary Regulations

| Regulation | Jurisdiction | Relevance |
|---|---|---|
| **Nghi dinh 13/2023/ND-CP** | Vietnam | Personal data protection |
| **Luat Ke toan 2015** (Accounting Law) | Vietnam | Financial record retention |
| **ISO 27001:2022** | International | Information security management |
| **SOC 2 Type II** | International | Trust service criteria |

### Key Compliance Areas

1. **Data Protection** — NĐ 13/2023/NĐ-CP compliance for personal data processing
2. **Data Retention** — Automated policies aligned with Vietnamese tax law
3. **Consent Management** — User consent tracking with audit trail
4. **Data Classification** — ISO 27001 A.8 compliant data sensitivity levels
5. **Cross-border Transfer** — China-Vietnam data flow controls (NĐ 13/2023 Article 26)
6. **Access Control** — RBAC + Data Scope + JWT + 2FA (ISO 27001 A.9)
7. **Audit Logging** — Complete CUD operation logging (ISO 27001 A.12)

## Technical Implementation

### Backend Modules

| Module | Path | Purpose |
|---|---|---|
| Data Retention | `tbs-erp-backend/src/modules/data-retention/` | Automated data lifecycle management |
| Consent Management | `tbs-erp-backend/src/modules/consent/` | User consent CRUD + audit trail |
| Audit Logging | `tbs-erp-backend/src/common/interceptors/audit-log.interceptor.ts` | CUD operation logging |
| Data Classification | `tbs-erp-backend/src/common/decorators/data-classification.decorator.ts` | Endpoint sensitivity labels |
| RBAC | `tbs-erp-backend/src/core/rbac/` | Role-based access control |
| Auth | `tbs-erp-backend/src/core/auth/` | JWT + 2FA authentication |

### Database Models

| Model | Schema File | Purpose |
|---|---|---|
| UserConsent | `prisma/schema/auth.prisma` | Consent records with IP/UA tracking |
| AuditLog | `prisma/schema/auth.prisma` | Active audit log records |
| AuditLogArchive | `prisma/schema/auth.prisma` | Archived audit logs (>2 years) |
| DataRetentionReport | `prisma/schema/auth.prisma` | Retention execution reports |
| LegalDocument | `prisma/schema/system.prisma` | Versioned legal documents |

## Documents in This Directory

| Document | Description |
|---|---|
| [nd13-2023-checklist.md](./nd13-2023-checklist.md) | NĐ 13/2023/NĐ-CP compliance checklist |
| [iso27001-controls.md](./iso27001-controls.md) | ISO 27001 Annex A control mapping |
| [soc2-readiness.md](./soc2-readiness.md) | SOC 2 Type II readiness assessment |
| [data-flow-diagram.md](./data-flow-diagram.md) | Data flow documentation |

## Responsible Parties

| Role | Responsibility |
|---|---|
| CEO | Final authority on data retention, user anonymization |
| COO | Review retention policies, access compliance reports |
| Chief Accountant | Financial record retention compliance |
| IT Lead | Technical implementation and monitoring |

## Review Schedule

- **Quarterly**: Review retention reports and consent metrics
- **Semi-annually**: Update compliance checklists against regulation changes
- **Annually**: Full compliance audit with external assessor
