# TBS ERP - Operational Runbooks

**System:** TBS ORDER ERP
**Stack:** NestJS + Prisma ORM + PostgreSQL 16 + Redis 7 + BullMQ + Next.js 14 + Docker
**Last updated:** 2026-03-20
**Owner:** Engineering / DevOps

---

## How to Use This Document

Each runbook follows the format:

1. **Symptoms** - What the on-call engineer observes
2. **Diagnosis** - Commands to confirm the root cause
3. **Resolution** - Step-by-step fix, copy-pasteable commands
4. **Prevention** - Long-term measures to avoid recurrence

Container names used throughout this document:

| Service | Container Name | Port |
|---|---|---|
| PostgreSQL | `tbs_erp_postgres` | 5433 (host) / 5432 (internal) |
| Redis | `tbs_erp_redis` | 6379 |
| Backend (NestJS) | `tbs_erp_backend` | 3001 (host) / 3000 (internal) |
| Frontend (ERP) | `tbs_erp_frontend` | 3000 |
| CMS | `tbs_cms_frontend` | 3002 |
| Nginx | `tbs_erp_nginx` | 80 / 443 |
| Prometheus | `tbs_erp_prometheus` | 9090 |
| Grafana | `tbs_erp_grafana` | 3003 |

---

## Table of Contents

1. [Database Issues](#1-database-issues)
   - 1.1 [PostgreSQL Connection Pool Exhausted](#11-postgresql-connection-pool-exhausted)
   - 1.2 [Slow Queries](#12-slow-queries)
   - 1.3 [Database Backup and Restore](#13-database-backup-and-restore)
   - 1.4 [Disk Space Full](#14-disk-space-full)
2. [Application Issues](#2-application-issues)
   - 2.1 [Backend Won't Start](#21-backend-wont-start)
   - 2.2 [Frontend Build Fails](#22-frontend-build-fails)
   - 2.3 [Memory Leak](#23-memory-leak)
   - 2.4 [High CPU](#24-high-cpu)
3. [Queue Issues (BullMQ)](#3-queue-issues-bullmq)
   - 3.1 [Dead Letter Queue Overflow](#31-dead-letter-queue-overflow)
   - 3.2 [Queue Backlog](#32-queue-backlog)
   - 3.3 [Job Stuck](#33-job-stuck)
4. [Cache Issues (Redis)](#4-cache-issues-redis)
   - 4.1 [Redis Out of Memory](#41-redis-out-of-memory)
   - 4.2 [Cache Stampede](#42-cache-stampede)
   - 4.3 [Redis Connection Lost](#43-redis-connection-lost)
5. [Security Incidents](#5-security-incidents)
   - 5.1 [Rate Limit Triggered](#51-rate-limit-triggered)
   - 5.2 [Unauthorized Access Attempt](#52-unauthorized-access-attempt)
   - 5.3 [Data Breach Response](#53-data-breach-response)
6. [Business Operations](#6-business-operations)
   - 6.1 [Order Stuck in Status](#61-order-stuck-in-status)
   - 6.2 [AR Aging Auto-Block Triggered Incorrectly](#62-ar-aging-auto-block-triggered-incorrectly)
   - 6.3 [Payment Voucher Anti-Fraud Block](#63-payment-voucher-anti-fraud-block)

---

## 1. Database Issues

---

### 1.1 PostgreSQL Connection Pool Exhausted

**Severity:** P1 - Service degrading or down

#### Symptoms

- HTTP 500 responses on API calls with body: `"Can't reach database server"`
- Backend logs contain: `Error: Cannot find an available connection in the connection pool`
- Prisma error code `P1001` or `P2024` in logs
- Health endpoint `GET /api/v1/health` returns `{"status":"error","details":{"database":{"status":"down"}}}`
- Response times spike above 5 seconds before timing out

#### Diagnosis

**Step 1: Check active connections in PostgreSQL.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT count(*), state, wait_event_type, wait_event
      FROM pg_stat_activity
      WHERE datname = 'tbs_erp'
      GROUP BY state, wait_event_type, wait_event
      ORDER BY count DESC;"
```

Expected healthy output: `active` count below 20 (default pool size). Exhaustion is when total connections approach `max_connections` (default 100 in PostgreSQL).

**Step 2: See which queries are long-running (blocking others).**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT pid, now() - pg_stat_activity.query_start AS duration,
             query, state, wait_event_type, wait_event
      FROM pg_stat_activity
      WHERE datname = 'tbs_erp'
        AND state != 'idle'
        AND (now() - query_start) > interval '30 seconds'
      ORDER BY duration DESC;"
```

**Step 3: Check pool configuration in backend logs.**

```bash
docker logs tbs_erp_backend --tail=200 | grep -i "connection\|pool\|prisma"
```

**Step 4: Check current `max_connections` setting.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SHOW max_connections;"
```

#### Resolution

**Immediate: Kill long-running idle-in-transaction connections.**

```bash
# Identify PIDs to kill first (connections idle in transaction > 5 minutes)
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT pid, now() - query_start AS duration, state, query
      FROM pg_stat_activity
      WHERE datname = 'tbs_erp'
        AND state = 'idle in transaction'
        AND (now() - query_start) > interval '5 minutes';"

# Terminate specific PID (replace 1234 with actual PID)
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT pg_terminate_backend(1234);"

# Terminate ALL idle-in-transaction connections (use cautiously in production)
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = 'tbs_erp'
        AND state = 'idle in transaction'
        AND (now() - query_start) > interval '5 minutes';"
```

**Immediate: Restart backend to reset Prisma connection pool.**

```bash
docker restart tbs_erp_backend

# Verify recovery
docker logs tbs_erp_backend --follow --tail=50
# Wait for: "Database connection established." and "NestJS application is listening on port 3000"
```

**Medium-term: Increase pool size if traffic has grown.**

Edit `.env` in the project root:

```bash
DATABASE_POOL_SIZE=30   # was 20; formula: num_cores * 2 + disk_spindles
```

Then restart backend:

```bash
docker restart tbs_erp_backend
```

Also increase PostgreSQL `max_connections` if necessary (requires container restart):

```bash
# Add to postgres service command in docker-compose.yml:
# command: postgres -c max_connections=200 -c password_encryption=scram-sha-256
docker compose down postgres
docker compose up -d postgres
docker compose up -d backend
```

**Verify resolution.**

```bash
curl -s http://localhost:3001/api/v1/health | python3 -m json.tool
```

Expected: `{"status":"ok","details":{"database":{"status":"up"}}}`

#### Prevention

- Alert when active connections exceed 80% of `max_connections` (Prometheus metric: `pg_stat_activity_count`)
- Set `statement_timeout = '30s'` and `idle_in_transaction_session_timeout = '60s'` in PostgreSQL config to automatically terminate stuck queries
- Review `DATABASE_POOL_SIZE` quarterly against `pg_stat_activity` peak counts in Grafana

---

### 1.2 Slow Queries

**Severity:** P2 - Performance degraded

#### Symptoms

- API endpoints respond in 2-10 seconds instead of <100ms
- Backend logs contain `WARN Slow query (Xms)` or `ERROR CRITICAL slow query (Xms)` from `PrismaService`
- Thresholds: warn at 500ms, critical at 5000ms (hardcoded in `prisma.service.ts`)
- Grafana dashboard shows elevated p95/p99 latency
- ELK/Kibana shows high frequency of slow query log entries

#### Diagnosis

**Step 1: Find slow queries in backend logs.**

```bash
docker logs tbs_erp_backend --tail=500 | grep "Slow query\|CRITICAL slow query"
```

**Step 2: Check the PostgreSQL slow query log.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT query, calls, mean_exec_time, max_exec_time, total_exec_time, rows
      FROM pg_stat_statements
      ORDER BY mean_exec_time DESC
      LIMIT 20;"
```

Note: `pg_stat_statements` must be enabled. If not available, check `pg_stat_activity` for long-running queries.

**Step 3: Identify tables missing indexes using `QueryAnalyzerService` output.**

```bash
docker logs tbs_erp_backend --tail=1000 | grep "Sequential scan detected\|missing index\|index health"
```

Or check the weekly index health report (runs every Sunday 04:00):

```bash
docker logs tbs_erp_backend --tail=1000 | grep "tables may benefit\|unused indexes"
```

**Step 4: Run EXPLAIN ANALYZE manually for a suspected query (dev/staging only).**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT * FROM \"Order\"
      WHERE \"customerId\" = 'customer-uuid-here'
        AND \"status\" = 'DELIVERING'
      ORDER BY \"createdAt\" DESC
      LIMIT 20;"
```

Look for:
- `Seq Scan` on large tables (should be `Index Scan`)
- `rows=XXXX` very large in Nested Loop nodes
- `Sort Method: external` (spilling to disk)

**Step 5: Check table-level statistics for a specific table.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT relname AS table_name,
             seq_scan, idx_scan,
             n_live_tup AS live_rows,
             n_dead_tup AS dead_rows,
             last_autovacuum,
             pg_size_pretty(pg_total_relation_size(relid)) AS total_size
      FROM pg_stat_user_tables
      WHERE relname = 'Order';"
```

#### Resolution

**Add missing index (example for Order table).**

```bash
# Connect to database
docker exec -it tbs_erp_postgres psql -U tbs_user -d tbs_erp

# Create index CONCURRENTLY to avoid table lock in production
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  "idx_order_customer_status_created"
  ON "Order" ("customerId", "status", "createdAt" DESC);

-- Verify index was created
\d "Order"
```

**Run VACUUM ANALYZE to update planner statistics.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "VACUUM ANALYZE \"Order\";"
```

**For N+1 query patterns - check Prisma queries.** The `ARAgingCalculatorService` previously had N+1 but was fixed with batch queries. If you find new N+1 patterns:

```bash
# Enable query logging temporarily in backend .env
LOG_LEVEL=debug

# Restart to apply
docker restart tbs_erp_backend

# Watch for repeated similar queries
docker logs tbs_erp_backend --follow | grep "Query:"
```

**Check for missing `include` or `select` causing over-fetching.**

Look for Prisma queries loading entire objects when only a few fields are needed. All `findMany` should use `select` to limit projection.

#### Prevention

- Weekly index health report runs automatically every Sunday at 04:00 via `QueryAnalyzerService.weeklyIndexHealthReport()`
- Enable `pg_stat_statements` in PostgreSQL for persistent slow query history
- Set Prometheus alert for p99 API latency > 500ms for 5 minutes
- Review Grafana "Database Query Times" panel weekly
- New Prisma queries in PRs must include EXPLAIN output for tables with > 100k rows

---

### 1.3 Database Backup and Restore

**Severity:** P0 when restoring; routine otherwise

#### Backup Procedure

**Manual full backup (run from host machine).**

```bash
# Create backup directory if not exists
mkdir -p /opt/tbs-backups/postgres

# Full database dump with compression
BACKUP_FILE="/opt/tbs-backups/postgres/tbs_erp_$(date +%Y%m%d_%H%M%S).dump"

docker exec tbs_erp_postgres pg_dump \
  -U tbs_user \
  -d tbs_erp \
  --format=custom \
  --compress=9 \
  --verbose \
  > "$BACKUP_FILE"

echo "Backup saved to: $BACKUP_FILE"
ls -lh "$BACKUP_FILE"
```

**Schema-only backup (for migration auditing).**

```bash
docker exec tbs_erp_postgres pg_dump \
  -U tbs_user \
  -d tbs_erp \
  --schema-only \
  --format=plain \
  > /opt/tbs-backups/postgres/schema_$(date +%Y%m%d).sql
```

**Cron schedule (add to `/etc/cron.d/tbs-backup` on host).**

```cron
# Full backup every day at 02:00 AM
0 2 * * * root docker exec tbs_erp_postgres pg_dump -U tbs_user -d tbs_erp --format=custom --compress=9 > /opt/tbs-backups/postgres/tbs_erp_$(date +\%Y\%m\%d).dump

# Weekly backup on Sunday at 03:00 AM
0 3 * * 0 root docker exec tbs_erp_postgres pg_dump -U tbs_user -d tbs_erp --format=custom --compress=9 > /opt/tbs-backups/postgres/weekly_tbs_erp_$(date +\%Y\%m\%d).dump

# Retain daily backups for 7 days
30 2 * * * root find /opt/tbs-backups/postgres -name "tbs_erp_*.dump" -mtime +7 -delete

# Retain weekly backups for 30 days
30 3 * * 0 root find /opt/tbs-backups/postgres -name "weekly_*.dump" -mtime +30 -delete
```

**Verify backup integrity.**

```bash
# List contents of backup without restoring
docker exec -i tbs_erp_postgres pg_restore \
  --list \
  --format=custom \
  < /opt/tbs-backups/postgres/tbs_erp_YYYYMMDD.dump | head -50
```

#### Restore Procedure

**CRITICAL: Stop backend before restoring to prevent write conflicts.**

```bash
# Step 1: Stop application services (keep postgres running)
docker stop tbs_erp_backend tbs_erp_frontend tbs_cms_frontend tbs_erp_nginx

# Step 2: Drop and recreate the database
docker exec -it tbs_erp_postgres psql \
  -U tbs_user \
  -d postgres \
  -c "DROP DATABASE IF EXISTS tbs_erp;"

docker exec -it tbs_erp_postgres psql \
  -U tbs_user \
  -d postgres \
  -c "CREATE DATABASE tbs_erp OWNER tbs_user;"

# Step 3: Restore from backup
BACKUP_FILE="/opt/tbs-backups/postgres/tbs_erp_YYYYMMDD.dump"

docker exec -i tbs_erp_postgres pg_restore \
  -U tbs_user \
  -d tbs_erp \
  --format=custom \
  --verbose \
  --no-owner \
  --role=tbs_user \
  < "$BACKUP_FILE"

# Step 4: Verify row counts
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT schemaname, tablename,
             (xpath('/row/cnt/text()',
               query_to_xml(format('SELECT COUNT(*) AS cnt FROM %I.%I', schemaname, tablename),
               false, true, '')))[1]::text::int AS row_count
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;"

# Step 5: Run pending migrations
docker run --rm \
  --network tbs_network \
  -e DATABASE_URL="postgresql://tbs_user:PASSWORD@postgres:5432/tbs_erp" \
  tbs_erp_backend \
  npx prisma migrate deploy

# Step 6: Restart services
docker start tbs_erp_backend tbs_erp_frontend tbs_cms_frontend tbs_erp_nginx

# Step 7: Verify health
curl -s http://localhost:3001/api/v1/health
```

#### Prevention

- Test restore procedure in staging monthly
- Store backups in a separate storage volume or off-site (S3/object storage)
- Alert when backup file older than 25 hours
- Enable PostgreSQL WAL archiving for point-in-time recovery (PITR) in production

---

### 1.4 Disk Space Full

**Severity:** P1 - Data loss risk if writes fail

#### Symptoms

- PostgreSQL logs: `ERROR: could not write to file "pg_wal/..."`: No space left on device
- Backend logs: Prisma `P2024` or `P1001` errors
- Docker volume `tbs_erp_pgdata` consuming all available disk
- `docker stats` shows container disk I/O errors
- New orders, vouchers, or audit logs fail to save

#### Diagnosis

**Step 1: Check overall disk usage on host.**

```bash
df -h /
# Or wherever Docker volumes are stored
df -h /var/lib/docker/volumes/
```

**Step 2: Check PostgreSQL database size breakdown.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT schemaname, tablename,
             pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
             pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) AS table_size,
             pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)
               - pg_relation_size(schemaname || '.' || tablename)) AS index_size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
      LIMIT 20;"
```

**Step 3: Check WAL directory size.**

```bash
docker exec -it tbs_erp_postgres bash -c \
  "du -sh /var/lib/postgresql/data/pg_wal/"
```

**Step 4: Check dead row bloat (candidates for VACUUM).**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT relname AS table_name,
             n_dead_tup AS dead_rows,
             n_live_tup AS live_rows,
             CASE WHEN n_live_tup > 0
               THEN round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 1)
               ELSE 0
             END AS bloat_pct,
             last_autovacuum,
             last_vacuum
      FROM pg_stat_user_tables
      WHERE n_dead_tup > 1000
      ORDER BY n_dead_tup DESC
      LIMIT 20;"
```

**Step 5: Identify large audit log partitions.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT tablename,
             pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS size
      FROM pg_tables
      WHERE tablename LIKE 'AuditLog%' OR tablename LIKE 'audit_log%'
      ORDER BY pg_total_relation_size('public.' || tablename) DESC;"
```

#### Resolution

**Immediate: Free WAL space by running a checkpoint.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "CHECKPOINT;"
```

**Immediate: Run VACUUM FULL on the most bloated tables.**

```bash
# Warning: VACUUM FULL locks the table. Run during low-traffic window.
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "VACUUM FULL ANALYZE \"AuditLog\";"

# Standard VACUUM (no lock) for other tables
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "VACUUM ANALYZE;"
```

**Archive or delete old audit logs (soft-delete only; respect the REAL vs DECLARED principle).**

```bash
# Identify old audit log data
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT count(*), min(\"createdAt\"), max(\"createdAt\")
      FROM \"AuditLog\"
      WHERE \"createdAt\" < NOW() - INTERVAL '1 year';"

# Archive to separate table before deleting (DO NOT hard-delete without approval from CFO/COO)
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "CREATE TABLE IF NOT EXISTS \"AuditLog_archive_$(date +%Y)\" AS
      SELECT * FROM \"AuditLog\"
      WHERE \"createdAt\" < NOW() - INTERVAL '1 year';"

# Only delete AFTER confirming archive is complete and backed up
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "DELETE FROM \"AuditLog\"
      WHERE \"createdAt\" < NOW() - INTERVAL '1 year';"

# Reclaim space
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "VACUUM FULL ANALYZE \"AuditLog\";"
```

**Expand disk space at the infrastructure level (if above is insufficient).**

1. Expand the volume in your cloud provider or VM disk manager
2. Resize the filesystem: `resize2fs /dev/sdXX`
3. No Docker restart required if using bind mounts

#### Prevention

- Set disk usage alert at 75% (warn) and 90% (critical) in Prometheus/Grafana
- Enable PostgreSQL autovacuum (already on by default) and monitor `last_autovacuum` in weekly reports
- Implement AuditLog partitioning by month (see `scripts/partition-audit-log.sql`)
- Plan storage capacity: ~500MB/month for an active 50-user ERP; provision at least 12 months ahead

---

## 2. Application Issues

---

### 2.1 Backend Won't Start

**Severity:** P1 - All API requests failing

#### Symptoms

- `docker ps` shows `tbs_erp_backend` in `Exited` or `Restarting` state
- All API calls return connection refused on port 3001
- Frontend shows "Failed to fetch" on all API operations
- Health endpoint unreachable

#### Diagnosis

**Step 1: Check container status and exit code.**

```bash
docker ps -a --filter name=tbs_erp_backend
# Look for "Exited (1)" or "Restarting"
```

**Step 2: Read the full startup log.**

```bash
docker logs tbs_erp_backend --tail=100
```

**Common error patterns and their meanings:**

| Log Message | Root Cause |
|---|---|
| `DATABASE_URL environment variable is required` | Missing `.env` configuration |
| `Failed to connect to database after 5 attempts` | PostgreSQL not running or unreachable |
| `REDIS_PASSWORD is required in staging/production` | Missing Redis password env var |
| `JWT_SECRET must be set in .env file` | Missing JWT_SECRET (required, no default) |
| `JWT_SECRET must be at least 32 characters` | JWT_SECRET too short (Joi validation) |
| `FIELD_ENCRYPTION_KEY` validation error | Missing or invalid encryption key |
| `Cannot find module` | Corrupt or missing `node_modules` or build |
| `dist/src/main.js not found` | Build failed; Dockerfile CMD points to wrong path |
| `EADDRINUSE: address already in use 0.0.0.0:3000` | Port conflict inside container |

**Step 3: Check if dependent services are healthy.**

```bash
docker inspect tbs_erp_postgres | grep '"Status"'
docker inspect tbs_erp_redis | grep '"Status"'

# Or use compose healthcheck status
docker compose ps
```

**Step 4: Check environment variables are set.**

```bash
docker exec tbs_erp_backend env | grep -E "DATABASE_URL|REDIS|JWT_SECRET|APP_ENV"
# Note: actual secret values will be visible - do not share output
```

#### Resolution

**Case A: Database not reachable.**

```bash
# Start postgres first
docker start tbs_erp_postgres

# Wait for health check to pass
docker compose ps postgres  # Wait for "healthy"

# Then restart backend
docker start tbs_erp_backend
docker logs tbs_erp_backend --follow --tail=50
```

**Case B: Missing environment variables.**

```bash
# Verify .env file exists at project root
ls -la /path/to/ERPv1/.env

# Check required variables
grep -E "^JWT_SECRET=|^DATABASE_URL=|^REDIS_PASSWORD=|^APP_ENV=" /path/to/ERPv1/.env

# If missing, copy from example and fill in values
cp .env.docker.example .env
# Edit .env and fill all required values

# Restart with updated env
docker compose up -d backend
```

**Case C: Build artifact missing (dist/src/main.js not found).**

```bash
# Rebuild the backend image
docker compose build backend

# Verify the build succeeded
docker run --rm tbs_erp_backend ls dist/src/main.js

# Restart
docker compose up -d backend
```

**Case D: Prisma schema mismatch (migration needed).**

```bash
# Check migration status
docker exec tbs_erp_backend npx prisma migrate status

# Run pending migrations
docker exec tbs_erp_backend npx prisma migrate deploy

# Restart
docker restart tbs_erp_backend
```

**Verify recovery.**

```bash
# Wait 40 seconds for start_period
sleep 40
curl -s http://localhost:3001/api/v1/health
```

#### Prevention

- Use `restart: unless-stopped` in `docker-compose.yml` (already set)
- `depends_on` with `condition: service_healthy` ensures proper startup order (already configured)
- Store `.env` in a secrets manager; use an init container to fetch secrets on startup
- Add startup probe alert: if health check fails 3 consecutive times, page on-call

---

### 2.2 Frontend Build Fails

**Severity:** P2 - Deployment blocked

#### Symptoms

- `docker compose build frontend` or `docker compose build cms` exits with non-zero code
- CI/CD pipeline fails at the build stage
- Deployed container serves a 500 error page or shows blank screen

#### Diagnosis

**Step 1: Run build with verbose output.**

```bash
docker compose build frontend --no-cache 2>&1 | tail -100
```

**Step 2: Common error patterns.**

| Error | Root Cause |
|---|---|
| `Type error: Property 'X' does not exist on type 'Y'` | TypeScript type mismatch after API contract change |
| `Module not found: Can't resolve '...'` | Missing package or wrong import path |
| `NEXT_PUBLIC_API_URL is not defined` | Missing required env var at build time |
| `Failed to compile` with JSX error | React/Next.js component syntax issue |
| `Cannot read properties of undefined` | API response shape changed without updating hooks |

**Step 3: Check for stale node_modules.**

```bash
# Check if package-lock.json is out of sync with package.json
docker run --rm -v $(pwd)/tbs-erp-frontend:/app -w /app node:20-alpine \
  sh -c "npm ci --dry-run 2>&1 | head -20"
```

**Step 4: Test local build outside Docker.**

```bash
cd tbs-erp-frontend
npm ci
npm run build 2>&1 | tail -50
```

#### Resolution

**Case A: TypeScript errors.**

```bash
cd tbs-erp-frontend
npx tsc --noEmit 2>&1 | head -50
# Fix the reported type errors before rebuilding
```

**Case B: Missing environment variables at build time.**

Next.js `NEXT_PUBLIC_*` variables are baked in at build time. Check `Dockerfile` for ARG/ENV declarations:

```bash
grep "NEXT_PUBLIC" tbs-erp-frontend/Dockerfile
# Add any missing NEXT_PUBLIC_* as ARG and ENV in Dockerfile
# Or pass as --build-arg in compose build section
```

**Case C: Corrupt node_modules.**

```bash
# Delete and reinstall
cd tbs-erp-frontend
rm -rf node_modules .next
npm ci

# Then rebuild Docker image
docker compose build frontend --no-cache
```

**Case D: API client type mismatch (backend API changed).**

When the backend DTO or response shape changes, the frontend hooks in `src/lib/hooks/` and API clients in `src/lib/api/` must be updated to match.

```bash
# Check recent backend changes
cd tbs-erp-backend
git log --oneline -10

# Update frontend types to match
cd ../tbs-erp-frontend
# Edit affected files in src/lib/api/ and src/lib/hooks/
npm run build
```

#### Prevention

- Run `npm run build` as a CI check on every PR for both frontend repos
- Pin exact Node.js version in Dockerfile FROM (use `node:20.x.x-alpine`, not `node:alpine`)
- Keep `tsconfig.json` `strict: true` to catch type errors early
- Never change API response shapes without updating all frontend consumers first (API contract rule)

---

### 2.3 Memory Leak

**Severity:** P2 - Degraded performance, risk of OOM crash

#### Symptoms

- `docker stats tbs_erp_backend` shows memory climbing steadily over hours/days without dropping
- Container is restarted automatically (OOM kill visible in `docker events`)
- Backend logs show `JavaScript heap out of memory` before crash
- Request latency gradually increases even with low traffic

#### Diagnosis

**Step 1: Monitor memory in real time.**

```bash
# Watch memory every 5 seconds for 60 seconds
watch -n 5 'docker stats tbs_erp_backend --no-stream --format "{{.MemUsage}} / {{.MemPerc}}"'
```

**Step 2: Check for OOM kills in Docker events.**

```bash
docker events --filter type=container --filter event=oom --since 24h
```

**Step 3: Identify memory trend over time.**

Check Grafana dashboard "Backend Memory Usage" (Prometheus metric: `process_resident_memory_bytes` from `tbs_erp_backend:3000/metrics`).

**Step 4: Capture a heap snapshot (only in staging; not safe in production).**

```bash
# Send SIGUSR2 to trigger heap dump (requires NODE_OPTIONS=--expose-gc)
docker exec tbs_erp_backend kill -USR2 1

# The dump will be in /app/heapdump-*.heapsnapshot
docker cp tbs_erp_backend:/app/ ./heap-dumps/
# Analyze with Chrome DevTools Memory tab
```

**Step 5: Check for common NestJS memory leak patterns in logs.**

```bash
docker logs tbs_erp_backend --since 24h | grep -i "memory\|heap\|EventEmitter\|MaxListenersExceeded"
```

#### Resolution

**Immediate: Restart to restore service.**

```bash
docker restart tbs_erp_backend
```

**Set memory limit to trigger controlled restart rather than system OOM.**

Add to `docker-compose.yml` under the `backend` service:

```yaml
deploy:
  resources:
    limits:
      memory: 1G
    reservations:
      memory: 512M
```

Then:

```bash
docker compose up -d backend
```

**Common NestJS memory leak sources and fixes:**

1. **EventEmitter listeners not cleaned up** - check `@OnEvent` handlers for missing unsubscribe
2. **BullMQ job references held in memory** - verify `removeOnComplete` and `removeOnFail` are configured (they are in `queue.module.ts`: 24h/7d)
3. **Large in-memory caches without TTL** - check `CacheService` TTL settings
4. **Prisma connection leaks** - verify `onModuleDestroy` is calling `$disconnect()`

**Add scheduled container restart as a temporary mitigation.**

```bash
# Add to crontab on host - restart backend daily at 04:00 AM
0 4 * * * docker restart tbs_erp_backend >> /var/log/tbs-restart.log 2>&1
```

**Remove the restart cron once the root cause is fixed** - it masks the problem.

#### Prevention

- Set Prometheus alert: `process_resident_memory_bytes > 800MB` for 10 minutes
- Set Docker memory limit in `docker-compose.yml` (above)
- Enable Node.js `--max-old-space-size=768` in Dockerfile CMD to limit heap before OOM
- Profile with `clinic.js` or `0x` before deploying memory-intensive new features

---

### 2.4 High CPU

**Severity:** P2 - Performance degraded, risk of timeout cascade

#### Symptoms

- `docker stats` shows `tbs_erp_backend` CPU > 80% sustained
- All API endpoints timing out (downstream of a CPU-bound hot path)
- Rate limit errors appear even for low-traffic endpoints
- Grafana shows `process_cpu_seconds_total` rate spiking

#### Diagnosis

**Step 1: Identify which process is consuming CPU.**

```bash
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

**Step 2: Get a CPU profile from the Node.js process.**

```bash
# Send SIGPROF to trigger a 5-second CPU profile (if profiling endpoint is enabled)
docker exec tbs_erp_backend kill -PROF 1

# Or use the built-in /metrics endpoint for Prometheus CPU metrics
curl -s http://localhost:3001/api/v1/metrics | grep "process_cpu"
```

**Step 3: Find hot endpoints in backend logs.**

```bash
# Look for endpoints with many calls or high duration
docker logs tbs_erp_backend --since 1h | grep "200\|500" | \
  awk '{print $NF}' | sort | uniq -c | sort -rn | head -20
```

**Step 4: Check if a cron job or scheduled task is running.**

The following scheduled tasks run on the backend:
- `SLAMonitorService.checkSLABreaches` - every 30 minutes
- `SLAMonitorService.autoCancelPendingDeposit` - every 6 hours
- `QueryAnalyzerService.weeklyIndexHealthReport` - Sunday 04:00
- BullMQ processors consuming from all 7 queues

```bash
docker logs tbs_erp_backend --since 1h | grep "Cron\|SLA check\|index health\|Running"
```

**Step 5: Check if the database is causing sync blocking.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT count(*), wait_event_type, wait_event
      FROM pg_stat_activity
      WHERE state = 'active'
      GROUP BY wait_event_type, wait_event
      ORDER BY count DESC;"
```

#### Resolution

**Immediate: Identify and temporarily disable a runaway cron if confirmed.**

For a BullMQ queue worker consuming excess CPU:

```bash
# Access Bull Board UI (requires CEO/COO/CFO role JWT)
# URL: https://your-domain.com/admin/queues

# Or pause a specific queue via Redis CLI
docker exec -it tbs_erp_redis redis-cli \
  -a "$REDIS_PASSWORD" \
  HSET "bull:finance-events:meta" paused 1
```

**Rate limit hot endpoints that are being hammered.**

Check if the `CustomThrottlerGuard` is in place. If an endpoint lacks rate limiting:

1. Add `@Throttle({ default: { limit: 10, ttl: 60000 } })` decorator
2. Redeploy

**Scale horizontally using Docker Compose replicas (for CPU-bound workloads).**

```yaml
# docker-compose.yml
backend:
  deploy:
    replicas: 2
```

Note: Requires the Nginx load balancer to be configured for upstream balancing.

**Restart backend as last resort to clear runaway async loops.**

```bash
docker restart tbs_erp_backend
```

#### Prevention

- Set Prometheus alert: CPU > 70% for 5 minutes
- All list endpoints must use pagination (already enforced by API contract)
- BullMQ concurrency settings are tuned per queue (see `queue.module.ts`): finance=2, notifications=5, etc.
- Add `--max-semi-space-size` and `--optimize_for_size` Node.js flags for memory/GC tuning

---

## 3. Queue Issues (BullMQ)

BullMQ runs on top of Redis with 7 queues:
- `order-events` (concurrency 3)
- `notification-events` (concurrency 5)
- `finance-events` (concurrency 2 - ordered)
- `warehouse-events` (concurrency 3)
- `integration-events` (concurrency 2)
- `report-jobs` (concurrency 1)
- `batch-jobs` (concurrency 2)

Job defaults: 3 attempts, exponential backoff (1s/2s/4s), 5-minute timeout.
Failed jobs retained for 7 days. Completed jobs retained for 24 hours (max 1000).

Queue admin UI: `/admin/queues` (JWT required; CEO/COO/CFO/DIRECTOR_OPERATIONS roles only)

---

### 3.1 Dead Letter Queue Overflow

**Severity:** P2 - Failed jobs accumulating; business events not processed

#### Symptoms

- BullMQ failed job count growing in Bull Board UI at `/admin/queues`
- Backend logs: `Job X failed after 3 attempts: [error message]`
- Business side effects not happening (e.g., notifications not sent, finance allocations missing)
- `FailedJobCaptureService` emitting `job.failed` events (visible in logs)

#### Diagnosis

**Step 1: Check failed job counts per queue.**

```bash
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  LLEN "bull:order-events:failed"

docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  LLEN "bull:finance-events:failed"

docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  LLEN "bull:notification-events:failed"
```

Or check all queues at once:

```bash
for queue in order-events notification-events finance-events warehouse-events integration-events report-jobs batch-jobs; do
  count=$(docker exec tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" LLEN "bull:${queue}:failed" 2>/dev/null)
  echo "${queue}: ${count} failed jobs"
done
```

**Step 2: Inspect a sample of failed jobs to find the error pattern.**

```bash
# Get details of the first failed job in a queue
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  LRANGE "bull:finance-events:failed" 0 0
```

**Step 3: Correlate with backend logs.**

```bash
docker logs tbs_erp_backend --since 2h | grep -E "failed|Failed|ERROR.*job|bull"
```

**Step 4: Check Bull Board UI for structured failure details.**

Access `https://your-domain.com/admin/queues` with a CEO/COO/CFO account. Select the affected queue and filter by "Failed" status to see stack traces.

#### Resolution

**After fixing the root cause, retry failed jobs.**

Via Bull Board UI: Select queue -> Failed jobs -> "Retry all failed"

Via Redis CLI (retry specific job by moving it back to waiting):

```bash
# Get the job ID from Bull Board or Redis LRANGE
JOB_ID="job-id-here"
QUEUE="finance-events"

# Move from failed list back to waiting (BullMQ internal format)
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  EVAL "
    local job = redis.call('HGETALL', KEYS[1])
    if #job == 0 then return 0 end
    redis.call('HSET', KEYS[1], 'failedReason', '')
    redis.call('LREM', KEYS[2], 1, ARGV[1])
    redis.call('ZADD', KEYS[3], 0, ARGV[1])
    return 1
  " 3 \
  "bull:${QUEUE}:${JOB_ID}" \
  "bull:${QUEUE}:failed" \
  "bull:${QUEUE}:wait" \
  "${JOB_ID}"
```

**If the root cause cannot be fixed quickly, remove jobs to prevent memory pressure.**

```bash
# Remove all failed jobs from a specific queue (DESTRUCTIVE - confirm first)
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  DEL "bull:notification-events:failed"
```

**Verify the processor is running after fix.**

```bash
docker logs tbs_erp_backend --follow --tail=50 | grep "finance-events\|processed\|completed"
```

#### Prevention

- Monitor DLQ depth in Prometheus (`bull_job_failed_total` metric)
- Alert when any queue has > 50 failed jobs
- Implement idempotency keys on all event processors to make retry safe
- Review `FailedJobCaptureService` reports in Sentry weekly
- `finance-events` has concurrency=2 intentionally to preserve ordering - do not increase

---

### 3.2 Queue Backlog

**Severity:** P2 - Business events delayed; SLA risk

#### Symptoms

- Bull Board UI shows `waiting` count in thousands
- Backend logs: Workers are processing but not keeping up
- `notification-events` queue growing - users not receiving notifications
- `finance-events` backlog - cost allocations delayed

#### Diagnosis

**Step 1: Measure queue depth for all queues.**

```bash
for queue in order-events notification-events finance-events warehouse-events integration-events report-jobs batch-jobs; do
  waiting=$(docker exec tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" LLEN "bull:${queue}:wait" 2>/dev/null)
  active=$(docker exec tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" LLEN "bull:${queue}:active" 2>/dev/null)
  echo "${queue}: ${waiting} waiting, ${active} active"
done
```

**Step 2: Measure throughput - how many jobs complete per minute.**

```bash
docker logs tbs_erp_backend --since 10m | grep "completed\|Job.*done" | wc -l
```

**Step 3: Check if workers are alive.**

```bash
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  KEYS "bull:*:workers"
```

#### Resolution

**Increase concurrency for the backlogged queue (temporary).**

Update the environment variable and restart:

```bash
# In .env or docker-compose.yml environment section
NOTIFICATION_QUEUE_CONCURRENCY=10   # up from 5

docker restart tbs_erp_backend
```

**Pause low-priority queues to prioritize critical ones.**

Via Bull Board UI: Go to the queue -> Pause Queue

Or via Redis CLI:

```bash
# Pause report-jobs and batch-jobs to free worker threads
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  HSET "bull:report-jobs:meta" paused 1

docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  HSET "bull:batch-jobs:meta" paused 1
```

Resume when backlog is cleared:

```bash
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  HDEL "bull:report-jobs:meta" paused
```

**Remove stale or duplicate jobs from the waiting list.**

Use Bull Board UI to inspect and remove jobs that are no longer valid (e.g., notifications for cancelled orders).

**Scale horizontally with an additional backend worker instance.**

If a single backend instance cannot handle the load, run a dedicated worker container:

```bash
docker run -d \
  --name tbs_erp_worker \
  --network tbs_network \
  --env-file .env \
  -e WORKER_ONLY=true \
  tbs_erp_backend \
  node dist/src/main.js
```

#### Prevention

- Alert when any queue depth exceeds 1000 jobs
- Monitor queue throughput in Grafana (job completion rate vs enqueue rate)
- Set `REPORT_QUEUE_CONCURRENCY=1` to prevent report generation from starving other queues
- Schedule batch imports (`batch-jobs`) during off-hours to reduce contention

---

### 3.3 Job Stuck

**Severity:** P2 - Individual job blocking queue progress

#### Symptoms

- Bull Board UI shows a job in `active` state for over 5 minutes (timeout is 5 minutes per `queue.module.ts`)
- BullMQ stalled job detection logs: `Job X is stalled`
- Queue is not processing despite having waiting jobs
- Backend logs show no completion events for a specific job ID

#### Diagnosis

**Step 1: List active jobs.**

```bash
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  LRANGE "bull:finance-events:active" 0 -1
```

**Step 2: Get job details.**

```bash
JOB_ID="job-id-here"
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  HGETALL "bull:finance-events:${JOB_ID}"
```

**Step 3: Check if the worker is alive and processing.**

```bash
docker logs tbs_erp_backend --follow --tail=100 | grep "finance-events\|processor\|active"
```

**Step 4: Verify the job has not exceeded the 5-minute timeout.**

BullMQ's `timeout: 300_000` (5 minutes) should auto-fail timed-out jobs. If it has not:

```bash
# Check stalled check interval in Redis
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  HGETALL "bull:finance-events:meta"
```

#### Resolution

**Force-fail and remove a stuck job via Bull Board UI.**

1. Go to `https://your-domain.com/admin/queues`
2. Select the queue
3. Filter by "Active"
4. Click the stuck job
5. Click "Fail" with reason "Manual intervention - job stuck"

**Remove the stuck job via Redis CLI.**

```bash
JOB_ID="stuck-job-id"
QUEUE="finance-events"

# Remove from active list
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  LREM "bull:${QUEUE}:active" 1 "${JOB_ID}"

# Delete the job hash
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  DEL "bull:${QUEUE}:${JOB_ID}"
```

**Restart backend to reset all worker state.**

```bash
docker restart tbs_erp_backend
sleep 40
docker logs tbs_erp_backend --tail=30
```

**Re-enqueue the job if the operation must complete.**

For a finance allocation that was stuck, trigger re-processing via the API:

```bash
# Example: re-trigger cost allocation for an order
curl -X POST https://your-domain.com/api/v1/orders/{orderId}/recalculate-costs \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Prevention

- BullMQ `timeout: 300_000` (5 minutes) is already configured as the hard timeout
- Stalled job check: BullMQ auto-detects and moves stalled jobs to failed after `stalledInterval`
- All job processors should use try/catch and never throw unhandled errors
- Alert when `bull_job_stalled_total` counter increments more than 5 times per hour

---

## 4. Cache Issues (Redis)

---

### 4.1 Redis Out of Memory

**Severity:** P1 - Cache writes failing; potential BullMQ failure

#### Symptoms

- Backend logs: `ENOMEM` or `OOM command not allowed when used memory > 'maxmemory'`
- BullMQ jobs fail to enqueue (Redis `OOM` error)
- Cache SET operations returning errors
- Dashboard loads slowly as all cache misses hit the database

#### Diagnosis

**Step 1: Check Redis memory usage.**

```bash
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" INFO memory | grep -E "used_memory_human|maxmemory_human|mem_fragmentation_ratio|evicted_keys"
```

**Step 2: Check eviction policy.**

```bash
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" CONFIG GET maxmemory-policy
```

Expected: `allkeys-lru` or `volatile-lru` for cache use cases. If `noeviction`, Redis will return errors instead of evicting keys.

**Step 3: Find the largest keys consuming memory.**

```bash
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  --bigkeys 2>&1 | tail -30
```

**Step 4: Count keys by pattern.**

```bash
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  --scan --pattern "orders:list:*" | wc -l

docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  --scan --pattern "bull:*" | wc -l
```

#### Resolution

**Immediate: Flush stale cache keys (do NOT flush BullMQ keys).**

```bash
# Delete only application cache keys (prefixed patterns)
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  --scan --pattern "dashboard:*" | xargs docker exec -i tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" DEL

docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  --scan --pattern "orders:*" | xargs docker exec -i tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" DEL

docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  --scan --pattern "crm:*" | xargs docker exec -i tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" DEL
```

**NEVER use `FLUSHALL` or `FLUSHDB` - this wipes BullMQ queues, losing all pending jobs.**

**Set eviction policy to `allkeys-lru` to allow automatic eviction.**

```bash
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  CONFIG SET maxmemory-policy allkeys-lru
```

Make this permanent by adding to Redis command in `docker-compose.yml`:

```yaml
command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD} --maxmemory-policy allkeys-lru --maxmemory 512mb
```

**Increase Redis maxmemory.**

```bash
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  CONFIG SET maxmemory 1gb
```

To persist, update `docker-compose.yml` Redis command and restart:

```bash
docker compose up -d redis
```

#### Prevention

- Set Prometheus alert: `redis_memory_used_bytes / redis_memory_max_bytes > 0.85`
- Use TTL on all cache keys (enforced in `CacheService`)
- Set `allkeys-lru` eviction policy (self-healing under memory pressure)
- Separate Redis instances for cache and queues if memory pressure is chronic

---

### 4.2 Cache Stampede

**Severity:** P3 - Performance spike at cache expiry

#### Symptoms

- Database CPU spikes at regular intervals (matching cache TTL periods)
- Backend response times spike briefly then recover
- Multiple simultaneous slow queries for the same data visible in `pg_stat_activity`
- Logs show many cache misses at the same moment

#### Diagnosis

**Step 1: Check if multiple requests are hitting the DB simultaneously for the same key.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT query, count(*)
      FROM pg_stat_activity
      WHERE state = 'active'
        AND datname = 'tbs_erp'
      GROUP BY query
      HAVING count(*) > 3
      ORDER BY count(*) DESC;"
```

**Step 2: Check cache TTL settings.**

```bash
# Check TTL of frequently accessed cache keys
docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  TTL "dashboard:overview:user-id-here"

docker exec -it tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" \
  TTL "orders:active-counts"
```

**Step 3: Correlate with traffic pattern.**

If stampede happens at a specific time (e.g., 09:00 when all users log in), the cache was last populated 5 minutes before and all TTLs expire simultaneously.

#### Resolution

**Apply jitter to cache TTL to stagger expiries.**

In `CacheService`, TTL should include randomness. If not already implemented:

```typescript
// In cache.service.ts - add jitter of ±20%
const jitterFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
await this.cache.set(key, value, ttl * jitterFactor);
```

**Pre-warm critical caches before peak hours.**

```bash
# Trigger dashboard cache warm-up via API
curl -X POST https://your-domain.com/api/v1/cache/warm \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Or add a scheduled task that fetches the dashboard at 08:50 AM before users log in.

**Implement the Lock pattern for stampede prevention.**

The `CacheService` should acquire a short-lived lock before refreshing an expired cache:

1. Check key exists - cache hit, return immediately
2. If miss: SET a lock key `{key}:lock` with NX and short TTL (5 seconds)
3. If lock acquired: fetch from DB, set cache, release lock
4. If lock not acquired: wait 100ms and retry step 1 (stale-while-revalidate)

**Increase TTL for rarely changing data.**

```bash
# Dashboard overview rarely changes in < 5 minutes
# Change TTL from 60s to 300s for overview caches
```

Review TTL configurations in the backend `CacheService` and `CacheModule`.

#### Prevention

- Add ±20% random jitter to all cache TTLs
- Use stale-while-revalidate for dashboard and reporting endpoints
- Monitor `cache_misses_total` Prometheus counter; alert if miss rate > 30% over 5 minutes

---

### 4.3 Redis Connection Lost

**Severity:** P1 - BullMQ and caching both fail

#### Symptoms

- Backend logs: `Error: connect ECONNREFUSED redis:6379` or `Redis connection lost`
- BullMQ emits `error` events; all queue operations fail
- All cache operations fall back to database (increased DB load)
- Health endpoint returns `{"redis":{"status":"down"}}`
- WebSocket connections may drop (Redis Pub/Sub for horizontal scaling)

#### Diagnosis

**Step 1: Check Redis container status.**

```bash
docker ps -a --filter name=tbs_erp_redis
docker inspect tbs_erp_redis | grep '"Status"'
```

**Step 2: Test Redis connectivity from backend container.**

```bash
docker exec -it tbs_erp_backend sh -c \
  "wget -q --spider redis:6379 2>&1 || echo 'Cannot reach redis'"

# Or use redis-cli inside the backend container if available
docker exec -it tbs_erp_backend sh -c \
  "redis-cli -h redis -p 6379 -a '$REDIS_PASSWORD' PING"
```

**Step 3: Check Redis logs.**

```bash
docker logs tbs_erp_redis --tail=100
```

**Step 4: Check network connectivity.**

```bash
docker network inspect tbs_network | grep -A5 "tbs_erp_redis\|tbs_erp_backend"
```

#### Resolution

**Restart Redis container.**

```bash
docker restart tbs_erp_redis

# Wait for health check
sleep 15
docker inspect tbs_erp_redis | grep '"Status"'
# Expected: "healthy"
```

**Restart backend to re-establish connection pools.**

BullMQ uses exponential backoff (500ms to 30s, as configured in `queue.module.ts`) and will auto-reconnect. However, restart clears any stuck connection state:

```bash
docker restart tbs_erp_backend
```

**If Redis data (AOF) is corrupted.**

```bash
# Check AOF integrity
docker exec tbs_erp_redis redis-check-aof --fix /data/appendonly.aof

# If unfixable, back up and start fresh (loses all cache and queues)
# ONLY do this if queues are backed up via other means
docker stop tbs_erp_redis
docker exec tbs_erp_redis sh -c "mv /data/appendonly.aof /data/appendonly.aof.bak"
docker start tbs_erp_redis
```

**Warning:** Starting Redis fresh loses all BullMQ queue data. Pending jobs must be manually re-enqueued.

**Verify full recovery.**

```bash
curl -s http://localhost:3001/api/v1/health | python3 -m json.tool
# Check both database and redis show "up"

# Verify BullMQ reconnected
docker logs tbs_erp_backend --tail=50 | grep "redis\|bull\|queue"
```

#### Prevention

- Redis has `restart: unless-stopped` in `docker-compose.yml` (already set)
- BullMQ is configured with `retryStrategy` exponential backoff and `reconnectOnError` (already in `queue.module.ts`)
- Set health check: `redis-cli -a $REDIS_PASSWORD ping` every 10s (already configured)
- Alert on `redis_up == 0` in Prometheus
- Enable Redis persistence (`appendonly yes`) to survive container restarts (already configured)

---

## 5. Security Incidents

---

### 5.1 Rate Limit Triggered

**Severity:** P3 normal / P2 if ongoing attack

#### Symptoms

- Users receive HTTP 429 Too Many Requests responses
- Nginx access logs show high request rate from a single IP
- Backend logs: `ThrottlerException: Too Many Requests` from `CustomThrottlerGuard`
- Alert in Sentry for spike in 429 responses

Rate limit defaults: `RATE_LIMIT_TTL=60` seconds, `RATE_LIMIT_MAX=100` requests per window (from `docker-compose.yml`).

#### Diagnosis

**Step 1: Identify the source IP and endpoint.**

```bash
docker exec -it tbs_erp_nginx sh -c \
  "tail -1000 /var/log/nginx/access.log | awk '{print \$1}' | sort | uniq -c | sort -rn | head -20"
```

**Step 2: Check which endpoint is being hit.**

```bash
docker exec -it tbs_erp_nginx sh -c \
  "grep '429' /var/log/nginx/access.log | tail -50"
```

**Step 3: Check the backend throttler logs.**

```bash
docker logs tbs_erp_backend --since 1h | grep -i "throttle\|rate limit\|429"
```

**Step 4: Determine if this is a legitimate user or an attack.**

- Legitimate: One IP, authenticated user, hammering report export endpoint during business hours
- Attack: Many IPs, unauthenticated, hitting login endpoint (brute force)
- Scraping: Systematic crawl of API endpoints

#### Resolution

**For a brute force login attack - block at Nginx level.**

```bash
# Temporarily block an IP via Nginx config
docker exec -it tbs_erp_nginx sh -c \
  "echo 'deny 1.2.3.4;' >> /etc/nginx/conf.d/blocked-ips.conf && nginx -s reload"
```

Or use Docker's iptables directly on the host:

```bash
# Block at the kernel level (immediate, bypasses Docker)
iptables -I DOCKER-USER -s 1.2.3.4 -j DROP
```

**For legitimate user hitting limits - temporarily raise limits for that session.**

This requires a code change to add a `@SkipThrottle()` decorator or increase TTL/max values:

```bash
# Temporary increase via environment variable (requires restart)
docker exec tbs_erp_backend \
  sh -c "RATE_LIMIT_MAX=500 node dist/src/main.js"
# Note: Better to use a per-user or per-role override in throttler config
```

**For API scraping - add request signing.**

Raise this as an architectural task to require API keys for all public-facing endpoints.

**Verify rate limiting is working correctly.**

```bash
# Test rate limit (send 101 requests)
for i in $(seq 1 101); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/v1/health
done | sort | uniq -c
# Expected: 100x "200", 1x "429"
```

#### Prevention

- Configure Nginx rate limiting as a first layer (before NestJS): `limit_req_zone` in nginx.conf
- Use `fail2ban` on the host to auto-block IPs with repeated 429s
- Review Sentry alerts for 429 spikes weekly
- Add CAPTCHA to public-facing login after 3 failed attempts

---

### 5.2 Unauthorized Access Attempt

**Severity:** P1 if active exploitation; P2 for failed attempts

#### Symptoms

- Backend logs: `RolesGuard: Forbidden - user X with role Y tried to access Z`
- Multiple 401/403 responses to the same user or IP
- Attempts to access financial or HR endpoints from non-finance roles
- JWT with unexpected roles or claims in logs

#### Diagnosis

**Step 1: Search for authorization failures.**

```bash
docker logs tbs_erp_backend --since 24h | grep -E "403|Forbidden|Unauthorized|RolesGuard|unauthorized"
```

**Step 2: Check audit log for the user's actions.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT action, \"entityType\", \"entityId\", \"userId\", metadata, \"createdAt\"
      FROM \"AuditLog\"
      WHERE \"userId\" = 'suspected-user-id'
        AND \"createdAt\" > NOW() - INTERVAL '24 hours'
      ORDER BY \"createdAt\" DESC
      LIMIT 50;"
```

**Step 3: Check for JWT token abuse (reuse after expiry, wrong claims).**

```bash
docker logs tbs_erp_backend --since 24h | grep -E "TokenExpiredError|JsonWebTokenError|invalid signature"
```

**Step 4: Check if the user account is still active.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT id, email, role, \"isActive\", \"lastLogin\", \"createdAt\"
      FROM \"User\"
      WHERE id = 'suspected-user-id';"
```

#### Resolution

**Immediately disable the compromised user account.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "UPDATE \"User\"
      SET \"isActive\" = false,
          \"updatedAt\" = NOW()
      WHERE id = 'user-id-here';"
```

Or via the API (preferred to trigger audit log):

```bash
curl -X PATCH https://your-domain.com/api/v1/users/{userId}/deactivate \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Invalidate all active JWT tokens for the user.**

JWT tokens are stateless (15-minute access, 7-day refresh). To invalidate refresh tokens:

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "DELETE FROM \"RefreshToken\"
      WHERE \"userId\" = 'user-id-here';"
```

**If an admin account is compromised - rotate JWT secret immediately.**

```bash
# Generate new JWT secret (minimum 32 characters)
NEW_SECRET=$(openssl rand -hex 32)

# Update .env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${NEW_SECRET}/" .env
sed -i "s/^JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=$(openssl rand -hex 32)/" .env

# Restart backend - INVALIDATES ALL ACTIVE SESSIONS SYSTEM-WIDE
docker restart tbs_erp_backend

# Notify all users to log in again
```

**Preserve evidence before cleaning up.**

```bash
# Export relevant audit logs before any potential deletion
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "COPY (
        SELECT * FROM \"AuditLog\"
        WHERE \"userId\" = 'suspected-user-id'
          AND \"createdAt\" > NOW() - INTERVAL '7 days'
        ORDER BY \"createdAt\" DESC
      ) TO '/tmp/incident_audit_export.csv' CSV HEADER;"

docker cp tbs_erp_postgres:/tmp/incident_audit_export.csv ./incident_evidence_$(date +%Y%m%d).csv
```

**Escalate to management (COO/CEO) immediately if financial data was accessed.**

#### Prevention

- All sensitive endpoints use `@Roles(...)` guard (enforced by architecture)
- 2FA (TOTP) is required for high-privilege roles (CFO, CEO, COO, CHIEF_ACCOUNTANT)
- All CRUD operations write to `AuditLog` (enforced by ZERO TRUST principle)
- Conduct monthly review of user roles and active accounts
- Set alert for > 10 consecutive 403 responses from same IP within 5 minutes

---

### 5.3 Data Breach Response

**Severity:** P0 - Immediate executive escalation required

#### Symptoms

- Evidence of unauthorized data export (large SELECT queries in `pg_stat_activity`)
- Unexpected outbound traffic from database or backend container
- Security scanner detects credentials in public repository or logs
- User reports seeing another user's private data

#### Immediate Response (First 15 Minutes)

**Step 1: Contain - isolate the affected service.**

```bash
# Take backend offline immediately
docker stop tbs_erp_backend tbs_erp_frontend tbs_cms_frontend

# Block all external traffic at Nginx
docker stop tbs_erp_nginx

# Keep postgres and redis running for evidence preservation
```

**Step 2: Preserve evidence - do NOT modify any logs or data.**

```bash
# Snapshot current state of access logs
docker exec tbs_erp_nginx sh -c "cp /var/log/nginx/access.log /var/log/nginx/access_$(date +%Y%m%d_%H%M%S).log.bak" 2>/dev/null || true

# Export recent audit log
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "COPY (
        SELECT al.*, u.email AS user_email, u.role AS user_role
        FROM \"AuditLog\" al
        LEFT JOIN \"User\" u ON u.id = al.\"userId\"
        WHERE al.\"createdAt\" > NOW() - INTERVAL '48 hours'
        ORDER BY al.\"createdAt\" DESC
      ) TO '/tmp/breach_audit.csv' CSV HEADER;"

docker cp tbs_erp_postgres:/tmp/breach_audit.csv ./incident_evidence_$(date +%Y%m%d_%H%M%S).csv

# Take full database dump for forensics
docker exec tbs_erp_postgres pg_dump \
  -U tbs_user -d tbs_erp \
  --format=custom \
  > ./forensic_db_dump_$(date +%Y%m%d_%H%M%S).dump
```

**Step 3: Notify.**

Immediately contact:
1. CEO / COO
2. Legal / Compliance team
3. If customer PII was exposed: Data Protection Officer

**Step 4: Rotate all secrets.**

```bash
# Rotate database password
docker exec -it tbs_erp_postgres psql \
  -U postgres \
  -c "ALTER USER tbs_user WITH PASSWORD '$(openssl rand -hex 24)';"

# Update DATABASE_URL in .env with new password
# Rotate JWT_SECRET, JWT_REFRESH_SECRET, REDIS_PASSWORD, FIELD_ENCRYPTION_KEY

# Regenerate all API keys and service credentials
```

**Step 5: Assess scope.**

```bash
# What data was accessed in the last 48 hours?
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT al.\"entityType\",
             count(*) AS access_count,
             count(DISTINCT al.\"userId\") AS unique_users,
             min(al.\"createdAt\") AS first_access,
             max(al.\"createdAt\") AS last_access
      FROM \"AuditLog\" al
      WHERE al.\"createdAt\" > NOW() - INTERVAL '48 hours'
        AND al.action IN ('READ', 'EXPORT', 'DOWNLOAD')
      GROUP BY al.\"entityType\"
      ORDER BY access_count DESC;"
```

**Step 6: Restore service only after root cause is confirmed and patched.**

```bash
docker compose up -d
```

#### Prevention

- Field-level encryption is enabled for PII fields via `FIELD_ENCRYPTION_KEY` (must be set)
- All API endpoints require authentication (no public data endpoints)
- Regular security audits (see `docs/reports/SECURITY_AUDIT_REPORT.md`)
- Conduct penetration test annually
- OWASP Top 10 review before each major release

---

## 6. Business Operations

---

### 6.1 Order Stuck in Status

**Severity:** P2 - Business operation blocked

#### Symptoms

- Customer or Sale reports that an order has not moved in status for an unusual period
- `SLAMonitorService` emits `sla.breached` event (every 30 minutes check)
- Order stuck in a transitional status like `CUSTOMS`, `SOURCING`, or `DELIVERING`
- Business user cannot advance the order through the ERP UI

#### Diagnosis

**Step 1: Check the order's current status and history.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT o.id, o.code, o.status, o.\"serviceType\", o.\"createdAt\",
             o.\"updatedAt\",
             u.email AS sale_email
      FROM \"Order\" o
      LEFT JOIN \"User\" u ON u.id = o.\"saleId\"
      WHERE o.code = 'ORDER-CODE-HERE';"
```

**Step 2: Check the full status transition history.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT status, \"changedBy\", note, \"createdAt\"
      FROM \"OrderStatusHistory\"
      WHERE \"orderId\" = 'order-id-here'
      ORDER BY \"createdAt\" DESC
      LIMIT 20;"
```

**Step 3: Check the FSM to confirm valid next transitions.**

From the `OrderStatusMachine` (`order-status.machine.ts`), the Order FSM main path is:

`CONSULTING` -> `QUOTATION` -> `PENDING_DEPOSIT` (MHH) -> `SOURCING` -> `WAREHOUSE_CN` -> `PACKING` -> `CONSOLIDATION` -> `IN_TRANSIT` -> `CUSTOMS` -> `WAREHOUSE_VN` -> `DELIVERING` -> `SETTLEMENT` -> `COMPLETED`

Special rules:
- MHH orders: `QUOTATION` cannot go directly to `SOURCING`; must pass through `PENDING_DEPOSIT`
- VCT orders: can skip `PENDING_DEPOSIT`
- `COMPLETED` -> `SETTLEMENT` is allowed (reopen by BGD)

**Step 4: Check for blocking conditions (ON_HOLD, ISSUE).**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT id, code, status, \"onHoldReason\", \"issueNote\"
      FROM \"Order\"
      WHERE id = 'order-id-here';"
```

**Step 5: Check if a required prerequisite is missing.**

```bash
# For SETTLEMENT: check if all receivables are cleared
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT ar.status, ar.amount, ar.\"paidAmount\", ar.\"dueDate\"
      FROM \"AccountReceivable\" ar
      WHERE ar.\"orderId\" = 'order-id-here'
        AND ar.status NOT IN ('PAID', 'CANCELLED');"

# For CUSTOMS: check if customs declaration exists
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT id, status, \"declarationNo\"
      FROM \"CustomsDeclaration\"
      WHERE \"orderId\" = 'order-id-here';"
```

#### Resolution

**For ON_HOLD or ISSUE status - resume the order.**

Via API (preferred, creates audit log):

```bash
curl -X POST https://your-domain.com/api/v1/orders/{orderId}/resume \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note": "Issue resolved - resumed by LOGISTICS_MANAGER on 2026-03-20"}'
```

**For manual status advance (use only when FSM cannot proceed due to data inconsistency).**

This requires COO or CEO approval. Direct database update is the last resort:

```bash
# Step 1: Record current state (for audit trail)
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT id, status, \"updatedAt\" FROM \"Order\" WHERE id = 'order-id-here';"

# Step 2: Update order status (do ONLY with explicit COO/CEO approval)
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "UPDATE \"Order\"
      SET status = 'WAREHOUSE_VN',
          \"updatedAt\" = NOW()
      WHERE id = 'order-id-here'
        AND status = 'CUSTOMS';"

# Step 3: Manually insert status history record for audit compliance
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "INSERT INTO \"OrderStatusHistory\"
        (id, \"orderId\", status, \"changedBy\", note, \"createdAt\")
      VALUES (
        gen_random_uuid(),
        'order-id-here',
        'WAREHOUSE_VN',
        'system-admin',
        'Manual advance by DevOps with COO approval - customs clearance confirmed offline. Incident: INC-YYYYMMDD-001',
        NOW()
      );"
```

**Verify the order is now visible and operable in the UI.**

1. Log in as the assigned Sale user
2. Navigate to the order detail page
3. Confirm the status displays correctly
4. Confirm the next status button is available

#### Prevention

- `SLAMonitorService` runs every 30 minutes and fires `sla.breached` events
- Configure alerts so LOGISTICS_MANAGER is notified of SLA breaches via notification
- Review all orders in `CUSTOMS` status daily during peak import seasons
- Train users on the FSM rules to prevent creating data states that block transitions

---

### 6.2 AR Aging Auto-Block Triggered Incorrectly

**Severity:** P2 - Customer cannot place new orders

#### Symptoms

- Sale reports: "Customer X cannot place a new order - system shows blocked"
- Customer service receives complaint that their account is frozen
- Backend returns 403 or business rule error when creating order for the customer
- Customer believes their account is in good standing

AR blocking rules (from `ARAgingCalculatorService.shouldBlockCustomer`):
1. `currentDebt > creditLimit` (when creditLimit > 0)
2. Has any debt in the `days90Plus` bucket
3. More than 60% of total outstanding debt is 60+ days overdue

#### Diagnosis

**Step 1: Check the customer's current aging status.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT c.id, c.code, c.\"fullName\",
             c.\"creditLimit\", c.\"currentDebt\",
             c.\"paymentTermDays\", c.\"gracePeriodDays\",
             c.\"isBlocked\", c.\"blockReason\"
      FROM \"Customer\" c
      WHERE c.code = 'CUSTOMER-CODE-HERE';"
```

**Step 2: Check open receivables for the customer.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT ar.id, ar.amount, ar.\"paidAmount\", ar.\"nettedAmount\",
             ar.status, ar.\"dueDate\",
             ar.amount - ar.\"paidAmount\" - ar.\"nettedAmount\" AS outstanding,
             DATE_PART('day', NOW() - ar.\"dueDate\") AS days_overdue,
             o.code AS order_code
      FROM \"AccountReceivable\" ar
      LEFT JOIN \"Order\" o ON o.id = ar.\"orderId\"
      WHERE ar.\"customerId\" = 'customer-id-here'
        AND ar.status NOT IN ('PAID', 'CANCELLED')
      ORDER BY ar.\"dueDate\" ASC;"
```

**Step 3: Check the latest AR aging snapshot.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT *
      FROM \"ARAgingSnapshot\"
      WHERE \"customerId\" = 'customer-id-here'
      ORDER BY \"snapshotDate\" DESC
      LIMIT 5;"
```

**Step 4: Identify if a payment was made but not recorded, or if `nettedAmount` is missing.**

```bash
# Check for any recent payments
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT pv.id, pv.amount, pv.status, pv.\"createdAt\",
             pv.\"orderId\", u.email AS created_by
      FROM \"PaymentVoucher\" pv
      LEFT JOIN \"User\" u ON u.id = pv.\"createdBy\"
      WHERE pv.\"customerId\" = 'customer-id-here'
        AND pv.type = 'RECEIPT'
        AND pv.status = 'APPROVED'
        AND pv.\"createdAt\" > NOW() - INTERVAL '30 days'
      ORDER BY pv.\"createdAt\" DESC;"
```

#### Resolution

**If a payment was received but AR not updated - apply the payment.**

Via API:

```bash
curl -X POST https://your-domain.com/api/v1/accounts-receivable/{arId}/apply-payment \
  -H "Authorization: Bearer $ACCOUNTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentVoucherId": "voucher-id-here",
    "amount": 5000000,
    "note": "Payment applied retroactively - was processed but AR not updated"
  }'
```

**If the grace period is wrong - correct the customer record.**

```bash
# Extend grace period with approval from CHIEF_ACCOUNTANT
curl -X PATCH https://your-domain.com/api/v1/customers/{customerId} \
  -H "Authorization: Bearer $CHIEF_ACCOUNTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"gracePeriodDays": 10, "note": "Grace period extended per CFO approval on 2026-03-20"}'
```

**If the block is a false positive - manually unblock with approval.**

This requires CHIEF_ACCOUNTANT or CFO approval. Via API:

```bash
curl -X POST https://your-domain.com/api/v1/customers/{customerId}/unblock \
  -H "Authorization: Bearer $CHIEF_ACCOUNTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Manual review by CHIEF_ACCOUNTANT: payment was delayed due to bank processing. Block removed pending receipt of payment. Approved by CFO.",
    "approvedBy": "cfo-user-id"
  }'
```

**If the creditLimit is incorrect - update it.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "UPDATE \"Customer\"
      SET \"creditLimit\" = 500000000,
          \"updatedAt\" = NOW()
      WHERE id = 'customer-id-here';"

# Insert audit log
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "INSERT INTO \"AuditLog\"
        (id, action, \"entityType\", \"entityId\", \"userId\", metadata, \"createdAt\")
      VALUES (
        gen_random_uuid(),
        'UPDATE',
        'Customer',
        'customer-id-here',
        'admin-user-id',
        '{\"field\": \"creditLimit\", \"oldValue\": \"100000000\", \"newValue\": \"500000000\", \"approvedBy\": \"CFO\"}',
        NOW()
      );"
```

**Verify the customer is unblocked.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT \"isBlocked\", \"blockReason\", \"currentDebt\", \"creditLimit\"
      FROM \"Customer\"
      WHERE id = 'customer-id-here';"
```

#### Prevention

- AR aging snapshot runs daily (via `ARAgingSnapshotService`); verify it runs at scheduled time
- The daily snapshot uses batch queries (no N+1) - check logs for errors at 02:00 AM
- ACCOUNTANT_AR should review auto-block decisions daily and escalate edge cases
- Ensure `gracePeriodDays` is set correctly per contract for each customer tier

---

### 6.3 Payment Voucher Anti-Fraud Block

**Severity:** P2 - Payment to supplier or employee blocked

#### Symptoms

- Accountant receives error: "Payment voucher BLOCKED" when creating a chi-phieu
- Backend logs: `PaymentVoucherValidator: Payment voucher BLOCKED for order X: [reasons]`
- Legitimate payment cannot be processed
- Supplier is waiting for payment

Anti-fraud BLOCK rules (from `PaymentVoucherValidator`):
1. No `orderId` linked
2. Order status is COMPLETED or CANCELLED
3. Cash flow guard: TBS payment to supplier exceeds (customer deposit + customer wallet)
4. No attachment documents
5. Reason text shorter than 20 characters
6. No beneficiary specified
7. No cost type specified

Anti-fraud FLAG rules (soft warning, does not block):
1. Amount exceeds 90% of order revenue
2. "Phat sinh" / "phát sinh" with amount > 5,000,000 VND
3. Same creator has >= 5 payment vouchers in last 24 hours
4. Beneficiary not in approved vendor list
5. Created outside business hours (07:00-19:00)

#### Diagnosis

**Step 1: Get the exact block reason from logs.**

```bash
docker logs tbs_erp_backend --since 2h | grep "BLOCKED\|FLAGGED" | grep "order-id-or-voucher-context"
```

**Step 2: Check the order's financial state.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT o.id, o.code, o.status,
             o.\"totalAmount\",
             o.\"depositAmount\",
             o.\"supplierCost\",
             -- Cash flow: deposit received + customer wallet vs supplier payments
             (SELECT COALESCE(SUM(pv.amount), 0)
              FROM \"PaymentVoucher\" pv
              WHERE pv.\"orderId\" = o.id
                AND pv.type = 'RECEIPT'
                AND pv.status = 'APPROVED') AS total_receipts,
             (SELECT COALESCE(SUM(pv.amount), 0)
              FROM \"PaymentVoucher\" pv
              WHERE pv.\"orderId\" = o.id
                AND pv.type = 'PAYMENT'
                AND pv.status = 'APPROVED') AS total_payments
      FROM \"Order\" o
      WHERE o.id = 'order-id-here';"
```

**Step 3: Check the exact validation inputs that caused the block.**

```bash
docker logs tbs_erp_backend --since 4h | grep -A5 "BLOCKED for order"
```

#### Resolution

**Case A: Block due to missing attachment.**

Ensure the accountant uploads at least one supporting document before submitting:
- Invoice from supplier (hoa don NCC)
- Bank transfer receipt (bien lai chuyen khoan)
- Purchase contract (hop dong mua hang)

The file must be uploaded first via the drive or document upload endpoint, and the returned file ID must be included in `attachments[]`.

**Case B: Block due to reason too short (< 20 characters).**

Instruct the accountant to write a detailed reason:

Insufficient: `"Trang trai NCC"`
Sufficient: `"Thanh toan tien hang cho NCC Cong ty ABC cho don hang TBS-2026-00123 thang 3/2026"`

**Case C: Block due to cash flow guard (CashFlowGuardService).**

The payment to the supplier would exceed the available funds (customer deposit + wallet). This protects against overpayment:

1. Verify the customer has paid their deposit first
2. If deposit is paid but not recorded, apply the receipt voucher
3. If there is a genuine cash flow advance scenario, requires CFO approval

```bash
# Check deposit status
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT amount, status, type, \"createdAt\"
      FROM \"PaymentVoucher\"
      WHERE \"orderId\" = 'order-id-here'
        AND type = 'RECEIPT'
      ORDER BY \"createdAt\" DESC;"
```

**Case D: Block because order is COMPLETED or CANCELLED.**

Post-closure payments are blocked by design. If this is a legitimate late expense:

1. Reopen the order: `POST /api/v1/orders/{orderId}/reopen` (requires CEO/COO role)
2. Create the payment voucher
3. Close the order again

**Case E: Block for missing orderId.**

All payment vouchers must be linked to an order (ORDER-CENTRIC architecture). If this is an overhead cost not related to a specific order, it should be linked to a special overhead order code, not created without an `orderId`.

**Override flagged (not blocked) vouchers.**

Flagged vouchers CAN be created but are marked for review. The CHIEF_ACCOUNTANT or CFO must approve them:

```bash
curl -X POST https://your-domain.com/api/v1/payment-vouchers/{voucherId}/approve \
  -H "Authorization: Bearer $CHIEF_ACCOUNTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note": "Reviewed and approved - explained by Sale, above threshold due to emergency supplier fee"}'
```

**Verify voucher was created successfully after correction.**

```bash
docker exec -it tbs_erp_postgres psql \
  -U tbs_user -d tbs_erp \
  -c "SELECT id, type, amount, status, \"createdAt\", \"blockReasons\", \"flagReasons\"
      FROM \"PaymentVoucher\"
      WHERE \"orderId\" = 'order-id-here'
      ORDER BY \"createdAt\" DESC
      LIMIT 5;"
```

#### Prevention

- Train accountants on the 7 block conditions and 5 flag conditions
- The `minReasonLength=20`, `miscExpenseThreshold=5000000`, `maxVouchersPerDay=5` are configurable via `business.antifraud.*` env vars
- Review FLAG reports weekly in the accounting module
- The anti-fraud rules are intentionally strict per the ZERO TRUST architecture principle
- Flagged vouchers accumulate in a review queue; CHIEF_ACCOUNTANT should clear it daily

---

## Appendix A: Quick Reference Commands

### Health Checks

```bash
# Full system health
curl -s http://localhost:3001/api/v1/health | python3 -m json.tool

# All container statuses
docker compose ps

# Resource usage
docker stats --no-stream
```

### Log Tailing

```bash
# Backend errors only
docker logs tbs_erp_backend --follow --tail=50 2>&1 | grep -E "ERROR|WARN|CRITICAL"

# Nginx access log
docker exec tbs_erp_nginx tail -f /var/log/nginx/access.log

# All service logs
docker compose logs --follow --tail=20
```

### Queue Status

```bash
# Check all queue depths at once
for q in order-events notification-events finance-events warehouse-events integration-events report-jobs batch-jobs; do
  w=$(docker exec tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" LLEN "bull:${q}:wait" 2>/dev/null || echo 0)
  a=$(docker exec tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" LLEN "bull:${q}:active" 2>/dev/null || echo 0)
  f=$(docker exec tbs_erp_redis redis-cli -a "$REDIS_PASSWORD" LLEN "bull:${q}:failed" 2>/dev/null || echo 0)
  echo "$q  wait=$w  active=$a  failed=$f"
done
```

### Database Quick Checks

```bash
# Active connections
docker exec tbs_erp_postgres psql -U tbs_user -d tbs_erp \
  -c "SELECT count(*), state FROM pg_stat_activity WHERE datname='tbs_erp' GROUP BY state;"

# Database size
docker exec tbs_erp_postgres psql -U tbs_user -d tbs_erp \
  -c "SELECT pg_size_pretty(pg_database_size('tbs_erp'));"

# Last 5 slow queries
docker logs tbs_erp_backend --tail=500 | grep "Slow query"
```

### Emergency Restart Sequence

```bash
# Safe restart order (preserves data)
docker restart tbs_erp_postgres
sleep 20
docker restart tbs_erp_redis
sleep 10
docker restart tbs_erp_backend
sleep 40
docker restart tbs_erp_frontend tbs_cms_frontend
docker restart tbs_erp_nginx

# Verify all services healthy
docker compose ps
curl -s http://localhost:3001/api/v1/health
```

---

## Appendix B: Escalation Matrix

| Severity | Condition | Contact | Response Time |
|---|---|---|---|
| P0 | Data breach, complete outage, data loss | CEO + COO + CTO | Immediate |
| P1 | DB down, Redis down, backend won't start | On-call DevOps + CTO | 15 minutes |
| P2 | Queue overflow, memory leak, order stuck | On-call DevOps | 1 hour |
| P3 | Rate limit, slow queries, cache issues | DevOps team | 4 hours (next business day if after hours) |

---

## Appendix C: Monitoring Dashboards

| Dashboard | URL | Purpose |
|---|---|---|
| Grafana | http://your-server:3003 | System-wide metrics, latency, resource usage |
| Prometheus | http://your-server:9090 | Raw metrics and alert rules |
| Bull Board | https://your-domain.com/admin/queues | Queue health, job status, failed job retry |
| Kibana | http://your-server:5601 | Structured log search, error analysis |

---

*Runbook version: 1.0.0 - Generated 2026-03-20*
*Review cadence: Update after every major incident or postmortem. Validate all commands in staging quarterly.*
