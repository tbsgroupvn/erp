# External Integrations

**Analysis Date:** 2026-03-18

## APIs & External Services

**AI & LLM:**
- Claude 3 (Anthropic SDK)
  - SDK: `@anthropic-ai/sdk` 0.37.0
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Usage: `src/modules/ai-assistant/ai-assistant.service.ts` - conversational AI for internal tool assistance
  - Features: Document extraction/OCR via `src/modules/ai-assistant/ocr/document-extraction.service.ts`

**Customs & Trade Compliance:**
- VNACCS (Vietnam Customs)
  - Provider: Optional integration
  - Config location: `src/config/integrations.config.ts`
  - Env vars: `VNACCS_API_URL`, `VNACCS_API_KEY`
  - Toggle: `CUSTOMS_INTEGRATION_ENABLED=true`
  - Usage: `src/modules/customs-declaration/` - Customs declaration submission & tracking

**Banking & Exchange Rates:**
- Vietcombank (Primary provider)
  - Provider: `vietcombank` (default)
  - Source: Vietcombank XML feed (https://portal.vietcombank.com.vn/Usercontrols/TV498/pXML.aspx)
  - Usage: `src/modules/exchange-rate/exchange-rate.service.ts` - Daily FX rate syncing
  - Endpoint: `POST /exchange-rate/sync/vietcombank`

**Accounting Software:**
- MISA ERP (Optional accounting integration)
  - Config: `src/config/integrations.config.ts`
  - Env vars: `MISA_API_URL`, `MISA_API_KEY`
  - Toggle: `ACCOUNTING_INTEGRATION_ENABLED=true`

- FAST API (Optional accounting provider)
  - Env vars: `FAST_API_URL`, `FAST_API_KEY`
  - Toggle: `ACCOUNTING_INTEGRATION_ENABLED=true`

**Shipping & Logistics Carriers:**
- Multiple carriers support (configurable)
  - Config: `SHIPPING_CARRIERS` (comma-separated list)
  - Toggle: `SHIPPING_INTEGRATION_ENABLED=true`
  - Location: `src/modules/supplier-order/` - Carrier integration points

**Workplace Communication:**
- Larksuite (Optional - Chinese workplace collaboration platform)
  - Env vars: `LARK_APP_ID`, `LARK_APP_SECRET`, `LARK_WEBHOOK_URL`
  - Toggle: `LARK_INTEGRATION_ENABLED=true`
  - Purpose: Webhook notifications to team channels

## Data Storage

**Primary Database:**
- PostgreSQL 15+
  - Connection: `DATABASE_URL` environment variable
  - Schema: Prisma ORM (17 schema files in `prisma/schema/*.prisma`)
  - Direct migration URL: `DIRECT_DATABASE_URL` (bypasses connection pooling like PgBouncer)
  - Client: `@prisma/client` 6.3.0
  - Pool size: Configurable via `DATABASE_POOL_SIZE` (default: 20 for 50-70 concurrent users)
  - Location: `src/core/database/` - Database module
  - Read replicas: `src/core/database/read-replica.module.ts` - Separate read-only connection pool

**Caching & Session Store:**
- Redis 5.10.0
  - Connection: `REDIS_HOST` (default: localhost), `REDIS_PORT` (default: 6379)
  - Auth: `REDIS_PASSWORD` (mandatory in staging/production)
  - Usage:
    - BullMQ job queue backend
    - Cache-Manager for HTTP cache
    - Session storage
    - Socket.IO pub/sub adapter for horizontal scaling
  - Client: `redis` npm package + `@keyv/redis` for Keyv compatibility
  - Location: `src/core/cache/cache.module.ts`

**Object Storage:**
- MinIO (S3-compatible)
  - Endpoint: `MINIO_ENDPOINT` (default: http://localhost:9000)
  - Auth: `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` (defaults: minioadmin/minioadmin123)
  - Bucket: `MINIO_BUCKET_DRIVE` (default: tbs-drive)
  - SDK: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
  - Presigned URLs: 1-hour expiry for upload/download
  - Usage: `src/modules/drive/` - File upload/download with presigned URLs
  - Service: `src/core/storage/storage.service.ts`

**File Storage (Local fallback):**
- Local filesystem
  - Path: `STORAGE_PATH` environment variable (default: ./uploads)
  - Fallback when `STORAGE_TYPE=local`

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation: `src/core/auth/auth.service.ts`, `src/core/auth/auth.controller.ts`
  - Token type: JWT (Bearer token)
  - Access token: 15 minutes (configurable via `JWT_EXPIRES_IN`)
  - Refresh token: 7 days (configurable via `JWT_REFRESH_EXPIRES_IN`)
  - Signing keys: `JWT_SECRET`, `JWT_REFRESH_SECRET` (min 32 chars required)
  - Strategy: `src/core/auth/passport/jwt.strategy.ts`

**Multi-Factor Authentication:**
- TOTP 2FA
  - Library: `otplib` 13.3.0
  - Implementation: `src/core/auth/auth.service.ts`
  - DTO: `src/core/auth/dto/two-factor.dto.ts`

**Password Security:**
- Bcrypt hashing (salt rounds: 10 by default)
  - Package: `bcrypt` 5.1.1
  - Implementation: Authentication service

**Authorization:**
- CASL (Role-Based Access Control)
  - Package: `@casl/ability` 6.7.2
  - Prisma integration: `@casl/prisma` 1.5.0
  - Guards: `src/core/rbac/guards/roles.guard.ts`
  - Policies: `src/core/rbac/policies/`
  - 22 roles: CEO, COO, CFO, DIRECTOR_OPERATIONS, SALES_DIRECTOR, SALES_LEADER, SALE, MARKETING_STAFF, CSKH, CHIEF_ACCOUNTANT, ACCOUNTANT, ACCOUNTANT_AR, ACCOUNTANT_COST, HR_MANAGER, LOGISTICS_MANAGER, XNK_MANAGER, XNK_STAFF, WAREHOUSE_MANAGER, WAREHOUSE_CN_AGENT, WAREHOUSE_VN_MANAGER, WAREHOUSE_VN_STAFF, DRIVER

## Monitoring & Observability

**Error Tracking:**
- Sentry (optional, required in production)
  - SDK: `@sentry/node` (dynamically imported, optional dependency)
  - Configuration: `src/config/sentry.config.ts`
  - Env var: `SENTRY_DSN` (must be set in production)
  - Sample rates (configurable):
    - Traces: 10% (production), 100% (staging), 0% (development)
    - Profiles: 10% (production), 50% (staging), 0% (development)
  - Sensitive field filtering: Automatically redacts passwords, tokens, credit cards
  - Initialization: `src/main.ts` calls `initSentry(app)` at startup
  - Integration point: `src/common/filters/sentry-exception.filter.ts`

**Application Metrics:**
- Prometheus
  - Client: `prom-client` 15.1.0
  - Endpoint: Typically `/metrics` (via health/metrics controller)
  - Metrics: `src/core/metrics/metrics.controller.ts`, `src/core/metrics/metrics.module.ts`
  - Job metrics: `src/core/metrics/job-metrics.service.ts` - BullMQ job tracking

**Health Checks:**
- NestJS Terminus
  - Package: `@nestjs/terminus` 11.0.0
  - Endpoint: Health check endpoints (via `src/core/health/health.controller.ts`)
  - Checks: Database, Redis, memory, disk

**Logging:**
- Console logging (built-in)
  - Implementation: NestJS Logger in `@nestjs/common`
  - Structured logs: Via `src/core/logger/logger.module.ts`

## CI/CD & Deployment

**Hosting/Deployment Targets:**
- Docker containers (primary)
  - Backend: Node.js with NestJS app (dist/src/main.js entry point)
  - Frontend: Node.js with Next.js (next start command)
  - Compose files: `docker-compose.yml` (prod), `docker-compose.dev.yml` (dev), `docker-compose.staging.yml`

- Self-hosted / On-premises
  - Docker Compose self-host: `docker-compose.selfhost.yml`

**CI Pipeline:**
- GitHub Actions (inferred from git workflow patterns)
  - Recent: 10-stage restructured CI/CD pipeline (commit: 7efd4bd)

**Database Migrations:**
- Prisma Migrate
  - Commands: `prisma migrate dev`, `prisma migrate deploy`
  - Scripts: `npm run prisma:migrate` (dev), `npm run prisma:migrate:prod` (production)
  - Migrations folder: `tbs-erp-backend/prisma/migrations/`

## Environment Configuration

**Required Environment Variables (Critical):**
- Backend:
  - `DATABASE_URL` - PostgreSQL connection string
  - `JWT_SECRET`, `JWT_REFRESH_SECRET` - JWT signing keys
  - `APP_ENV` - Environment: development, staging, production
  - `REDIS_PASSWORD` - Required in staging/production
  - `SENTRY_DSN` - Required in production
  - `FIELD_ENCRYPTION_KEY` - Field-level encryption (min 32 chars)

- Frontend:
  - `NEXT_PUBLIC_API_URL` - Backend API base URL

**Optional Integration Variables:**
- `ANTHROPIC_API_KEY` - Claude AI
- `MINIO_ENDPOINT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` - MinIO S3
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - Email server
- `VNACCS_API_URL`, `VNACCS_API_KEY` - Customs
- `MISA_API_URL`, `MISA_API_KEY` - Accounting
- `LARK_APP_ID`, `LARK_APP_SECRET` - Larksuite

**Secrets Management:**
- Environment files (`.env`, `.env.local`, `.env.production`)
- Never committed to git (listed in `.gitignore`)
- Production: Should use cloud secret managers (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault)
- Example: `.env.docker.example`, `.env.example.monitoring` in repository

## Webhooks & Callbacks

**Incoming Webhooks:**
- Larksuite webhooks: `LARK_WEBHOOK_URL` for workplace notifications
- Event listeners: Multiple event listeners in `src/modules/*/listeners/` for domain events

**Outgoing Webhooks:**
- None currently (webhooks would be configured in external integrations like Larksuite)

**Domain Events (Internal Event Bus):**
- Event-driven architecture via `@nestjs/event-emitter`
- Key events:
  - Order lifecycle: `src/modules/order/listeners/`
  - Notification events: `src/modules/notification/listeners/`
  - Financial events: `src/modules/cash/`, `src/modules/accounts-receivable/`
  - Container/warehouse events: `src/modules/container/listeners/`, `src/modules/warehouse-cn/`
  - Chat events: `src/modules/chat/`
- Event emission: Via EventPublisherService, processed by BullMQ job processors

## Real-time Communication

**WebSocket Server:**
- Socket.IO 4.8.0 + NestJS WebSocket Gateway
  - Namespace: `/ws`
  - Auth: JWT verification on connection handshake
  - Adapter: Redis pub/sub for horizontal scaling (`@socket.io/redis-adapter`)
  - Rooms:
    - `user:{userId}` - Private user notifications
    - `role:{role}` - Role-based broadcasts (e.g., ACCOUNTANT role)
    - `branch:{branch}` - Branch-specific broadcasts
  - Heartbeat: 25s ping interval, 60s timeout
  - Transports: WebSocket (primary), HTTP polling (fallback)
  - Gateway: `src/core/websocket/ws.gateway.ts`
  - Adapter: `src/core/websocket/redis-io.adapter.ts`

**Real-time Features:**
- Live order status updates
- Notification delivery (in-app push)
- Chat reactions + pin (heartbeat-based presence at 35s)
- Chat message notifications
- Calendar meeting reminders

---

*Integration audit: 2026-03-18*
