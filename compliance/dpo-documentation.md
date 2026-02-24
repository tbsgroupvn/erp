# TBS ERP - Data Protection Officer (DPO) Documentation

## 1. DPO Appointment

### Role
The Data Protection Officer is responsible for ensuring TBS Logistics' compliance with Vietnamese data protection law (Nghị định 13/2023/NĐ-CP) and international best practices.

### Responsibilities
- Monitor compliance with NĐ 13/2023 and internal data protection policies
- Advise on Data Protection Impact Assessments (DPIA)
- Act as point of contact for data subjects and regulatory authorities
- Conduct regular data protection audits
- Manage data breach notifications
- Oversee data subject request processing
- Ensure staff training on data protection

### Reporting
- Reports directly to CEO
- Independent authority on data protection decisions
- Quarterly reports to management on compliance status

## 2. Data Processing Activities Register

### 2.1 Customer Data

| Activity | Purpose | Legal Basis | Data Categories | Retention | Cross-Border |
|----------|---------|-------------|-----------------|-----------|-------------|
| Order processing | Contract fulfillment | Contract (Art. 9) | Name, phone, email, address | 5 years (tax law) | VN→CN (package data only) |
| Customer communication | Service updates | Legitimate interest | Email, phone | Account lifetime | No |
| Marketing | Promotion | Consent | Email, preferences | Until revocation | No |
| Analytics | Service improvement | Consent | Usage data (anonymized) | 2 years | No |

### 2.2 Employee Data

| Activity | Purpose | Legal Basis | Data Categories | Retention | Cross-Border |
|----------|---------|-------------|-----------------|-----------|-------------|
| Payroll | Employment contract | Contract | Salary, bank account, tax ID | 10 years (tax law) | No |
| Attendance | Work tracking | Contract | Check-in/out times | 5 years | No |
| Performance review | HR management | Legitimate interest | Review scores, comments | 3 years | No |
| Access control | Security | Legitimate interest | Login records, IP addresses | 2 years | No |

### 2.3 System Data

| Activity | Purpose | Legal Basis | Data Categories | Retention | Cross-Border |
|----------|---------|-------------|-----------------|-----------|-------------|
| Audit logging | Security & compliance | Legal obligation | User actions, IP, timestamps | 2 years + archive | No |
| Error tracking | System reliability | Legitimate interest | Stack traces, request data | 90 days (Sentry) | Yes (Sentry cloud) |
| Analytics | Performance | Legitimate interest | Anonymized metrics | 30 days (Prometheus) | No |

## 3. Data Protection Impact Assessment (DPIA) Template

### When Required
- Processing personal data at scale (>1000 records)
- New integration with external systems
- Cross-border data transfers
- Processing sensitive data (financial, health)
- Automated decision-making

### DPIA Template

```
Project: [Name]
Date: [YYYY-MM-DD]
Assessor: [Name]
Status: [Draft / Under Review / Approved / Rejected]

1. DESCRIPTION OF PROCESSING
   - What data is being processed?
   - Why is it being processed?
   - How is it being processed?
   - Who has access?

2. NECESSITY AND PROPORTIONALITY
   - Is the processing necessary for the purpose?
   - Is there a less intrusive alternative?
   - How is data minimization ensured?

3. RISKS TO DATA SUBJECTS
   | Risk | Likelihood | Impact | Overall | Mitigation |
   |------|-----------|--------|---------|------------|
   | Unauthorized access | | | | |
   | Data breach | | | | |
   | Excessive collection | | | | |
   | Cross-border exposure | | | | |

4. MEASURES TO MITIGATE RISKS
   - Technical measures (encryption, access control, etc.)
   - Organizational measures (training, policies, etc.)
   - Contractual measures (DPA with processors, etc.)

5. CONSULTATION
   - DPO opinion: [Approve / Reject / Conditions]
   - Management decision: [Proceed / Modify / Cancel]

6. REVIEW
   - Next review date: [YYYY-MM-DD]
   - Triggered by: [Schedule / Change in processing]
```

## 4. Subject Access Request (SAR) Procedure

### 4.1 Process

```
Day 0: Request received
  ↓
Day 1-2: Verify identity (email confirmation + ID)
  ↓
Day 3-5: Locate all data across systems
  ↓
  API: POST /api/v1/data-retention/user/:id/export
  ↓
Day 5-7: Review data for third-party information
  ↓
Day 7-10: Prepare and deliver response
  ↓
Day 10: Log completion in audit trail
```

### 4.2 Response SLA
- **Access request**: 15 days (NĐ 13/2023)
- **Rectification**: 7 days
- **Deletion/Anonymization**: 15 days
- **Data portability**: 15 days

### 4.3 Technical Implementation
- Data export: `DataRetentionService.exportUserData()` → `src/modules/data-retention/data-retention.service.ts`
- Data anonymization: `DataRetentionService.anonymizeUserData()` → same file
- Consent management: `ConsentService` → `src/modules/consent/consent.service.ts`

### 4.4 Exemptions
- Financial records required by tax law (Luật Kế toán 2015, Art. 41) — inform user of legal basis
- Ongoing legal proceedings
- Data required for legitimate defense of legal claims

## 5. Data Breach Register

### Template
```
Breach ID: DB-YYYY-NNN
Date Detected: [YYYY-MM-DD HH:MM]
Date Contained: [YYYY-MM-DD HH:MM]
Date Reported to Authority: [YYYY-MM-DD HH:MM] (within 72h)
Date Users Notified: [YYYY-MM-DD HH:MM] (within 72h)

Description: [What happened]
Data Affected: [Categories and volume]
Users Affected: [Count and segments]
Root Cause: [Technical details]
Containment Actions: [Steps taken]
Remediation Actions: [Fixes applied]
Preventive Measures: [Future safeguards]
Regulatory Correspondence: [Reference numbers]
Status: [Open / Closed]
Post-Mortem: [Link to post-mortem document]
```

## 6. Third-Party Assessment Checklist

### Before Onboarding
- [ ] Data Processing Agreement (DPA) signed
- [ ] Security certifications verified (SOC 2, ISO 27001)
- [ ] Data residency confirmed (preferably Vietnam/Singapore)
- [ ] Breach notification clause included (72h)
- [ ] Sub-processor disclosure obtained
- [ ] Data minimization requirements defined
- [ ] Encryption requirements specified (TLS 1.2+, AES-256 at rest)
- [ ] Access control requirements defined
- [ ] Audit rights confirmed
- [ ] Exit/data return clause included

### Current Third Parties

| Provider | Service | Data Shared | DPA Status | Last Review |
|----------|---------|-------------|------------|-------------|
| Sentry | Error tracking | Stack traces, request data | Pending | - |
| Google Cloud | OAuth | Email, profile | Standard | - |
| Microsoft Azure | OAuth | Email, profile | Standard | - |
| SpeedSMS | SMS OTP | Phone numbers | Pending | - |

## 7. Training Records

### Required Training

| Training | Audience | Frequency | Duration |
|----------|----------|-----------|----------|
| Data protection basics | All staff | Annual | 1 hour |
| Secure coding practices | Developers | Semi-annual | 2 hours |
| Incident response | Engineering | Quarterly | 1 hour |
| RBAC & access control | Managers | Annual | 30 minutes |
| Data breach response | Management | Annual | 1 hour |

### Training Content Sources
- NĐ 13/2023/NĐ-CP requirements
- OWASP Top 10 awareness
- TBS ERP security features (2FA, encryption, audit trail)
- Incident response procedures (`compliance/incident-response-plan.md`)
- Data handling procedures (this document)

## 8. Compliance Metrics Dashboard

### Key Performance Indicators

| Metric | Target | Measurement |
|--------|--------|-------------|
| SAR response time | <15 days | Average from receipt to delivery |
| Consent rate | >95% | Active consents / total users |
| Breach notification time | <72 hours | Detection to authority notification |
| Access review completion | 100% quarterly | Reviews completed / reviews required |
| Training completion | 100% annual | Staff trained / total staff |
| Backup success rate | >99.9% | Successful backups / total scheduled |
| Encryption coverage | 100% PII | Encrypted fields / total PII fields |
| 2FA adoption | >90% privileged users | 2FA enabled / privileged accounts |
