# Demo Deployment Guide

## Overview

The demo mode provides a fully functional ERP system with pre-seeded data that automatically resets every 24 hours. Use this to let potential users try the system before committing to a self-hosted deployment.

## Quick Deploy

### 1. Configure

```bash
cp .env.demo .env
```

Edit `.env` to set your demo domain and change default passwords.

### 2. Build and Start

```bash
docker compose -f docker-compose.selfhost.yml -f docker-compose.demo.yml up -d --build
```

### 3. Run initial migrations and seed

```bash
docker compose -f docker-compose.selfhost.yml -f docker-compose.demo.yml exec backend npx prisma migrate deploy
docker compose -f docker-compose.selfhost.yml -f docker-compose.demo.yml exec backend npx prisma db seed
```

## Demo Accounts

All demo accounts use the password: `demo123`

| Account | Email | Role | Permissions |
|---------|-------|------|-------------|
| Admin | `admin@demo.example.com` | COO | Full system access |
| Director | `giamdoc@demo.example.com` | Sales Director | Sales, approvals, reports |
| Accountant | `ketoan@demo.example.com` | Chief Accountant | Finance, vouchers, reports |
| Warehouse | `kho@demo.example.com` | Warehouse Manager | Warehouse CN/VN operations |
| Sales | `kinhdoanh@demo.example.com` | Sale | Orders, customers, quotations |
| Viewer | `viewer@demo.example.com` | Viewer | Read-only access |

The email domain is configurable via `SEED_EMAIL_DOMAIN` in `.env`.

## Demo Features

### Demo Banner
When `DEMO_MODE=true`, a yellow banner appears at the top of the dashboard showing:
- "Demo Mode" indicator
- Data reset schedule
- Quick access to demo account credentials

### Auto-Reset
The `demo-reset` container automatically resets the database every 24 hours:
1. Drops and recreates the public schema
2. Backend auto-runs migrations on next request
3. Seed data is re-applied

### Pre-seeded Data
The demo includes:
- 6 user accounts (various roles)
- 5 sample customers (various tiers)
- Exchange rates (CNY/VND, USD/VND)

## Customizing Demo Data

Edit `tbs-erp-backend/prisma/seed/demo-seed.ts` to add:
- More sample customers
- Sample orders
- Sample containers
- Payment vouchers

Then rebuild and re-seed:

```bash
docker compose -f docker-compose.selfhost.yml -f docker-compose.demo.yml build backend
docker compose -f docker-compose.selfhost.yml -f docker-compose.demo.yml up -d backend
docker compose -f docker-compose.selfhost.yml -f docker-compose.demo.yml exec backend npx prisma db seed
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEMO_MODE` | Enable demo mode | `true` |
| `SEED_EMAIL_DOMAIN` | Email domain for demo accounts | `demo.example.com` |
| `CUSTOMER_CODE_PREFIX` | Customer code prefix | `DEMO-KH-` |

## Production Considerations

- Do NOT use demo mode in production
- Demo database is reset every 24 hours — all user-created data will be lost
- Default passwords are weak (`demo123`) — suitable only for demo
- The `.env.demo` file contains insecure secrets — never use them in production
