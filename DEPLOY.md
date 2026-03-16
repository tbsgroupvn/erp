# Huong dan Deploy ERP len VPS

## Yeu cau toi thieu

- **VPS**: 2 vCPU, 4GB RAM, 40GB SSD
- **OS**: Ubuntu 22.04 LTS
- **Domain**: Da tro DNS ve IP VPS

### Khuyen nghi VPS

| Provider | Goi | Spec | Gia |
|----------|-----|------|-----|
| **Hetzner** | CX31 | 4 vCPU / 8GB / 80GB | ~$8.5/mo |
| Contabo | VPS S | 4 vCPU / 8GB / 200GB | ~$7/mo |

---

## Buoc 1: Tro domain ve VPS

Tao 3 ban ghi DNS A tai nha cung cap domain:

```
@     A  <IP_VPS>     -> example.com       (CMS website)
erp   A  <IP_VPS>     -> erp.example.com   (ERP dashboard)
api   A  <IP_VPS>     -> api.example.com   (Backend API)
```

**Luu y**: DNS can tro truoc khi deploy vi SSL (Let's Encrypt) can verify domain.

---

## Buoc 2: SSH vao VPS va cai dat

```bash
# SSH vao VPS
ssh root@<IP_VPS>

# Cap nhat he thong
apt update && apt upgrade -y

# Cai Docker
apt install -y curl git
curl -fsSL https://get.docker.com | sh

# Clone project
git clone <repo-url> /opt/tbs-erp
cd /opt/tbs-erp

# Chay setup tu dong (interactive)
chmod +x scripts/setup.sh
./scripts/setup.sh
```

Script `setup.sh` se tu dong:
1. Kiem tra Docker, RAM, disk
2. Hoi ten cong ty, domain, email SSL
3. Generate `.env` voi passwords bao mat
4. Tao SSL certificate tam (de nginx start duoc)
5. Build Docker images
6. Start PostgreSQL + Redis truoc
7. Chay Prisma migrate + seed data (dung build image co day du deps)
8. Start tat ca services con lai (backend, frontend, cms, nginx)
9. Lay SSL certificate that tu Let's Encrypt

---

## Buoc 3: Kiem tra

Sau khi setup xong:

| URL | Muc dich |
|-----|----------|
| `https://erp.<domain>` | ERP Dashboard |
| `https://api.<domain>` | Backend API |
| `https://<domain>` | CMS Website |

**Dang nhap mac dinh:**
- Email: `admin@<domain>`
- Password: `Admin@123`

**QUAN TRONG: Doi mat khau admin ngay sau khi dang nhap!**

---

## Buoc 4: Cai dat backup tu dong

```bash
# Mo crontab
crontab -e

# Them cac dong sau:
# Backup hang ngay luc 2:00 AM
0 2 * * * cd /opt/tbs-erp && docker compose -f docker-compose.selfhost.yml exec -T postgres pg_dump -U erp_user erp_db | gzip > /opt/backups/daily_$(date +\%Y\%m\%d).sql.gz

# Xoa backup cu hon 7 ngay
0 3 * * * find /opt/backups -name "daily_*.sql.gz" -mtime +7 -delete
```

Hoac dung script backup co san:

```bash
mkdir -p /opt/backups
# Backup thu cong
docker compose -f docker-compose.selfhost.yml exec -T postgres pg_dump -U erp_user erp_db | gzip > /opt/backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

---

## Cac lenh thuong dung

```bash
cd /opt/tbs-erp

# Xem logs tat ca services
docker compose -f docker-compose.selfhost.yml logs -f

# Xem logs 1 service cu the
docker compose -f docker-compose.selfhost.yml logs -f backend

# Restart services
docker compose -f docker-compose.selfhost.yml restart

# Dung services
docker compose -f docker-compose.selfhost.yml down

# Xem trang thai services
docker compose -f docker-compose.selfhost.yml ps
```

---

## Cap nhat code

```bash
cd /opt/tbs-erp
./scripts/update.sh
```

Script `update.sh` se tu dong:
1. Pull code moi tu git
2. Rebuild Docker images
3. Chay database migrations (truoc khi restart)
4. Restart services
5. Kiem tra health

---

## Restore database

```bash
# Tu file backup
gunzip -c /opt/backups/backup_20260301.sql.gz | docker compose -f docker-compose.selfhost.yml exec -T postgres psql -U erp_user erp_db
```

---

## Troubleshooting

### Nginx khong start
```bash
# Kiem tra logs
docker compose -f docker-compose.selfhost.yml logs nginx

# Kiem tra config
docker compose -f docker-compose.selfhost.yml exec nginx nginx -t
```

### Backend khong start
```bash
# Kiem tra logs
docker compose -f docker-compose.selfhost.yml logs backend

# Kiem tra database connection
docker compose -f docker-compose.selfhost.yml exec backend npx prisma db pull
```

### SSL het han
```bash
# Renew SSL thu cong
docker compose -f docker-compose.selfhost.yml run --rm certbot renew
docker compose -f docker-compose.selfhost.yml exec nginx nginx -s reload
```

SSL tu dong renew moi 12 gio boi certbot container.

---

## Files lien quan

| File | Muc dich |
|------|----------|
| `docker-compose.selfhost.yml` | Docker Compose cho self-host |
| `scripts/setup.sh` | Script cai dat interactive |
| `scripts/update.sh` | Script cap nhat code |
| `scripts/backup.sh` | Script backup database |
| `scripts/restore.sh` | Script restore database |
| `nginx/nginx.selfhost.conf.template` | Nginx config (SSL, caching, rate limit) |
| `.env` | File cau hinh (auto-generated, KHONG commit!) |
