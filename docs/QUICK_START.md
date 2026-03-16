# 🚀 Quick Start Guide - TBS ERP CMS

## Bắt đầu nhanh trong 5 phút!

---

## 📋 Prerequisites

Đảm bảo bạn đã cài:
- ✅ Node.js >= 18
- ✅ PostgreSQL >= 14
- ✅ npm >= 9

---

## ⚡ Quick Setup

### 1. Install Sharp (Backend)
```bash
cd tbs-erp-backend
npm install sharp
```

### 2. Create Uploads Directory
```bash
# Windows
mkdir uploads
mkdir uploads\thumbnails

# Mac/Linux
mkdir -p uploads/thumbnails
```

### 3. Run Migrations
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

### 4. Start Backend
```bash
npm run start:dev
```

Backend chạy tại: **http://localhost:3000**

### 5. Start Frontend (terminal mới)
```bash
cd tbs-erp-frontend
npm run dev
```

Frontend chạy tại: **http://localhost:3001**

---

## ✅ Verify Installation

### Test Backend
```bash
# Health check
curl http://localhost:3000

# Public settings (no auth required)
curl http://localhost:3000/public/cms/settings
```

### Test Frontend
Mở browser: **http://localhost:3001**

---

## 🎯 Quick Test - Create Your First Page

### 1. Login to Admin
```
URL: http://localhost:3001/login
```

### 2. Create a Page via API
```bash
# Get JWT token first (from login)
TOKEN="your-jwt-token-here"

# Create page
curl -X POST http://localhost:3000/cms/pages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-page",
    "title": "Test Page",
    "content": "<h1>Hello World</h1>",
    "status": "PUBLISHED",
    "metaTitle": "Test Page",
    "metaDescription": "This is a test page"
  }'
```

### 3. View Page (Public)
```bash
curl http://localhost:3000/public/cms/pages/test-page
```

---

## 📚 Available Endpoints

### Admin Endpoints (Auth Required)

**Pages:**
```
POST   /cms/pages
GET    /cms/pages
GET    /cms/pages/:id
PATCH  /cms/pages/:id
DELETE /cms/pages/:id
```

**Media:**
```
POST   /cms/media/upload
GET    /cms/media
GET    /cms/media/:id
DELETE /cms/media/:id
```

**Menus:**
```
POST   /cms/menus
GET    /cms/menus
GET    /cms/menus/:id
PATCH  /cms/menus/:id
```

**Settings:**
```
GET    /cms/settings
PUT    /cms/settings/:key
POST   /cms/settings/batch-update
```

### Public Endpoints (No Auth)

```
GET    /public/cms/pages/:slug
GET    /public/cms/menus/:location
GET    /public/cms/settings
POST   /public/cms/contact
POST   /public/cms/newsletter/subscribe
GET    /public/cms/faqs
```

---

## 🎨 Access Swagger Docs

```
http://localhost:3000/api/docs
```

*(Note: Cần config Swagger trong main.ts nếu chưa có)*

---

## 🗄️ Database Management

### Prisma Studio
```bash
cd tbs-erp-backend
npm run prisma:studio
```

Access tại: **http://localhost:5555**

### Useful Commands
```bash
# View schema
npx prisma format

# Create migration
npm run prisma:migrate

# Reset database (DEV only!)
npx prisma migrate reset

# Seed database
npm run prisma:seed
```

---

## 📝 Seed Sample Data

Create file: `prisma/seed/cms-seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCMS() {
  // Create homepage
  await prisma.page.create({
    data: {
      slug: 'home',
      title: 'Trang chủ',
      content: '<h1>Chào mừng đến TBS Logistics</h1>',
      status: 'PUBLISHED',
      authorId: 'admin-user-id',
      publishedAt: new Date(),
    },
  });

  // Create about page
  await prisma.page.create({
    data: {
      slug: 'about',
      title: 'Giới thiệu',
      content: '<h1>Về chúng tôi</h1><p>TBS Logistics...</p>',
      status: 'PUBLISHED',
      authorId: 'admin-user-id',
      publishedAt: new Date(),
    },
  });

  // Create main menu
  const menu = await prisma.menu.create({
    data: {
      name: 'Main Menu',
      location: 'HEADER',
      isActive: true,
    },
  });

  // Create menu items
  await prisma.menuItem.createMany({
    data: [
      {
        menuId: menu.id,
        label: 'Trang chủ',
        url: '/',
        order: 1,
      },
      {
        menuId: menu.id,
        label: 'Giới thiệu',
        url: '/about',
        order: 2,
      },
      {
        menuId: menu.id,
        label: 'Dịch vụ',
        url: '/services',
        order: 3,
      },
      {
        menuId: menu.id,
        label: 'Liên hệ',
        url: '/contact',
        order: 4,
      },
    ],
  });

  // Create settings
  await prisma.siteSetting.createMany({
    data: [
      {
        key: 'site_name',
        value: 'TBS Logistics',
        type: 'string',
        group: 'general',
        label: 'Tên website',
        order: 1,
        isPublic: true,
      },
      {
        key: 'contact_email',
        value: 'info@tbslogistics.com',
        type: 'string',
        group: 'contact',
        label: 'Email',
        order: 1,
        isPublic: true,
      },
      {
        key: 'contact_phone',
        value: '0123456789',
        type: 'string',
        group: 'contact',
        label: 'Điện thoại',
        order: 2,
        isPublic: true,
      },
    ],
  });

  console.log('✅ CMS seed completed!');
}

seedCMS()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run seed:
```bash
npx ts-node prisma/seed/cms-seed.ts
```

---

## 🐛 Troubleshooting

### Error: "Cannot find module 'sharp'"
```bash
cd tbs-erp-backend
npm install sharp
```

### Error: "Cannot connect to database"
Check `.env` file:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/tbs_erp"
```

### Error: "Port 3000 already in use"
```bash
# Find and kill process
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### Error: "Migrations not applied"
```bash
npm run prisma:migrate
```

---

## 📖 Documentation

**Đã tạo:**
1. `CMS_BACKEND_ARCHITECTURE.md` - Backend architecture
2. `CMS_IMPLEMENTATION_GUIDE.md` - Implementation guide
3. `CMS_COMPLETED_SUMMARY.md` - What's completed
4. `PROJECT_SUMMARY.md` - Project overview
5. `UI_IMPROVEMENTS_SUMMARY.md` - UI/UX updates
6. `DEVELOPER_GUIDE.md` - Design system usage
7. `QUICK_START.md` - This file

---

## 🎯 Next Steps

### 1. Backend (5 minutes)
- [x] Install Sharp ✅
- [x] Create uploads directory ✅
- [x] Run migrations ✅
- [x] Start backend ✅

### 2. Testing (10 minutes)
- [ ] Test pages endpoints
- [ ] Upload a test image
- [ ] Create a menu
- [ ] Update settings

### 3. Frontend (Next phase)
- [ ] Create admin UI pages
- [ ] Implement WYSIWYG editor
- [ ] Build media library
- [ ] Create menu builder

---

## 💡 Useful Tips

### 1. Auto-reload on changes
Backend auto-reloads với `npm run start:dev`

### 2. View logs
```bash
# Backend logs
tail -f backend.log

# Or use PM2
pm2 logs
```

### 3. API Testing
Use **Postman** or **Insomnia** với collection từ Swagger

### 4. Database Backup
```bash
pg_dump -U postgres tbs_erp > backup.sql
```

---

## ✅ Verification Checklist

```
[ ] Backend running on port 3000
[ ] Frontend running on port 3001
[ ] Database connected
[ ] Uploads directory created
[ ] Sharp installed
[ ] Migrations applied
[ ] Can access Swagger docs
[ ] Can access Prisma Studio
[ ] Test page created successfully
[ ] Test media upload works
```

---

## 🎉 You're Ready!

Backend CMS hoàn chỉnh và sẵn sàng sử dụng!

**Next:** Build Frontend Admin UI 🎨

---

**Total Setup Time:** ~5 minutes
**Difficulty:** ⭐ Easy
**Status:** ✅ Ready to use
