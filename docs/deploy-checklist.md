# Huong Dan Trien Khai TBS ERP Len VPS

> Huong dan nay duoc viet cho ky thuat vien trien khai he thong lan dau tren may chu Ubuntu 22.04.
> Doc ky toan bo truoc khi thuc hien.

---

## Yeu Cau Toi Thieu

### Phan Cung VPS

| Thong so | Toi thieu | Khuyen nghi |
|----------|-----------|-------------|
| RAM | 4 GB | 8 GB |
| CPU | 2 core | 4 core |
| Disk | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Ket noi | Stable internet | >= 100 Mbps |

### Phan Mem Can Co Truoc

- Quyen truy cap SSH vao VPS (user root hoac sudo)
- Ten mien da duoc tro DNS dung
- Git (neu can clone tu repo)

---

## Buoc 1 — Chuan Bi DNS Truoc Khi Bat Dau

DNS **phai duoc tro den IP VPS** truoc khi chay script (Let's Encrypt can verify domain).

| Record | Type | Value | TTL |
|--------|------|-------|-----|
| `example.com` | A | `<IP-VPS>` | 300 |
| `www.example.com` | A | `<IP-VPS>` | 300 |
| `erp.example.com` | A | `<IP-VPS>` | 300 |
| `api.example.com` | A | `<IP-VPS>` | 300 |

Kiem tra DNS da phan giai chua:

```bash
dig +short erp.example.com
dig +short api.example.com
dig +short example.com
```

Ket qua phai hien IP VPS. Neu chua thay, doi 5-30 phut roi kiem tra lai.

---

## Buoc 2 — SSH Vao VPS

```bash
ssh root@<IP-VPS>
```

Hoac neu dung user co sudo:

```bash
ssh user@<IP-VPS>
sudo -i
```

---

## Buoc 3 — Copy Code Len VPS

### Option A — Clone tu Git (khuyen nghi)

```bash
cd /opt
git clone https://github.com/your-org/erp.git erp
```

### Option B — Upload bang SCP (neu khong co git access tren VPS)

Tu may local (Windows PowerShell / macOS Terminal):

```bash
scp -r D:/ERPv1 root@<IP-VPS>:/opt/erp
```

Sau do SSH vao VPS va kiem tra:

```bash
ls /opt/erp/docker-compose.selfhost.yml
```

Phai thay file ton tai.

---

## Buoc 4 — Chay Script Trien Khai

Script `deploy-vps.sh` se tu dong hoa **tat ca** cac buoc sau:

- Cap nhat he thong Ubuntu
- Cai Docker Engine + Compose plugin
- Cau hinh tuong lua UFW (chi mo cong 22, 80, 443)
- Cau hinh fail2ban bao ve SSH
- Tao user deploy `erpdeploy`
- Sinh tat ca mat khau & khoa bi mat tu dong
- Tao PgBouncer userlist voi MD5 hash
- Build Docker images (backend NestJS + frontend Next.js)
- Khoi dong PostgreSQL, Redis, PgBouncer
- Chay Prisma migrate + seed (tao tai khoan admin mac dinh)
- Khoi dong tat ca service (nginx, backend, frontend, CMS, certbot)
- Cap SSL Let's Encrypt tu dong
- Cai systemd service de tu khoi dong khi reboot

### Chay Script

```bash
# Di den thu muc du an
cd /opt/erp

# Cap quyen chay
chmod +x scripts/deploy-vps.sh

# Chay script (thay the domain va email cua ban)
sudo bash scripts/deploy-vps.sh \
  --domain erp.example.com \
  --api-domain api.example.com \
  --cms-domain example.com \
  --email admin@example.com \
  --company-name "Ten Cong Ty"
```

#### Cac Tham So

| Tham so | Bat buoc | Mo ta | Vi du |
|---------|----------|-------|-------|
| `--domain` | Co | Domain ERP dashboard | `erp.tbs.vn` |
| `--api-domain` | Co | Domain Backend API | `api.tbs.vn` |
| `--email` | Co | Email Let's Encrypt + admin | `ops@tbs.vn` |
| `--cms-domain` | Khong | Domain CMS/website chinh (mac dinh: parent cua domain) | `tbs.vn` |
| `--repo-url` | Khong | URL Git de clone (neu chua co code) | `https://github.com/...` |
| `--company-name` | Khong | Ten cong ty ngan (mac dinh: "My ERP") | `"TBS Logistics"` |
| `--no-ssl` | Khong | Bo qua SSL (chi dung de test) | |

#### Vi du voi clone tu repo

```bash
sudo bash scripts/deploy-vps.sh \
  --domain erp.tbs.vn \
  --api-domain api.tbs.vn \
  --cms-domain tbs.vn \
  --email ops@tbs.vn \
  --repo-url https://github.com/your-org/erp.git \
  --company-name "TBS Logistics"
```

### Thoi Gian Du Kien

| Buoc | Thoi gian |
|------|-----------|
| Cap nhat he thong | 2-5 phut |
| Cai Docker | 1-3 phut |
| Build Docker images | 8-20 phut |
| Migrate database | 1-3 phut |
| Cap SSL | 1-2 phut |
| **Tong cong** | **12-33 phut** |

---

## Buoc 5 — Xac Minh Trien Khai

### Kiem Tra Tat Ca Service Dang Chay

```bash
cd /opt/erp
docker compose -f docker-compose.selfhost.yml ps
```

Ket qua mong doi — cot STATUS phai la `running (healthy)`:

```
NAME                    IMAGE     STATUS                    PORTS
erp_postgres            postgres  running (healthy)
erp_redis               redis     running (healthy)
erp_pgbouncer           pgbounc   running (healthy)
erp_backend             ...       running (healthy)
erp_frontend            ...       running (healthy)
erp_cms                 ...       running (healthy)
erp_nginx               nginx     running
erp_certbot             certbot   running
```

### Kiem Tra Health API

```bash
curl https://api.example.com/api/v1/health
```

Phai tra ve HTTP 200 voi JSON kieu:

```json
{ "status": "ok", "timestamp": "..." }
```

### Kiem Tra SSL

```bash
curl -v https://erp.example.com 2>&1 | grep -E "SSL|certificate|issuer"
```

Phai thay `issuer: C=US, O=Let's Encrypt`.

---

## Buoc 6 — Dang Nhap Lan Dau

1. Mo trinh duyet, truy cap: `https://erp.example.com`
2. Dang nhap bang tai khoan mac dinh:
   - **Email**: `admin@<SEED_EMAIL_DOMAIN>` (vi du: `admin@example.com`)
   - **Mat khau**: `Admin@123`
3. **Doi mat khau ngay lap tuc** sau khi dang nhap lan dau
4. Vao phan Quan ly nguoi dung de tao cac tai khoan nhan vien

---

## Buoc 7 — Cau Hinh Sau Khi Cai Dat

### 7.1 Cau Hinh SMTP (Gui Email)

Mo file `.env` de chinh sua:

```bash
nano /opt/erp/.env
```

Tim va sua cac dong sau:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password    # Mat khau ung dung Gmail App Password
SMTP_FROM_EMAIL=noreply@example.com
SMTP_FROM_NAME=Ten Cong Ty ERP
```

Sau khi sua, khoi dong lai backend:

```bash
cd /opt/erp
docker compose -f docker-compose.selfhost.yml restart backend
```

### 7.2 Cau Hinh AI Assistant (Tuy Chon)

Neu muon dung tinh nang TBS Assistant (Anthropic Claude):

```bash
nano /opt/erp/.env
# Sua dong:
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
```

Khoi dong lai backend sau khi sua.

### 7.3 Backup Tu Dong

Cai dat cron job backup hang ngay luc 2 gio sang:

```bash
crontab -e
```

Them dong sau:

```
0 2 * * * cd /opt/erp && bash scripts/backup.sh daily >> /var/log/erp-backup.log 2>&1
```

---

## Buoc 8 — Luu Tru Thong Tin Quan Trong

**SAO LUU FILE .env NGAY LAP TUC** — day la file chua tat ca mat khau va khoa bi mat.
Neu mat file nay, ban phai tao lai he thong tu dau.

```bash
# Hien thi noi dung de copy ra noi an toan
cat /opt/erp/.env
```

Luu vao:
- Password manager (1Password, Bitwarden, ...)
- File ma hoa tren may local
- KHONG luu tren email hoac chat

---

## Xu Ly Su Co Thuong Gap

### Loi: "Domain did not resolve to this IP"

DNS chua cap nhat. Kiem tra lai:

```bash
dig +short erp.example.com
```

Doi 5-60 phut roi chay lai script.

### Loi: "POSTGRES_PASSWORD is required"

File `.env` chua duoc tao. Kiem tra:

```bash
ls -la /opt/erp/.env
```

Neu khong ton tai, script chua chay du buoc. Chay lai tu dau.

### Loi: "port is already allocated"

Cong 80 hoac 443 dang bi chiem. Kiem tra:

```bash
ss -tlnp | grep -E ':80|:443'
```

Dung process dang su dung cong do roi chay lai.

### Backend Khong Healthy Sau 5 Phut

Xem log de tim loi:

```bash
cd /opt/erp
docker compose -f docker-compose.selfhost.yml logs backend --tail=50
```

Loi thuong gap:
- **"DATABASE_URL is required"**: File `.env` khong duoc doc. Kiem tra `chmod 600 .env`.
- **"Connection refused to pgbouncer"**: PgBouncer chua san sang, doi them.
- **"TWO_FA_ENCRYPTION_KEY is required"**: Bien trong `.env` chua du. Kiem tra file.

### Build That Bai (Out of Memory)

VPS RAM qua thap. Them swap:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Roi chay lai script.

### SSL: "Too many requests" tu Let's Encrypt

Let's Encrypt gioi han 5 lan thu trong 1 gio. Dung cu phap `--no-ssl` de test truoc:

```bash
sudo bash scripts/deploy-vps.sh --domain ... --no-ssl
```

### Chay Lai Script An Toan

Script la idempotent — an toan khi chay nhieu lan. No se:
- Bo qua buoc da hoan thanh (Docker da cai, .env da co, cert da co)
- Khong ghi de mat khau da tao
- Khong xoa du lieu database

---

## Lenh Quan Tri Hay Dung

```bash
# Xem log tat ca service (Ctrl+C de thoat)
cd /opt/erp && docker compose -f docker-compose.selfhost.yml logs -f

# Xem log rieng tung service
docker compose -f docker-compose.selfhost.yml logs -f backend
docker compose -f docker-compose.selfhost.yml logs -f frontend
docker compose -f docker-compose.selfhost.yml logs -f nginx

# Xem trang thai service
docker compose -f docker-compose.selfhost.yml ps

# Khoi dong lai mot service
docker compose -f docker-compose.selfhost.yml restart backend

# Dung tat ca service
docker compose -f docker-compose.selfhost.yml down

# Khoi dong lai tat ca service
docker compose -f docker-compose.selfhost.yml up -d

# Backup database thu cong
cd /opt/erp && bash scripts/backup.sh

# Cap nhat phien ban moi
cd /opt/erp && sudo bash scripts/update.sh

# Xem tai nguyen su dung
docker stats

# Kiem tra dung luong
df -h
du -sh /opt/erp
docker system df
```

---

## Cap Nhat Phien Ban Moi

Khi co ban cap nhat moi cua ERP:

```bash
cd /opt/erp
sudo bash scripts/update.sh
```

Script se tu dong:
1. Pull code moi tu git
2. Rebuild Docker images
3. Backup database truoc khi migrate
4. Chay migrations moi
5. Khoi dong lai cac service
6. Kiem tra health

---

## Thong Tin Ky Thuat

### Cac Service va Cong Noi Bo

| Service | Container | Cong noi bo | Mo ta |
|---------|-----------|-------------|-------|
| PostgreSQL | `erp_postgres` | 5432 | Database chinh |
| PgBouncer | `erp_pgbouncer` | 6432 | Connection pooler |
| Redis | `erp_redis` | 6379 | Cache + Queue |
| Backend | `erp_backend` | 3000 | NestJS API |
| Frontend | `erp_frontend` | 3000 | ERP Next.js |
| CMS | `erp_cms` | 3000 | CMS Next.js |
| Nginx | `erp_nginx` | 80, 443 | Reverse proxy |
| Certbot | `erp_certbot` | - | SSL renew tu dong |

### Volume Data

| Volume | Mo ta | Xoa khi? |
|--------|-------|----------|
| `erp_pgdata` | Du lieu PostgreSQL | KHONG BAO GIO |
| `erp_redisdata` | Du lieu Redis | Khi reset cache |
| `erp_certbot_conf` | Chung chi SSL | Khi doi domain |
| `erp_certbot_www` | ACME challenge | An toan de xoa |
| `erp_nginx_logs` | Log nginx | Co the xoa/rotate |

### So Do Ket Noi

```
Internet
    |
   Nginx (:80/:443)
    |-- erp.example.com  --> frontend:3000
    |-- example.com      --> cms:3000
    `-- api.example.com  --> backend:3000
                                  |
                            pgbouncer:6432
                                  |
                            postgres:5432
                         backend:3000 <--> redis:6379
```

---

## Lien He Ho Tro

Neu gap van de trong qua trinh trien khai, thu thap thong tin sau de lien he ky thuat vien:

```bash
# Thu thap thong tin he thong
cd /opt/erp
echo "=== OS ===" && cat /etc/os-release
echo "=== Docker ===" && docker --version && docker compose version
echo "=== Services ===" && docker compose -f docker-compose.selfhost.yml ps
echo "=== Backend Logs ===" && docker compose -f docker-compose.selfhost.yml logs backend --tail=30
echo "=== Nginx Logs ===" && docker compose -f docker-compose.selfhost.yml logs nginx --tail=20
```
