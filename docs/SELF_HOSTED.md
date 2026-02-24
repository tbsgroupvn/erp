# Self-Hosted Deployment Guide

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disk | 10 GB | 20 GB SSD |
| OS | Linux (Ubuntu 22.04+, Debian 12+) | Ubuntu 24.04 LTS |
| Docker | 24.0+ | Latest |
| Docker Compose | v2.20+ | Latest |

## Quick Start

### 1. Clone the repository

```bash
git clone <your-repo-url> erp
cd erp
```

### 2. Run the setup script

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

The setup script will:
- Check prerequisites (Docker, Docker Compose, OpenSSL)
- Collect your company information and domain configuration
- Generate a `.env` file with secure passwords
- Build Docker images
- Run database migrations and seed data
- Set up SSL certificates (optional)

### 3. Access the system

After setup completes:

| Service | URL |
|---------|-----|
| ERP Dashboard | `https://erp.yourdomain.com` |
| CMS Website | `https://yourdomain.com` |
| API | `https://api.yourdomain.com` |

Default admin login:
- **Email:** `admin@yourdomain.com`
- **Password:** `Admin@123` (change immediately!)

## Manual Setup

If you prefer to configure manually instead of using the setup script:

### 1. Create `.env` file

```bash
cp .env.demo .env
```

Edit `.env` with your values. Required fields:

```env
# Branding
COMPANY_NAME=Your Company
APP_TITLE=Your ERP

# Domains
CMS_DOMAIN=yourdomain.com
ERP_DOMAIN=erp.yourdomain.com
API_DOMAIN=api.yourdomain.com

# Secrets (generate with: openssl rand -hex 64)
JWT_SECRET=<generated>
JWT_REFRESH_SECRET=<generated>
POSTGRES_PASSWORD=<generated>
REDIS_PASSWORD=<generated>
```

### 2. Build and start

```bash
docker compose -f docker-compose.selfhost.yml up -d --build
```

### 3. Run migrations

```bash
docker compose -f docker-compose.selfhost.yml exec backend npx prisma migrate deploy
docker compose -f docker-compose.selfhost.yml exec backend npx prisma db seed
```

## Configuration Reference

### Branding Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `COMPANY_NAME` | Short company name | `My ERP` |
| `COMPANY_FULL_NAME` | Full legal name (used in exports) | `My ERP Company` |
| `APP_TITLE` | App title in browser/sidebar | `ERP System` |
| `CUSTOMER_CODE_PREFIX` | Customer code prefix (e.g., `ACM-KH-`) | `ERP-KH-` |
| `SUPPORT_EMAIL` | Support email address | - |
| `SUPPORT_PHONE` | Support phone number | - |
| `COMPANY_ADDRESS` | Company address | - |
| `COMPANY_TAX_CODE` | Tax identification number | - |
| `SEED_EMAIL_DOMAIN` | Email domain for seed users | `example.com` |

### Domain Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CMS_DOMAIN` | Main domain (CMS website) | `yourdomain.com` |
| `ERP_DOMAIN` | ERP dashboard subdomain | `erp.yourdomain.com` |
| `API_DOMAIN` | API subdomain | `api.yourdomain.com` |

### Frontend Environment Variables

These are baked into the Next.js build via Docker build args:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_COMPANY_NAME` | Company name shown in UI |
| `NEXT_PUBLIC_APP_TITLE` | App title in browser tab |
| `NEXT_PUBLIC_DOMAIN` | Domain for SEO/sitemap |
| `NEXT_PUBLIC_AUTH_COOKIE` | Auth cookie name |
| `NEXT_PUBLIC_DEMO_MODE` | Show demo banner |
| `NEXT_PUBLIC_FACEBOOK_URL` | Facebook page URL |
| `NEXT_PUBLIC_LINKEDIN_URL` | LinkedIn page URL |
| `NEXT_PUBLIC_ZALO_URL` | Zalo page URL |

## SSL Setup

### Automatic (Let's Encrypt)

The setup script handles SSL automatically if you provide an email. To manually set up:

```bash
docker compose -f docker-compose.selfhost.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email your@email.com \
  --agree-tos \
  -d yourdomain.com \
  -d www.yourdomain.com \
  -d erp.yourdomain.com \
  -d api.yourdomain.com

# Reload nginx
docker compose -f docker-compose.selfhost.yml exec nginx nginx -s reload
```

Certificates auto-renew via the certbot container.

### Custom SSL Certificate

Mount your certificates into the nginx container:

```yaml
# In docker-compose.selfhost.yml, under nginx volumes:
volumes:
  - /path/to/fullchain.pem:/etc/letsencrypt/live/yourdomain.com/fullchain.pem:ro
  - /path/to/privkey.pem:/etc/letsencrypt/live/yourdomain.com/privkey.pem:ro
```

## Backup

### Database Backup

```bash
docker compose -f docker-compose.selfhost.yml exec -T postgres \
  pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%Y%m%d).sql
```

### Full Backup (Database + Volumes)

```bash
# Stop services
docker compose -f docker-compose.selfhost.yml stop

# Backup volumes
docker run --rm \
  -v erp_pgdata:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/pgdata_$(date +%Y%m%d).tar.gz -C /data .

# Start services
docker compose -f docker-compose.selfhost.yml up -d
```

### Restore

```bash
docker compose -f docker-compose.selfhost.yml exec -T postgres \
  psql -U $POSTGRES_USER $POSTGRES_DB < backup_20240101.sql
```

## Update

Run the update script:

```bash
chmod +x scripts/update.sh
./scripts/update.sh
```

Or manually:

```bash
git pull
docker compose -f docker-compose.selfhost.yml build
docker compose -f docker-compose.selfhost.yml up -d
docker compose -f docker-compose.selfhost.yml exec backend npx prisma migrate deploy
```

## Troubleshooting

### Services not starting

```bash
# Check service status
docker compose -f docker-compose.selfhost.yml ps

# View logs
docker compose -f docker-compose.selfhost.yml logs -f backend
docker compose -f docker-compose.selfhost.yml logs -f frontend
```

### Database connection issues

```bash
# Check if postgres is healthy
docker compose -f docker-compose.selfhost.yml exec postgres pg_isready

# Check DATABASE_URL
docker compose -f docker-compose.selfhost.yml exec backend env | grep DATABASE
```

### Nginx 502 Bad Gateway

The backend or frontend containers may not be ready yet. Wait 30-60 seconds and try again.

```bash
# Check if backend is healthy
docker compose -f docker-compose.selfhost.yml exec backend wget --spider http://localhost:3000/api/v1/health
```

### Reset everything

```bash
docker compose -f docker-compose.selfhost.yml down -v
# Edit .env if needed
docker compose -f docker-compose.selfhost.yml up -d --build
```

### Changing branding after initial setup

Since `NEXT_PUBLIC_*` variables are baked into the Next.js build, you need to rebuild after changing them:

```bash
# Edit .env
docker compose -f docker-compose.selfhost.yml build frontend cms
docker compose -f docker-compose.selfhost.yml up -d frontend cms
```
