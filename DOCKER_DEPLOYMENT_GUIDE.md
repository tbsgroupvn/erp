# 🐳 TBS ERP - Docker Deployment Guide

Complete guide for deploying TBS ERP using Docker containers.

---

## 📋 Prerequisites

### 1. Install Docker Desktop

**Windows:**
```bash
winget install Docker.DockerDesktop
```

**macOS:**
```bash
brew install --cask docker
```

**Linux:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### 2. Verify Installation

```bash
docker --version
docker-compose --version
```

---

## 🚀 Quick Start

### Local Development

```bash
# 1. Copy environment file
copy .env.docker.example .env

# 2. Edit .env with your secrets
# - POSTGRES_PASSWORD
# - JWT_SECRET

# 3. Run setup script
docker-setup.bat

# OR manually:
docker-compose up -d --build
docker-compose exec backend npx prisma migrate deploy
```

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/api
- Health Check: http://localhost:3001/health

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Docker Network                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Frontend   │───→│   Backend    │───→│  PostgreSQL  │  │
│  │   Next.js    │    │   NestJS     │    │   Database   │  │
│  │   Port 3000  │    │   Port 3001  │    │   Port 5433  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                               │                              │
│                               ↓                              │
│                      ┌──────────────┐                        │
│                      │    Redis     │                        │
│                      │    Cache     │                        │
│                      │  Port 6379   │                        │
│                      └──────────────┘                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Docker Files Overview

### 1. **Dockerfile (Backend)**
Location: `tbs-erp-backend/Dockerfile`

Multi-stage build for optimized production image:
- **Stage 1 (deps):** Install dependencies
- **Stage 2 (build):** Build TypeScript, generate Prisma client
- **Stage 3 (production):** Minimal runtime image

```dockerfile
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main"]
```

### 2. **Dockerfile (Frontend)**
Location: `tbs-erp-frontend/Dockerfile`

Next.js standalone build for minimal image size:
- Enables `output: 'standalone'` in next.config.js
- Non-root user for security
- Optimized static assets

```dockerfile
FROM node:20-alpine AS production
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

### 3. **docker-compose.yml** (Local)
Complete stack with all services:
- PostgreSQL 16 (port 5433)
- Redis 7 (port 6379)
- Backend NestJS (port 3001)
- Frontend Next.js (port 3000)

### 4. **docker-compose.staging.yml**
Staging environment with:
- GitHub Container Registry images
- Traefik reverse proxy labels
- Debug logging enabled
- Staging domain URLs

### 5. **docker-compose.production.yml**
Production-ready configuration:
- Resource limits (CPU/Memory)
- Service replicas (2x backend, 2x frontend)
- Health checks for load balancers
- Production domain URLs
- Automated backups volume

---

## 🔧 Configuration

### Environment Variables

Create `.env` file from example:

```bash
copy .env.docker.example .env
```

**Critical Variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | Database password | `strong-password-123` |
| `JWT_SECRET` | JWT signing key | `random-64-char-string` |
| `SENTRY_DSN` | Error tracking (optional) | `https://xxx@sentry.io/123` |
| `FRONTEND_URL` | CORS whitelist | `https://app.tbslogistics.com` |

**⚠️ Security:**
- Change default passwords
- Use long random strings for JWT_SECRET (minimum 32 characters)
- Never commit `.env` to git

---

## 🛠️ Common Commands

### Build & Start

```bash
# Build and start all services
docker-compose up -d --build

# Start specific service
docker-compose up -d backend

# Force rebuild without cache
docker-compose build --no-cache backend
docker-compose up -d backend
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Database Operations

```bash
# Run migrations
docker-compose exec backend npx prisma migrate deploy

# Access database
docker-compose exec postgres psql -U tbs_user -d tbs_erp

# Create backup
docker-compose exec postgres pg_dump -U tbs_user tbs_erp > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U tbs_user tbs_erp < backup.sql
```

### Service Management

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v

# Restart service
docker-compose restart backend

# View running containers
docker-compose ps

# Execute command in container
docker-compose exec backend sh
docker-compose exec backend npm run seed
```

### Health Checks

```bash
# Check backend health
curl http://localhost:3001/health

# Check detailed health
curl http://localhost:3001/health/detailed

# Check frontend
curl http://localhost:3000
```

---

## 🚢 Deployment Strategies

### Strategy 1: Direct Docker Compose (Simple)

**Use Case:** Small deployments, single server

```bash
# On server
git clone <repository>
cd ERPv1
copy .env.production .env
docker-compose -f docker-compose.production.yml up -d
```

**Pros:**
- Simple setup
- Direct control

**Cons:**
- Manual deployment
- No auto-scaling
- Downtime during updates

---

### Strategy 2: CI/CD with GitHub Actions (Recommended)

**Use Case:** Team collaboration, automated deployments

**Flow:**
1. Push to `main` branch
2. GitHub Actions builds Docker images
3. Push images to GitHub Container Registry
4. SSH to server and pull new images
5. Rolling restart with zero downtime

**Setup:**

```yaml
# .github/workflows/ci-cd.yml
- name: Build and push Docker images
  uses: docker/build-push-action@v5
  with:
    push: true
    tags: ghcr.io/${{ github.repository }}-backend:latest

- name: Deploy to Production
  uses: appleboy/ssh-action@master
  with:
    script: |
      cd /var/www/tbs-erp
      docker-compose pull
      docker-compose up -d
```

**Required Secrets:**
- `PRODUCTION_HOST` - Server IP
- `PRODUCTION_USER` - SSH username
- `PRODUCTION_SSH_KEY` - Private SSH key
- `GITHUB_TOKEN` - Auto-provided by GitHub

---

### Strategy 3: Kubernetes (Enterprise)

**Use Case:** High availability, auto-scaling, multi-region

```bash
# Convert docker-compose to Kubernetes
kompose convert -f docker-compose.production.yml

# Deploy to cluster
kubectl apply -f k8s/
```

**Features:**
- Auto-scaling based on CPU/Memory
- Self-healing (restart failed containers)
- Rolling updates with zero downtime
- Load balancing across multiple pods

---

## 🔍 Monitoring

### 1. Health Checks

Built-in health endpoints:

```bash
# Backend health
GET http://localhost:3001/health
Response: { "status": "ok", "timestamp": "2025-01-15T10:00:00Z" }

# Detailed health (database, memory, uptime)
GET http://localhost:3001/health/detailed
Response: {
  "status": "ok",
  "database": "connected",
  "memory": { "used": "150MB", "total": "512MB" },
  "uptime": "2 days"
}
```

### 2. Sentry Integration

Error tracking and performance monitoring:

```bash
# Add to .env
SENTRY_DSN=https://xxx@sentry.io/123

# Restart backend
docker-compose restart backend
```

### 3. Container Metrics

```bash
# View resource usage
docker stats

# View specific container
docker stats tbs_erp_backend

# Export metrics
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

---

## 🐛 Troubleshooting

### Issue 1: Container Won't Start

**Symptoms:**
```bash
docker-compose up -d
# Container exits immediately
```

**Solution:**
```bash
# View logs for error details
docker-compose logs backend

# Common issues:
# - Missing environment variables
# - Database connection failed
# - Port already in use
```

---

### Issue 2: Database Connection Error

**Symptoms:**
```
Error: connect ECONNREFUSED postgres:5432
```

**Solution:**
```bash
# Check if postgres is running
docker-compose ps postgres

# Wait for postgres to be healthy
docker-compose up -d postgres
docker-compose logs postgres | grep "database system is ready"

# Restart backend after postgres is ready
docker-compose restart backend
```

---

### Issue 3: Port Already in Use

**Symptoms:**
```
Error: bind: address already in use
```

**Solution:**
```bash
# Windows: Find process using port
netstat -ano | findstr :3000

# Kill process
taskkill /PID <pid> /F

# OR change port in .env
FRONTEND_PORT=3001
```

---

### Issue 4: Migration Fails

**Symptoms:**
```
Error: migration already applied
```

**Solution:**
```bash
# Check migration status
docker-compose exec backend npx prisma migrate status

# Reset database (⚠️ deletes all data)
docker-compose exec backend npx prisma migrate reset

# OR manually fix _prisma_migrations table
docker-compose exec postgres psql -U tbs_user -d tbs_erp
# DELETE FROM _prisma_migrations WHERE migration_name = 'xxx';
```

---

### Issue 5: Out of Disk Space

**Symptoms:**
```
Error: no space left on device
```

**Solution:**
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove all unused resources
docker system prune -a --volumes

# Check disk usage
docker system df
```

---

## 🔐 Security Best Practices

### 1. Use Non-Root User

✅ Frontend Dockerfile already uses `nextjs` user
✅ Backend should use non-root user (add to Dockerfile)

```dockerfile
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs
USER nodejs
```

### 2. Secrets Management

❌ Never hardcode secrets in Dockerfile or docker-compose.yml

✅ Use environment variables from .env file
✅ Use Docker Secrets in production
✅ Use external secret management (AWS Secrets Manager, HashiCorp Vault)

```bash
# Docker Secrets (Docker Swarm)
echo "my-secret-password" | docker secret create postgres_password -
```

### 3. Network Isolation

✅ Use internal network for backend services
✅ Only expose frontend port to host

```yaml
networks:
  tbs_network:
    internal: true  # No external access

  public:
    internal: false  # Frontend only
```

### 4. Resource Limits

✅ Set CPU and memory limits to prevent DoS

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 1G
```

### 5. Regular Updates

```bash
# Update base images
docker pull node:20-alpine
docker pull postgres:16-alpine
docker pull redis:7-alpine

# Rebuild with latest base
docker-compose build --no-cache
```

---

## 📊 Performance Optimization

### 1. Multi-Stage Builds

✅ Already implemented - reduces image size by 80%

```
Development image: ~1.2GB
Production image: ~250MB
```

### 2. Layer Caching

✅ Copy package.json first, then install dependencies
✅ This allows Docker to cache dependency layer

```dockerfile
COPY package.json package-lock.json ./
RUN npm ci  # ← Cached if package.json unchanged
COPY . .    # ← Only rebuild if source changes
```

### 3. Build Cache

```bash
# Use BuildKit for faster builds
export DOCKER_BUILDKIT=1
docker-compose build

# Use GitHub Actions cache
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### 4. Resource Allocation

Adjust based on your workload:

**Small (<100 users):**
```yaml
backend:
  deploy:
    resources:
      limits: { cpus: '1', memory: '512M' }
```

**Medium (100-1000 users):**
```yaml
backend:
  deploy:
    resources:
      limits: { cpus: '2', memory: '1G' }
    replicas: 2
```

**Large (1000+ users):**
```yaml
backend:
  deploy:
    resources:
      limits: { cpus: '4', memory: '2G' }
    replicas: 4
```

---

## 🔄 Backup & Recovery

### Automated Backups

Create backup script `backup.bat`:

```batch
@echo off
set BACKUP_DIR=backups
set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%

mkdir %BACKUP_DIR%\%TIMESTAMP%

REM Backup database
docker-compose exec -T postgres pg_dump -U tbs_user tbs_erp > %BACKUP_DIR%\%TIMESTAMP%\database.sql

REM Backup volumes
docker run --rm -v tbs_erp_pgdata:/data -v %cd%\%BACKUP_DIR%\%TIMESTAMP%:/backup alpine tar czf /backup/pgdata.tar.gz -C /data .

echo Backup completed: %BACKUP_DIR%\%TIMESTAMP%
```

### Schedule Backups (Windows Task Scheduler)

```batch
schtasks /create /tn "TBS ERP Backup" /tr "D:\ERPv1\backup.bat" /sc daily /st 02:00
```

### Restore from Backup

```bash
# Stop containers
docker-compose down

# Restore database
docker-compose up -d postgres
docker-compose exec -T postgres psql -U tbs_user tbs_erp < backups/20250115/database.sql

# Restore volumes
docker run --rm -v tbs_erp_pgdata:/data -v %cd%\backups\20250115:/backup alpine tar xzf /backup/pgdata.tar.gz -C /data

# Start all services
docker-compose up -d
```

---

## 📚 Additional Resources

- **Docker Documentation:** https://docs.docker.com/
- **Docker Compose:** https://docs.docker.com/compose/
- **Next.js Docker:** https://nextjs.org/docs/deployment#docker-image
- **NestJS Docker:** https://docs.nestjs.com/recipes/prisma#dockerfile
- **Prisma in Docker:** https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-docker

---

## ✅ Pre-Deployment Checklist

Before deploying to production:

- [ ] Change all default passwords in `.env`
- [ ] Generate strong JWT_SECRET (32+ characters)
- [ ] Configure SENTRY_DSN for error tracking
- [ ] Set up SSL certificates (Let's Encrypt)
- [ ] Configure firewall rules (allow 80, 443 only)
- [ ] Set up automated backups
- [ ] Test health check endpoints
- [ ] Load test with expected traffic
- [ ] Set up monitoring alerts (Uptime Robot, Pingdom)
- [ ] Document rollback procedure
- [ ] Test rollback procedure

---

## 🆘 Support

**Issues:** https://github.com/your-org/tbs-erp/issues
**Email:** support@tbslogistics.com
**Slack:** #tbs-erp-support

---

**Created:** 2025-01-15
**Version:** 1.0
**Author:** TBS ERP Team
