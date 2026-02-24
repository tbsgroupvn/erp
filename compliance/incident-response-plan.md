# TBS ERP - Incident Response Plan

## 1. Severity Levels

| Level | Description | Examples |
|-------|-------------|---------|
| **SEV1** (Critical) | System down, data breach, financial loss | Database corruption, unauthorized access, payment system failure |
| **SEV2** (Major) | Performance degraded, partial functionality loss | API response >5s, module unavailable, replication lag >30s |
| **SEV3** (Minor) | Non-critical feature issues | Report generation slow, UI rendering bug, non-critical integration down |
| **SEV4** (Low) | Enhancement requests, cosmetic | Typo fixes, minor UI improvements |

## 2. Response Times

| Severity | Initial Response | Resolution Target | Escalation |
|----------|-----------------|-------------------|------------|
| SEV1 | 15 minutes | 4 hours | Immediate to CEO/CTO |
| SEV2 | 30 minutes | 8 hours | 2 hours to CTO |
| SEV3 | 4 hours | 48 hours | 24 hours to Team Lead |
| SEV4 | 24 hours | Next sprint | N/A |

## 3. Incident Response Steps

### 3.1 Detection
- **Automated**: Sentry alerts, Prometheus alerting rules, Grafana thresholds
- **Manual**: User reports, monitoring dashboard review, log analysis
- **Tools**: Sentry (`src/config/sentry.config.ts`), Prometheus (`monitoring/prometheus/alerts.yml`), ELK Stack

### 3.2 Triage
1. Assign severity level
2. Create incident channel (Slack: #incident-YYYY-MM-DD)
3. Assign Incident Commander (IC)
4. Notify stakeholders per severity matrix

### 3.3 Containment
- **SEV1**: Activate rollback (`scripts/rollback.sh`), isolate affected systems
- **SEV2**: Scale up resources, enable maintenance mode for affected module
- **Network**: Use WAF rules to block malicious traffic (`nginx/modsecurity/custom-rules.conf`)
- **Data**: Revoke compromised sessions, rotate affected secrets via Vault

### 3.4 Eradication
1. Identify root cause via logs (Kibana) and metrics (Grafana)
2. Apply fix to staging first
3. Run load tests (`tests/load/smoke.js`) against fix
4. Deploy fix via blue/green deployment (`scripts/blue-green-deploy.sh`)

### 3.5 Recovery
1. Verify system health (`/api/v1/health/ready`)
2. Run smoke tests against production
3. Monitor error rates for 30 minutes post-fix
4. Restore from backup if data corruption (`scripts/restore.sh`)

### 3.6 Post-Mortem
1. Create post-mortem document within 48 hours
2. Include: Timeline, Root Cause, Impact, Actions Taken, Lessons Learned
3. Share with engineering team
4. Create follow-up tasks for preventive measures
5. Update runbooks and monitoring

## 4. Data Breach Response (per ND 13/2023/ND-CP)

### 4.1 Immediate Actions (0-24 hours)
1. Contain the breach - revoke access, block IPs
2. Preserve evidence - snapshot logs, database state
3. Assess scope - which data, how many users affected
4. Activate legal team

### 4.2 Notification (24-72 hours)
- **Users**: Notify affected users within 72 hours (Article 20)
- **Authority**: Report to Ministry of Public Security within 72 hours
- **Content**: Nature of breach, data affected, measures taken, contact info

### 4.3 Remediation
1. Fix vulnerability
2. Re-encrypt affected data (key rotation: `src/scripts/rotate-encryption-key.ts`)
3. Force password reset for affected users
4. Revoke all active sessions
5. Update security monitoring rules

### 4.4 Documentation
- Incident report filed in compliance system
- Audit log preserved (`AuditLog` + `AuditLogArchive`)
- Forensic analysis documented
- Regulatory correspondence archived

## 5. Contact Matrix

| Role | Responsibility | Escalation |
|------|---------------|------------|
| On-Call Engineer | First responder, initial triage | Team Lead |
| Team Lead | Technical decision making | CTO |
| CTO | Architecture decisions, resource allocation | CEO |
| CEO | Business decisions, external communication | Board |
| DPO | Data breach assessment, regulatory notification | Legal |

## 6. Runbooks

### 6.1 Database Recovery
```bash
# 1. Check latest backup
ls -la /backups/daily_*.dump.gz | tail -5

# 2. Verify backup integrity
./scripts/verify-backup.sh /backups/daily_latest.dump.gz

# 3. Restore
./scripts/restore.sh /backups/daily_latest.dump.gz --force

# 4. Run migrations
npx prisma migrate deploy
```

### 6.2 Service Rollback
```bash
# Quick rollback (< 2 minutes)
./scripts/rollback.sh

# Verify health
curl -sf https://api.tbslogistics.com/api/v1/health/ready
```

### 6.3 Secret Rotation
```bash
# Via Vault
vault kv put secret/data/tbs-erp JWT_SECRET=$(openssl rand -hex 64)

# Force all sessions to re-authenticate
psql $DATABASE_URL -c "DELETE FROM \"Session\" WHERE \"expiresAt\" > NOW()"
```

## 7. Review Schedule
- **Monthly**: Review incident metrics, update contact matrix
- **Quarterly**: Tabletop exercise, review and update this plan
- **Annually**: Full incident simulation, external audit
