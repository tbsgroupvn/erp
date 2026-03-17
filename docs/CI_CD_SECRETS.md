# CI/CD Pipeline - Required GitHub Secrets

## Cách cấu hình
Repository → Settings → Secrets and variables → Actions → New repository secret

---

## 1. Container Registry (tự động)

| Secret | Giá trị | Ghi chú |
|--------|---------|---------|
| `GITHUB_TOKEN` | (tự động) | Có sẵn, dùng cho GHCR login |

---

## 2. Staging Environment

| Secret | Giá trị mẫu | Ghi chú |
|--------|-------------|---------|
| `STAGING_HOST` | `staging.tbslogistics.com` | IP hoặc hostname VPS staging |
| `STAGING_USER` | `deploy` | SSH user có quyền docker |
| `STAGING_SSH_KEY` | `-----BEGIN OPENSSH...` | Private key (Ed25519 recommended) |

### E2E Test Accounts (Staging)

Tạo 3 tài khoản test trên staging (KHÔNG dùng tài khoản thật):

| Secret | Role | Mô tả |
|--------|------|-------|
| `STAGING_SALE_EMAIL` | SALE | Email tài khoản Sale test |
| `STAGING_SALE_PASSWORD` | SALE | Password tài khoản Sale test |
| `STAGING_CEO_EMAIL` | CEO | Email tài khoản CEO test |
| `STAGING_CEO_PASSWORD` | CEO | Password tài khoản CEO test |
| `STAGING_ACCOUNTANT_EMAIL` | CHIEF_ACCOUNTANT | Email tài khoản Kế toán test |
| `STAGING_ACCOUNTANT_PASSWORD` | CHIEF_ACCOUNTANT | Password tài khoản Kế toán test |

---

## 3. Production Environment

| Secret | Giá trị mẫu | Ghi chú |
|--------|-------------|---------|
| `PRODUCTION_HOST` | `app.tbslogistics.com` | IP/hostname VPS production |
| `PRODUCTION_USER` | `deploy` | SSH user có quyền docker |
| `PRODUCTION_SSH_KEY` | `-----BEGIN OPENSSH...` | Private key (khác staging!) |

---

## 4. Monitoring & Notifications

| Secret | Nguồn | Ghi chú |
|--------|-------|---------|
| `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens | Cần scope: `project:releases` |
| `SENTRY_ORG` | Sentry organization slug | VD: `tbs-logistics` |
| `SENTRY_PROJECT` | Sentry project slug | VD: `tbs-erp` |
| `SLACK_WEBHOOK` | Slack → Apps → Incoming Webhooks | Channel: #deployments |

---

## 5. Security Scanning (tùy chọn)

| Secret | Nguồn | Ghi chú |
|--------|-------|---------|
| `SNYK_TOKEN` | snyk.io → Account Settings | Nếu không có, Snyk step bị skip |
| `COSIGN_PRIVATE_KEY` | `cosign generate-key-pair` | Signing container images |
| `COSIGN_PASSWORD` | Password cho cosign key | |
| `CODECOV_TOKEN` | codecov.io → Repository Settings | Upload coverage reports |

---

## 6. Environment Protection Rules

### Staging Environment
- Repository → Settings → Environments → "staging"
- **Deployment branches:** `staging` only
- **No approval required** (auto-deploy)

### Production Environment
- Repository → Settings → Environments → "production"
- **Deployment branches:** `main` only
- **Required reviewers:** Thêm CEO, CTO, hoặc DevOps lead
- **Wait timer:** 0 (approval là đủ)

---

## 7. Branch Protection Rules

### `main` branch
- Require pull request reviews (≥1 reviewer)
- Require status checks to pass: `lint-typecheck`, `unit-tests-backend`, `unit-tests-frontend`, `integration-tests`, `security-scan`
- Require branches to be up to date

### `staging` branch
- Require status checks to pass: `lint-typecheck`, `unit-tests-backend`, `unit-tests-frontend`
- Allow direct push (hoặc require PR tùy team)

---

## Checklist Setup

- [ ] Tạo SSH key pair cho staging VPS
- [ ] Tạo SSH key pair cho production VPS (khác key!)
- [ ] Tạo 3 test accounts trên staging (Sale, CEO, Accountant)
- [ ] Cấu hình Sentry project + auth token
- [ ] Tạo Slack webhook cho channel #deployments
- [ ] Thêm tất cả secrets vào GitHub repository
- [ ] Tạo environment "staging" với branch rule
- [ ] Tạo environment "production" với required reviewers
- [ ] Cấu hình branch protection rules
- [ ] (Optional) Tạo Codecov account + token
- [ ] (Optional) Tạo Snyk account + token
- [ ] (Optional) Generate cosign key pair
