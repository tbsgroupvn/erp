# Ke Hoach Release TBS ERP v1.0

**Phien ban:** v1.0 Hardening & Quality
**Git tag:** `v1.0` (da tao)
**Ngay phat hanh:** 2026-03-20
**Nguoi phe duyet:** Engineering Lead + Product Manager

---

## 1. Tong Quan Release

### 1.1 Pham Vi

| Hang muc | Gia tri |
|---|---|
| So phase hoan thanh | 9 |
| So plan | 24 |
| So task | 48 |
| Requirements satisfied | 31/31 |
| Thoi gian thuc thi | ~1.67 gio |

### 1.2 Thanh Tuu Chinh

- Chuan hoa toan bo loi backend thanh `DomainException` voi 50+ error code, correlation ID, va Sentry integration
- Error boundary tai moi route + toast thong bao tieng Viet, ngan white-screen crash
- `TransactionalEmitter` cho outbox-safe event emission + graceful shutdown 30s worker drain
- HTML sanitization toan bo text field, file upload validation, rate limiting 60 req/min global
- RBAC kiem tra cho ca 22 role voi `@Roles/@Public` tren moi controller + audit integration test
- 9 FSM bulletproofed voi NxN exhaustive transition matrix (640+ assertions)
- Deposit gate 4 tier, anti-fraud, AR aging auto-block, COD enforcement, approval escalation
- Query performance: select projections, index verification, structured logging, slow query detection
- Unit test coverage: OrderService, AuthService, GeneralLedgerService + Phase 4-5 regression specs

### 1.3 Tech Debt Da Chap Nhan

| # | Mo ta | Anh huong | Uu tien xu ly |
|---|---|---|---|
| 1 | 3 frontend error message chua co: `RATE_LIMIT_EXCEEDED`, `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED` | Thap - UX minor | v1.1 |
| 2 | FSM `assertTransition` nem `BadRequestException` thay vi `DomainException` | Thap - inconsistency | v1.1 |
| 3 | Integration test bi loai khoi default jest run (phai chay `npm run test:integration` rieng) | Trung binh - CI gap | v1.1 |
| 4 | RBAC audit integration test co soft enforcement | Thap - coverage minor | v1.1 |

---

## 2. Checklist Kiem Tra Truoc Khi Deploy

### 2.1 Tests

- [ ] Unit tests pass: `cd tbs-erp-backend && npx jest --no-coverage --forceExit`
- [ ] Integration tests pass: `npx jest --config jest.integration.config.js --forceExit`
- [ ] FSM regression tests pass (640+ assertions cho 9 FSM)
- [ ] RBAC audit test pass: `npm run test:integration -- --testPathPattern=rbac`
- [ ] Order lifecycle integration test pass
- [ ] Container lifecycle integration test pass

### 2.2 Build

- [ ] Backend Docker image build thanh cong: `docker compose build backend`
- [ ] Frontend Docker image build thanh cong: `docker compose build frontend`
- [ ] CMS Docker image build thanh cong: `docker compose build cms`
- [ ] Tat ca image khong co loi compile TypeScript
- [ ] `nest build` output tai `dist/src/main.js` (khong phai `dist/main.js`)

### 2.3 Database

- [ ] Tat ca Prisma migration da duoc apply tren staging va kiem tra OK
- [ ] Migration cuoi cung: `20260317_performance_materialized_views` da chay thanh cong
- [ ] Partial indexes da duoc tao: `20260317120000_add_partial_indexes`
- [ ] trgm/GIN indexes da tao: `20260317_add_trgm_gin_indexes`
- [ ] Materialized views cho reporting da ready
- [ ] Backup staging database truoc khi test migration
- [ ] Verify FK constraint cho `account_receivables` (da fix migration `89767d6`)

### 2.4 Infrastructure

- [ ] File `.env.production` da duoc tao va co day du bien:
  - `JWT_SECRET` (bat buoc, min 32 ky tu)
  - `JWT_REFRESH_SECRET`
  - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
  - `REDIS_PASSWORD`
  - `SENTRY_DSN`
  - `FRONTEND_URL`, `CORS_ORIGINS`
  - `REPLICATION_PASSWORD` (neu dung production compose)
  - `GRAFANA_ADMIN_PASSWORD`
- [ ] SSL certificate hop le va chua het han (Let's Encrypt qua Certbot)
- [ ] DNS records truy cap dung den server production
- [ ] Nginx reverse proxy config (`nginx/nginx.conf`) da cap nhat CORS origins chinh xac
- [ ] Redis persistence: `--appendonly yes` da bat (co trong docker-compose.yml)
- [ ] PostgreSQL volume `tbs_erp_pgdata` ton tai va co quyen write
- [ ] Port mapping kiem tra: 80, 443 (Nginx), 3001 (Backend), 3000 (Frontend), 3002 (CMS)

### 2.5 Bao Mat

- [ ] `GraphQL playground` va `introspection` tat trong production ENV: `GRAPHQL_PLAYGROUND=false`, `GRAPHQL_INTROSPECTION=false`
- [ ] Rate limiting dung: `RATE_LIMIT_TTL=60`, `RATE_LIMIT_MAX=100`
- [ ] JWT secret la random string khong dung default
- [ ] Sentry DSN da cau hinh de capture loi production
- [ ] Tat ca 22 role co `@Roles/@Public` tren controller da kiem tra

### 2.6 Monitoring

- [ ] Prometheus scrape config (`monitoring/prometheus/prometheus.yml`) co tat ca target: backend, postgres-exporter, redis-exporter, nginx-exporter
- [ ] Grafana dashboard da import cho NestJS metrics, PostgreSQL, Redis
- [ ] Sentry release tracking lien ket voi git tag `v1.0`
- [ ] Log level production: `LOG_LEVEL=info` (khong phai `debug`)
- [ ] Backend health endpoint tra ve 200: `GET /api/v1/health`

---

## 3. Trinh Tu Deploy (Thu Tu Bat Buoc)

### Buoc 1: Backup Database San Xuat

```bash
# Tren server production
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="tbs_erp_backup_v1.0_${TIMESTAMP}.dump"

docker exec tbs_erp_postgres pg_dump \
  -U ${POSTGRES_USER} \
  -d ${POSTGRES_DB} \
  -Fc \
  -f /backups/${BACKUP_FILE}

# Kiem tra file backup ton tai va co dung luong
docker exec tbs_erp_postgres ls -lh /backups/${BACKUP_FILE}

# Copy backup ra ngoai container de an toan
docker cp tbs_erp_postgres:/backups/${BACKUP_FILE} /srv/backups/${BACKUP_FILE}
echo "Backup hoan thanh: /srv/backups/${BACKUP_FILE}"
```

**Dieu kien thoat:** File backup ton tai, dung luong > 0. Neu khong dat: DUNG LAI, khong tiep tuc.

---

### Buoc 2: Bat Maintenance Mode

```bash
# Tao file maintenance page va cap nhat nginx config
# Them vao nginx/nginx.conf truoc cac location block:
#   if (-f /etc/nginx/maintenance.flag) { return 503; }

touch /srv/tbs-erp/nginx/maintenance.flag
docker exec tbs_erp_nginx nginx -s reload

# Xac nhan
curl -o /dev/null -s -w "%{http_code}" https://yourdomain.com/api/v1/health
# Ket qua mong doi: 503
```

**Luu y:** Thong bao cho team noi bo truoc khi bat maintenance mode. Thoi gian maintenance du kien: 10-15 phut.

---

### Buoc 3: Pull Code Moi Nhat

```bash
cd /srv/tbs-erp

# Kiem tra branch hien tai
git status
git branch

# Pull va checkout tag v1.0
git fetch --all --tags
git checkout v1.0

# Xac nhan commit
git log --oneline -3
# Ket qua mong doi: commit cua v1.0 milestone (b878fb5 hoac tuong tu)
```

---

### Buoc 4: Chay Database Migrations

```bash
cd /srv/tbs-erp

# Chay migration qua container tam thoi
docker compose run --rm backend npx prisma migrate deploy

# Kiem tra ket qua
echo "Exit code: $?"
# Ket qua mong doi: exit code 0

# Xac nhan tat ca migration da ap dung
docker compose run --rm backend npx prisma migrate status
```

**Migrations can kiem tra da ap dung:**
- `20260317_add_trgm_gin_indexes`
- `20260317_performance_indexes`
- `20260317120000_add_partial_indexes`
- `20260317_add_reporting_materialized_views`
- `20260317_performance_materialized_views`

**Dieu kien thoat:** Tat ca migration status = `Applied`. Neu co migration Failed: DUNG LAI, xem log loi.

---

### Buoc 5: Build Docker Images

```bash
cd /srv/tbs-erp

# Build backend truoc (lau nhat)
docker compose build backend
echo "Backend build exit: $?"

# Build frontend va CMS song song
docker compose build frontend cms
echo "Frontend/CMS build exit: $?"

# Kiem tra image da tao
docker images | grep tbs
```

**Kiem tra sau build:**
- Backend image phai co `dist/src/main.js` (khong phai `dist/main.js`)
- Khong co TypeScript compile error trong build log

---

### Buoc 6: Deploy Services

```bash
cd /srv/tbs-erp

# Dung service cu (giu postgres va redis chay)
docker compose stop backend frontend cms nginx

# Khoi dong services moi
docker compose up -d backend frontend cms nginx

# Theo doi log khoi dong
docker compose logs -f backend --tail=50 &
sleep 15  # Cho backend khoi dong (start_period: 40s)

# Kiem tra container status
docker compose ps
```

**Ket qua mong doi sau 40-60 giay:**
- `tbs_erp_backend`: `healthy`
- `tbs_erp_frontend`: `healthy`
- `tbs_erp_cms_frontend`: `healthy`
- `tbs_erp_nginx`: `Up`

---

### Buoc 7: Kiem Tra Health

```bash
# Health check backend
curl -sf http://localhost:3001/api/v1/health | jq .
# Mong doi: {"status":"ok","uptime":...}

# Health check frontend
curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000
# Mong doi: 200

# Kiem tra Redis ket noi
docker exec tbs_erp_redis redis-cli -a ${REDIS_PASSWORD} ping
# Mong doi: PONG

# Kiem tra PostgreSQL ket noi
docker exec tbs_erp_postgres pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}
# Mong doi: accepting connections

# Kiem tra BullMQ queues (qua bull-board neu bat)
curl -sf http://localhost:3001/api/v1/admin/queues
```

---

### Buoc 8: Smoke Test

Thuc hien thu cong cac scenario quan trong nhat:

| # | Test case | Nguoi thuc hien | Ket qua mong doi |
|---|---|---|---|
| 1 | Dang nhap voi role SALE | QA / Release Lead | JWT tra ve, redirect dashboard |
| 2 | Dang nhap voi role CEO | QA / Release Lead | Dashboard BOD hien thi |
| 3 | Tao don hang moi (CONSULTING) | QA | Don hang tao thanh cong, FSM = CONSULTING |
| 4 | Chuyen trang thai don hang → QUOTATION | QA | FSM chuyen thanh cong |
| 5 | Xem dashboard tong quan | QA | Chart va so lieu hien thi, khong loi |
| 6 | Tao bao gia, submit approval | QA | Trang thai PENDING_APPROVAL |
| 7 | Kiem tra audit log | QA | Log ghi nhan CRUD action |
| 8 | Test 2FA login (TOTP) | QA | OTP xac thuc thanh cong |
| 9 | Upload file (chung tu don hang) | QA | File luu tren MinIO, URL tra ve hop le |
| 10 | Rate limit test (61 req/min) | QA | HTTP 429 sau 60 request |

**Dieu kien thoat:** Tat ca 10 smoke test PASS. Neu bat ky test nao FAIL: chuyen sang rollback.

---

### Buoc 9: Tat Maintenance Mode

```bash
# Xoa file maintenance flag
rm /srv/tbs-erp/nginx/maintenance.flag
docker exec tbs_erp_nginx nginx -s reload

# Xac nhan endpoint da accessible
curl -o /dev/null -s -w "%{http_code}" https://yourdomain.com/api/v1/health
# Ket qua mong doi: 200

# Thong bao Slack/Teams
echo "TBS ERP v1.0 da LIVE - $(date '+%Y-%m-%d %H:%M:%S')"
```

---

### Buoc 10: Giam Sat 30 Phut Post-Deploy

```bash
# Theo doi error rate tren Sentry
# URL: https://sentry.io/organizations/tbs/releases/v1.0/

# Theo doi Grafana dashboard
# URL: http://localhost:3003 (hoac qua nginx)

# Theo doi backend log
docker compose logs -f backend --tail=100

# Check Prometheus alerts
curl http://localhost:9090/api/v1/alerts | jq '.data.alerts'
```

**Nguong canh bao can rollback ngay:**
- Error rate tang > 2x baseline trong 5 phut
- P95 latency > 500ms lien tiep 10 phut
- Memory usage backend > 85%
- Bat ky loi nao lien quan den data corruption
- Sentry bat > 100 unique errors trong 30 phut

---

## 4. Ke Hoach Rollback

### 4.1 Ma Tran Quyet Dinh Rollback

| Muc Do | Mo Ta | Hanh Dong | Thoi Han |
|---|---|---|---|
| **P0 - Critical** | He thong down hoan toan, du lieu mat, bao mat bi xam pham | Rollback ngay lap tuc, toan bo team | 2 gio |
| **P1 - High** | Tinh nang chinh bi hong (tao don hang, thanh toan), nhieu user anh huong | Rollback sau khi confirm voi Lead | 4 gio |
| **P2 - Medium** | Tinh nang phu bi loi, it user anh huong | Fix hotfix, khong rollback | Sprint tiep theo |
| **P3 - Low** | Loi UI minor, typo, performance nhe | Log va fix o release sau | Backlog |

**Nguoi co quyen quyet dinh rollback:** Engineering Lead hoac COO (ngoai gio: on-call engineer).

---

### 4.2 Trinh Tu Rollback Code (P0/P1)

```bash
cd /srv/tbs-erp

# Buoc 1: Bat maintenance mode
touch /srv/tbs-erp/nginx/maintenance.flag
docker exec tbs_erp_nginx nginx -s reload

# Buoc 2: Dung cac service application
docker compose stop backend frontend cms nginx

# Buoc 3: Checkout tag truoc (phai xac nhan tag cu)
# Kiem tra tag cu: git tag --sort=-version:refname
git checkout <tag-truoc-v1.0>
# Vi du: git checkout v0.9.5 hoac commit hash cu

# Buoc 4: Build lai image cu
docker compose build backend frontend cms

# Buoc 5: Khoi dong service cu
docker compose up -d backend frontend cms nginx

# Buoc 6: Xac nhan health
curl -sf http://localhost:3001/api/v1/health

# Buoc 7: Tat maintenance mode
rm /srv/tbs-erp/nginx/maintenance.flag
docker exec tbs_erp_nginx nginx -s reload
```

---

### 4.3 Trinh Tu Rollback Database (Khi Co Data Corruption)

> Chi thuc hien khi migration lam hong du lieu. Phai co su cho phep cua Engineering Lead VA CFO.

```bash
# Buoc 1: Dung backend NGAY LAP TUC de tranh ghi them
docker compose stop backend

# Buoc 2: Xac nhan ten file backup
ls -lh /srv/backups/tbs_erp_backup_v1.0_*.dump

# Buoc 3: Drop database hien tai va restore tu backup
BACKUP_FILE="/srv/backups/tbs_erp_backup_v1.0_YYYYMMDD_HHMMSS.dump"

docker exec -i tbs_erp_postgres psql \
  -U ${POSTGRES_USER} \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${POSTGRES_DB}' AND pid <> pg_backend_pid();"

docker exec -i tbs_erp_postgres dropdb \
  -U ${POSTGRES_USER} ${POSTGRES_DB}

docker exec -i tbs_erp_postgres createdb \
  -U ${POSTGRES_USER} ${POSTGRES_DB}

docker cp ${BACKUP_FILE} tbs_erp_postgres:/tmp/restore.dump
docker exec tbs_erp_postgres pg_restore \
  -U ${POSTGRES_USER} \
  -d ${POSTGRES_DB} \
  -v /tmp/restore.dump

# Buoc 4: Xac nhan du lieu sau restore
docker exec tbs_erp_postgres psql \
  -U ${POSTGRES_USER} \
  -d ${POSTGRES_DB} \
  -c "SELECT COUNT(*) FROM orders; SELECT MAX(created_at) FROM orders;"

# Buoc 5: Khoi dong lai backend voi code phien ban cu
docker compose up -d backend
```

---

### 4.4 Rollback Redis Cache

Redis cache co the xoa an toan (du lieu se duoc rebuild):

```bash
# Flush toan bo Redis (an toan vi chi la cache, khong phai source of truth)
docker exec tbs_erp_redis redis-cli -a ${REDIS_PASSWORD} FLUSHALL

# Hoac chi flush database cu the
docker exec tbs_erp_redis redis-cli -a ${REDIS_PASSWORD} FLUSHDB
```

---

## 5. Cau Hinh Moi Truong San Xuat

### 5.1 Bien Moi Truong Bat Buoc

File `.env.production` phai co tat ca bien sau. Khong duoc dung gia tri default.

```bash
# === DATABASE ===
POSTGRES_USER=tbs_prod_user
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=tbs_erp_prod
POSTGRES_PORT=5433
REPLICATION_PASSWORD=<strong-random-password>

# === REDIS ===
REDIS_PASSWORD=<strong-random-password>
REDIS_PORT=6379

# === AUTH (bat buoc, min 64 ky tu random) ===
JWT_SECRET=<random-64-chars>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<random-64-chars-khac>
JWT_REFRESH_EXPIRES_IN=7d

# === APPLICATION ===
NODE_ENV=production
BACKEND_PORT=3001
FRONTEND_PORT=3000
CMS_PORT=3002
FRONTEND_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com,https://cms.yourdomain.com
LOG_LEVEL=info
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# === GRAPHQL (tat trong production) ===
GRAPHQL_PLAYGROUND=false
GRAPHQL_INTROSPECTION=false

# === MONITORING ===
SENTRY_DSN=https://xxx@sentry.io/project-id
GRAFANA_ADMIN_PASSWORD=<strong-password>
PROMETHEUS_PORT=9090
GRAFANA_PORT=3003

# === ELK (bat neu dung) ===
ELK_ENABLED=true
ELASTICSEARCH_PORT=9200
LOGSTASH_PORT=5000
KIBANA_PORT=5601
```

### 5.2 Kiem Tra Bien Moi Truong Khi Khoi Dong

NestJS validate ENV khi khoi dong qua `src/config/env.validation.ts`. Neu co bien bat buoc thieu, app se fail fast voi thong bao ro rang. Day la hanh vi mong muon - do not suppress.

---

## 6. Giam Sat Post-Release (48 Gio)

### 6.1 Cac Chi So Can Theo Doi

| Chi so | Nguong canh bao | Nguong critical | Cong cu |
|---|---|---|---|
| HTTP 5xx rate | > 0.5% request | > 2% request | Prometheus + Grafana |
| P95 API latency | > 200ms | > 500ms | Prometheus |
| P99 API latency | > 500ms | > 1000ms | Prometheus |
| PostgreSQL query time | > 100ms avg | > 500ms avg | Postgres Exporter |
| Redis hit rate | < 80% | < 50% | Redis Exporter |
| Backend memory | > 512MB | > 750MB | Docker stats |
| BullMQ failed jobs | > 10/gio | > 50/gio | Bull Board |
| Sentry new errors | > 10 unique/gio | > 50 unique/gio | Sentry |

### 6.2 Lich Giam Sat

| Thoi diem | Hanh dong | Nguoi phu trach |
|---|---|---|
| T+0 (ngay sau deploy) | Kiem tra smoke test 10 scenario | Release Lead |
| T+30 phut | Review Sentry, Grafana, Docker logs | On-call Engineer |
| T+2 gio | Kiem tra BullMQ queue (finance-events, notifications) | Backend Dev |
| T+4 gio | Review PostgreSQL slow query log | Backend Dev |
| T+8 gio | Tong ket cuoi ngay, bao cao status | Engineering Lead |
| T+24 gio | Kiem tra AR aging auto-block, commission queue | Backend Dev |
| T+48 gio | Post-release review, cap nhat CHANGELOG.md | Engineering Lead |

### 6.3 Cac SLA Nghiep Vu Can Kiem Tra

- Khieunaai SLA monitor (`sla-monitor.service.ts`) dang chay dung
- AR aging snapshot job chay theo lich (`ar-aging-snapshot.service.ts`)
- Commission calculation sau khi don hang COMPLETED (`order-completed.listener.ts`)
- Customs declaration reminder service (`customs-reminder.service.ts`)
- Report scheduler chay theo lich (`report-scheduler.service.ts`)

---

## 7. Ke Hoach Truyen Thong

### 7.1 Truoc Khi Deploy (T-24h)

- **Ban ky thuat:** Thong bao thoi gian maintenance window (du kien 15 phut)
- **Ban kinh doanh (SALE, CSKH):** Bao cao tinh nang moi va cai tien trong v1.0
- **Ban ke toan (CHIEF_ACCOUNTANT, ACCOUNTANT_AR):** Luu y cac cai tien AR aging, deposit gate
- **Ban kho (WAREHOUSE_CN_AGENT, WAREHOUSE_VN_MANAGER):** Khong co thay doi quy trinh

### 7.2 Khi Deploy (T-0)

```
[TBS ERP] Bao tri he thong - v1.0 Release
Thoi gian: [TIMESTAMP]
Du kien hoan thanh: 15 phut
Lien he: [on-call contact]
```

### 7.3 Sau Khi Deploy (T+0)

```
[TBS ERP] He thong da hoat dong tro lai - v1.0
Phien ban: v1.0 Hardening & Quality
Cai tien chinh:
- He thong xu ly loi duoc chuan hoa, thong bao tieng Viet ro rang hon
- Tat ca 9 quy trinh nghiep vu (FSM) da duoc gia co
- Hieu nang truy van co so du lieu duoc cai thien
- Bao mat: rate limiting, HTML sanitization, RBAC kiem tra toan dien
Lien he ho tro: [support channel]
```

---

## 8. Hotfix Protocol Sau Release

Neu co loi nghiem trong sau khi deploy v1.0:

```bash
# Tao hotfix branch tu tag v1.0
git checkout -b hotfix/v1.0.1 v1.0

# Thuc hien fix NHANH - chi sua nguyen nhan goc, khong refactor
# Moi bug = 1 commit: fix(module): BUG-ID mo ta

# Test lai
npx jest --no-coverage --forceExit

# Tao tag moi
git tag v1.0.1
git checkout main
git merge hotfix/v1.0.1

# Deploy theo dung trinh tu buoc 1-10 o Section 3
```

**Nguyen tac hotfix (theo CLAUDE.md):**
- KHONG refactor khi fix bug
- KHONG thay doi DB schema / API contract
- Moi bug = 1 commit rieng: `fix(module): BUG-ID mo ta`

---

## 9. Cap Nhat Sau Release

### 9.1 CHANGELOG.md

Sau khi deploy thanh cong, cap nhat `CHANGELOG.md` voi cac thay doi cua v1.0:

```markdown
## [1.0.0] - 2026-03-20

### Added
- DomainException voi 50+ error code va correlation ID
- TransactionalEmitter cho outbox-safe event emission
- 9 FSM exhaustive transition matrix tests (640+ assertions)
- Deposit gate 4 tier voi anti-fraud checks
- AR aging auto-block enforcement
- HTML sanitization tren toan bo text field
- Rate limiting 60 req/min global

### Fixed
- AR aging tinh toan outstanding khong bao gom nettedAmount
- Commission rounding precision
- Attachment validation consolidation
- FX realized gain/loss journal entry direction
- Finance FK relations va unique constraint

### Security
- RBAC kiem tra toan bo 22 role tren moi controller
- File upload validation (type va size)
- HTML sanitization ngan XSS
- Rate limiting ngan brute force
```

### 9.2 Retrospective (T+48h)

Tao bao cao retrospective voi cac muc:
- Cai gi da dien ra tot?
- Cai gi can cai thien?
- Tech debt nao se xu ly trong v1.1?
- Thoi gian deploy thuc te so voi ke hoach?
- So luong issues phat sinh post-deploy?

---

## Phu Luc A: Lenh Docker Tham Khao Nhanh

```bash
# Xem log real-time
docker compose logs -f backend --tail=100
docker compose logs -f frontend --tail=50

# Restart service cu the (khong down service khac)
docker compose restart backend

# Xem resource usage
docker stats tbs_erp_backend tbs_erp_frontend tbs_erp_postgres tbs_erp_redis

# Exec vao container
docker exec -it tbs_erp_backend sh
docker exec -it tbs_erp_postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}

# Kiem tra healthcheck thu cong
docker inspect --format='{{json .State.Health}}' tbs_erp_backend | jq .

# Xem Prisma migration status
docker compose run --rm backend npx prisma migrate status

# Chay Prisma studio (chi dung de debug, KHONG dung production)
# docker compose run --rm -p 5555:5555 backend npx prisma studio

# Flush Redis (khi can clear cache)
docker exec tbs_erp_redis redis-cli -a ${REDIS_PASSWORD} FLUSHALL

# Xem BullMQ jobs
docker exec tbs_erp_redis redis-cli -a ${REDIS_PASSWORD} KEYS "bull:*" | head -20
```

---

## Phu Luc B: Dau Hieu Loi Thuong Gap Post-Deploy

| Trieu chung | Nguyen nhan co the | Cach kiem tra | Giai phap |
|---|---|---|---|
| Backend khong start, loi `Cannot find module dist/src/main.js` | Build output sai path | `docker compose logs backend` | Kiem tra `tsconfig.json baseUrl` va Dockerfile CMD |
| `JWT_SECRET must be set` khi start | `.env` thieu bien | Xem log backend | Them bien vao `.env.production` |
| Redis WRONGPASS error | REDIS_PASSWORD sai | `docker exec redis-cli ping` | Kiem tra bien REDIS_PASSWORD |
| Migration fail: relation does not exist | Migration chua chay | `prisma migrate status` | Chay `prisma migrate deploy` |
| 502 Bad Gateway tu Nginx | Backend chua healthy | `docker compose ps` | Doi backend healthy (40s start_period) |
| BullMQ jobs bi stuck | Redis mat ket noi | `docker stats redis` | Restart redis, kiem tra memory |
| Sentry khong nhan loi | SENTRY_DSN sai | Kiem tra .env | Cap nhat SENTRY_DSN chinh xac |
| Rate limit 429 cho staff | RATE_LIMIT_MAX qua thap | Xem Prometheus metrics | Tang RATE_LIMIT_MAX neu hop ly |

---

*Ke hoach nay duoc xem xet lai sau moi release. Version tiep theo: v1.1 (xu ly tech debt da chap nhan).*

*Tao: 2026-03-20 | Stack: NestJS + Prisma + PostgreSQL 16 + Redis 7 + Next.js 14 + Docker*
