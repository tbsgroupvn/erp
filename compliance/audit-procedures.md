# TBS ERP - Formal Audit Procedures

## 1. Quarterly Internal Audit Checklist

### 1.1 Access Control Review
- [ ] Review all user accounts — disable inactive (>90 days)
- [ ] Verify role assignments match current job functions
- [ ] Check for orphaned accounts (employees who left)
- [ ] Review CEO/COO level access grants
- [ ] Verify 2FA enforcement for privileged accounts
- [ ] Review OAuth linked accounts
- [ ] Check API key expiry and usage (`ApiKey` table)

### 1.2 Data Security Review
- [ ] Verify field-level encryption is active (`EncryptionService`)
- [ ] Check encryption key age (rotate if >90 days)
- [ ] Review audit log completeness (`AuditLog` table)
- [ ] Verify backup success rate (daily/weekly/monthly)
- [ ] Test backup restore procedure (`scripts/verify-backup.sh`)
- [ ] Review data retention policy execution (`DataRetentionReport` table)

### 1.3 Infrastructure Review
- [ ] Check SSL certificate expiry (>30 days remaining)
- [ ] Review Nginx security headers (CSP, HSTS, X-Frame-Options)
- [ ] Verify WAF rules are active and updated
- [ ] Check Docker image vulnerabilities (Trivy scan)
- [ ] Review npm dependency vulnerabilities (npm audit)
- [ ] Verify monitoring alerts are functional (Prometheus + Grafana)

### 1.4 Application Security Review
- [ ] Review OWASP ZAP scan results from CI/CD
- [ ] Check Semgrep SAST findings
- [ ] Review rate limiting effectiveness
- [ ] Test CSRF protection
- [ ] Verify input validation on critical endpoints
- [ ] Review error handling (no sensitive data in responses)

### 1.5 Compliance Review
- [ ] Verify consent records are current (`UserConsent` table)
- [ ] Check data subject requests processed within SLA
- [ ] Review cross-border data transfers (CN↔VN)
- [ ] Verify privacy policy version is current (`LegalDocument` table)
- [ ] Check NĐ 13/2023 compliance gaps

## 2. Annual External Audit Requirements

### 2.1 Scope
- Full penetration test (see `compliance/pentest-framework.md`)
- Code review of authentication and authorization modules
- Infrastructure security assessment
- Data flow analysis and privacy impact assessment
- Business continuity and disaster recovery test

### 2.2 Required Documentation
- System architecture diagram
- Data flow diagrams (`compliance/data-flow-diagram.md`)
- Access control matrix (RBAC roles and permissions)
- Incident response plan (`compliance/incident-response-plan.md`)
- Business continuity plan
- Third-party vendor assessment

### 2.3 Auditor Access
- Read-only database access to staging environment
- Access to CI/CD pipeline results
- Access to monitoring dashboards (Grafana, Kibana)
- Access to compliance documentation
- Interview with DPO and development team

## 3. Evidence Collection

### 3.1 Automated Evidence
| Evidence | Source | Frequency | Retention |
|----------|--------|-----------|-----------|
| Audit logs | `AuditLog` table | Real-time | 2 years active + archive |
| Access logs | Nginx access.log | Real-time | 90 days |
| Authentication events | Sentry + Prometheus | Real-time | 30 days metrics, 90 days logs |
| Vulnerability scans | GitHub Security SARIF | Per CI/CD run | Indefinite |
| Backup verification | `scripts/verify-backup.sh` | Weekly | 90 days |
| Health check results | Prometheus + Grafana | 15s intervals | 30 days |
| Consent records | `UserConsent` table | Real-time | Indefinite |
| Data retention reports | `DataRetentionReport` table | Daily | 2 years |

### 3.2 Manual Evidence
| Evidence | Owner | Frequency | Storage |
|----------|-------|-----------|---------|
| Penetration test reports | Security team | Quarterly | Secure file storage |
| Access review sign-offs | HR + IT | Quarterly | compliance/ directory |
| Incident post-mortems | Engineering | Per incident | Internal wiki |
| Training completion records | HR | Annual | HR system |
| Vendor security assessments | Procurement | Annual | Secure file storage |
| Policy acknowledgments | All staff | Annual | HR system |

## 4. Change Management Procedures

### 4.1 Standard Changes (Low Risk)
- UI text changes, documentation updates
- **Approval**: Team lead
- **Testing**: Automated CI/CD
- **Deployment**: Standard pipeline

### 4.2 Normal Changes (Medium Risk)
- New features, bug fixes, dependency updates
- **Approval**: Team lead + code review
- **Testing**: CI/CD + staging verification
- **Deployment**: Blue/green with health monitoring

### 4.3 Emergency Changes (High Risk)
- Security patches, critical bug fixes
- **Approval**: CTO (verbal, documented post-facto)
- **Testing**: Smoke test minimum
- **Deployment**: Direct with rollback ready
- **Post-change**: Full review within 48 hours

### 4.4 Major Changes (Critical Risk)
- Database schema changes, infrastructure changes, security model changes
- **Approval**: CTO + CEO
- **Testing**: Full regression + load test
- **Deployment**: Scheduled maintenance window, blue/green
- **Rollback**: Database migration rollback script required (`scripts/db-rollback.sh`)

## 5. Audit Schedule

| Month | Activity |
|-------|---------|
| January | Q4 internal audit, annual planning |
| February | External pentest (Q1) |
| March | Access review, key rotation |
| April | Q1 internal audit |
| May | External pentest (Q2), DR test |
| June | Access review, compliance review |
| July | Q2 internal audit |
| August | External pentest (Q3) |
| September | Access review, annual external audit prep |
| October | Q3 internal audit, annual external audit |
| November | External pentest (Q4), remediation |
| December | Access review, annual compliance report |
