# Technology Stack

**Analysis Date:** 2026-03-18

## Languages

**Primary:**
- TypeScript 5.7.3 - Backend (NestJS) and frontend (Next.js) source code
- JavaScript - Build scripts and configuration files

**Secondary:**
- SQL - PostgreSQL schemas (17 Prisma schema files)
- Bash - Docker setup and migration scripts

## Runtime

**Environment:**
- Node.js 22.x (inferred from `@types/node: ^22.12.0`)
- PostgreSQL 15+ (primary database)
- Redis 7+ (cache, queue backend, WebSocket adapter)
- MinIO (S3-compatible object storage for drive module)
- Docker & Docker Compose (containerization)

**Package Manager:**
- npm - for both backend and frontend
- Lockfiles present: `package-lock.json` in both `tbs-erp-backend/` and `tbs-erp-frontend/`

## Frameworks

**Core Backend:**
- NestJS 11.1.15 - REST API, WebSockets, event-driven architecture
- Prisma ORM 6.3.0 - Database abstraction with schema-first approach

**Frontend:**
- Next.js 14.2.21 (App Router) - React-based framework with SSR/SSG
- React 18.3.1 - UI component library

**UI Components:**
- shadcn/ui - Headless component library built on Radix UI
- Radix UI (@radix-ui/*) - Accessibility-focused primitives
- Tailwind CSS 3.4.17 - Utility-first CSS framework
- Lucide React 0.468.0 - Icon library

**State Management:**
- Zustand 5.0.3 - Lightweight global state (frontend)
- TanStack Query 5.62.0 - Server state management (frontend)

**API Client:**
- Axios 1.7.9 - HTTP client (frontend)
- Socket.IO 4.8.0 - Real-time bidirectional communication

**Testing:**
- Jest 29.7.0 - Backend unit/integration tests
- Vitest 4.0.18 - Frontend unit tests
- Playwright 1.58.2 - E2E tests (frontend)
- @testing-library/react 16.3.2 - React component testing

**Build & Dev:**
- TypeScript Compiler (tsc) - TypeScript compilation
- ts-jest 29.4.6 - Jest TypeScript transformer
- ts-node 10.9.2 - TypeScript execution for scripts
- tsconfig-paths 4.2.0 - Path alias resolution
- ESLint 8.56.0 / 9.19.0 - Code linting
- Prettier 3.4.2 - Code formatting
- PostCSS 8.4.49 - CSS processing
- Autoprefixer 10.4.20 - Vendor prefix generation

## Key Dependencies

**Backend - Authentication & Security:**
- @nestjs/jwt 11.0.2 - JWT token handling (15min access, 7d refresh)
- @nestjs/passport 11.0.5 - Passport.js integration
- passport 0.7.0 - Authentication middleware
- passport-jwt 4.0.1 - JWT strategy
- bcrypt 5.1.1 - Password hashing
- otplib 13.3.0 - TOTP 2FA implementation
- helmet 8.0.0 - HTTP security headers

**Backend - Data & Validation:**
- @prisma/client 6.3.0 - ORM client
- class-validator 0.14.1 - DTO validation
- class-transformer 0.5.1 - DTO serialization
- joi 17.13.3 - Configuration validation
- zod 3.24.1 - Schema validation (frontend)

**Backend - Queue & Events:**
- @nestjs/bullmq 11.0.4 - Job queue integration
- bullmq 5.13.0 - BullMQ queue library
- @nestjs/event-emitter 3.0.1 - Event-driven architecture
- @nestjs/schedule 6.1.1 - Cron job scheduling

**Backend - Real-time:**
- @nestjs/websockets 11.1.15 - WebSocket support
- @nestjs/platform-socket.io 11.1.15 - Socket.IO integration
- socket.io 4.8.0 - Real-time transport
- @socket.io/redis-adapter 8.3.0 - Redis pub/sub for horizontal scaling

**Backend - Caching:**
- @nestjs/cache-manager 3.1.0 - Cache abstraction
- cache-manager 6.4.3 - Cache implementation
- redis 5.10.0 - Redis client (also used for BullMQ, Socket.IO)
- @keyv/redis 5.1.6 - Keyv Redis adapter

**Backend - Storage & File Handling:**
- @aws-sdk/client-s3 3.540.0 - S3 client for MinIO
- @aws-sdk/s3-request-presigner 3.540.0 - Presigned URL generation
- sharp 0.34.5 - Image processing
- exceljs 4.4.0 - Excel file generation/parsing
- file-type 21.3.0 - File type detection
- pdfmake 0.3.3 - PDF generation

**Backend - Email & Communication:**
- nodemailer 6.9.17 - Email sending
- isomorphic-dompurify 3.0.0 - HTML sanitization

**Backend - AI & Integration:**
- @anthropic-ai/sdk 0.37.0 - Claude AI integration
- @casl/ability 6.7.2 - Authorization & permissions
- @casl/prisma 1.5.0 - CASL Prisma integration

**Backend - Monitoring & Observability:**
- prom-client 15.1.0 - Prometheus metrics
- @nestjs/terminus 11.0.0 - Health checks

**Backend - Utilities:**
- uuid 10.0.0 - UUID generation
- compression 1.8.1 - Gzip compression
- cookie-parser 1.4.7 - Cookie parsing
- mime-types 2.1.35 - MIME type lookup
- reflect-metadata 0.2.2 - Decorator metadata
- rxjs 7.8.1 - Reactive programming

**Frontend - Forms & Validation:**
- react-hook-form 7.54.2 - Form state & validation
- @hookform/resolvers 3.9.1 - RHF resolver integration
- zod 3.24.1 - Schema validation

**Frontend - Data Visualization & Tables:**
- recharts 2.15.0 - Chart library
- @tanstack/react-table 8.20.6 - Headless table component

**Frontend - Utilities & UI:**
- react-dropzone 14.4.0 - File drop zone
- html5-qrcode 2.3.8 - QR code scanning
- quill 2.0.3 - Rich text editor
- react-quill 2.0.0 - React wrapper for Quill
- date-fns 4.1.0 - Date utilities
- react-day-picker 9.4.4 - Date picker
- clsx 2.1.1 - Conditional className builder
- sonner 1.7.1 - Toast notifications
- cmdk 1.0.4 - Command palette

**Frontend - Data Management:**
- xlsx 0.18.5 - Excel parsing (frontend export)
- file-saver 2.0.5 - File download
- socket.io-client 4.8.3 - Socket.IO client
- next-themes 0.4.6 - Dark mode management

**Frontend - Performance & PWA:**
- @ducanh2912/next-pwa 10.2.9 - Progressive Web App
- @axe-core/react 4.11.1 - Accessibility testing

## Configuration

**Backend Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string (required)
- `DIRECT_DATABASE_URL` - Direct DB connection for Prisma migrations (bypasses connection pooling)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` - JWT signing keys (min 32 chars)
- `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` - Token expiration (default: 15m, 7d)
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` - Redis connection
- `APP_ENV` - Environment: `development`, `staging`, `production`
- `CORS_ORIGINS` - Comma-separated CORS whitelist
- `FIELD_ENCRYPTION_KEY` - Field-level encryption key (min 32 chars)
- `MINIO_ENDPOINT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET_DRIVE` - MinIO S3 config
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - Email server
- `ANTHROPIC_API_KEY` - Claude AI integration
- `SENTRY_DSN` - Error tracking (required in production)
- `STORAGE_TYPE` - Storage backend: `local` or `s3`
- `STORAGE_PATH` - Local upload directory
- Additional integration configs: `VNACCS_*`, `MISA_*`, `FAST_API_*`, `BANKING_*`, `LARK_*`

**Frontend Environment Variables:**
- `NEXT_PUBLIC_API_URL` - Backend API base URL

**Build Config Files:**
- `tbs-erp-backend/tsconfig.json` - TypeScript compilation with path aliases (`@/*`, `@common/*`, etc.)
- `tbs-erp-frontend/tsconfig.json` - TypeScript with `@/*` alias
- `tbs-erp-frontend/next.config.mjs` - Next.js configuration
- `tbs-erp-frontend/tailwind.config.ts` - Tailwind CSS setup
- `tbs-erp-frontend/postcss.config.js` - PostCSS plugins
- `tbs-erp-frontend/jest.config.js` - Jest test runner (backend)
- `tbs-erp-frontend/vitest.config.ts` - Vitest test runner (frontend)
- `tbs-erp-frontend/playwright.config.ts` - Playwright E2E tests
- `.eslintrc` / ESLint config files - Code linting rules
- `.prettierrc` - Code formatting preferences

**Docker & Deployment:**
- `docker-compose.yml` - Production compose file
- `docker-compose.dev.yml` - Development compose file (ports: 5433→5432 PG, 6379 Redis, 3001 BE, 3000 FE)
- `docker-compose.staging.yml` - Staging environment
- `docker-compose.selfhost.yml` - Self-hosted deployment
- `Dockerfile` (backend) - Node.js + NestJS build (dist/src/main.js)
- `.dockerignore` - Exclude from Docker build

## Platform Requirements

**Development:**
- Node.js 22+ with npm
- PostgreSQL 15+ (local or Docker)
- Redis 7+ (local or Docker)
- Docker & Docker Compose
- Windows PowerShell 5.1+ (Windows dev machines)

**Production:**
- Kubernetes or Docker/Docker Compose orchestration
- PostgreSQL 15+ (managed service or self-hosted)
- Redis 7+ (managed service or self-hosted cluster)
- MinIO or AWS S3 for file storage
- SMTP server for email
- Sentry account (for error tracking)
- Nginx (reverse proxy)

---

*Stack analysis: 2026-03-18*
