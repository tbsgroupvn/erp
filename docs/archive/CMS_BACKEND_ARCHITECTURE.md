# TBS ERP - CMS Backend Architecture

## 📋 Tổng quan

Backend CMS được xây dựng trên NestJS với Prisma ORM, PostgreSQL database. Hệ thống hỗ trợ quản lý nội dung đầy đủ cho website logistics/ERP.

---

## 🗂️ Database Schema

### ✅ Đã tạo: `prisma/schema/cms.prisma`

Bao gồm các models:

1. **Page** - Quản lý trang tĩnh (About, Contact, Services)
   - Hỗ trợ hierarchy (parent-child)
   - SEO fields đầy đủ
   - Draft/Published status
   - Custom templates

2. **Media** - Media Library
   - Upload images, videos, documents
   - Thumbnails tự động
   - Folder organization
   - Tags và metadata

3. **Menu** - Dynamic menu management
   - Multiple locations (Header, Footer, Sidebar)
   - Nested items (unlimited depth)
   - Role-based visibility
   - Icons support

4. **MenuItem** - Menu items với hierarchy
   - Drag-and-drop ordering
   - Custom URLs
   - Target (_self/_blank)

5. **SiteSetting** - Key-value store
   - Grouped settings (General, Contact, Social, SEO)
   - Type support (string, number, boolean, json, image)
   - Public/Private settings

6. **Redirect** - SEO redirects
   - 301/302 redirects
   - Active/Inactive status

7. **ContactSubmission** - Contact form submissions
   - Read/Unread status
   - IP tracking
   - Notes for follow-up

8. **NewsletterSubscription** - Newsletter management
   - Active/Unsubscribed status
   - Unsubscribe tokens
   - Source tracking

9. **FAQ** - Frequently Asked Questions
   - Categories
   - View tracking
   - Ordering

### ✅ Đã cải thiện: `prisma/schema/blog.prisma`

1. **BlogCategory** - Blog categories
   - Hierarchy support
   - SEO fields
   - Cover images

2. **BlogPost** - Enhanced blog posts
   - Categories
   - SEO fields (metaTitle, metaDescription, keywords, ogImage)
   - Featured posts
   - View count tracking
   - Reading time calculation
   - Related posts
   - Scheduled publishing

3. **BlogComment** - Comments (optional)
   - Nested replies
   - Moderation (approved/pending)
   - Author info

---

## 📦 Modules Architecture

### 1. CMS Pages Module ✅ (ĐÃ TẠO)

**Location:** `src/modules/cms-pages/`

**Files:**
- `cms-pages.module.ts` ✅
- `pages.controller.ts` ✅
- `pages.service.ts` ✅
- `dto/create-page.dto.ts` ✅
- `dto/update-page.dto.ts` ✅
- `dto/page-filters.dto.ts` ✅

**Endpoints:**
```
POST   /cms/pages                  # Create page
GET    /cms/pages                  # List pages (with filters)
GET    /cms/pages/:id              # Get page by ID
PATCH  /cms/pages/:id              # Update page
DELETE /cms/pages/:id              # Delete page
POST   /cms/pages/reorder          # Reorder pages
POST   /cms/pages/:id/duplicate    # Duplicate page
```

**Features:**
- ✅ CRUD operations
- ✅ Slug validation (unique)
- ✅ Auto-publish date when status = PUBLISHED
- ✅ Hierarchy support (parent-child)
- ✅ Search functionality
- ✅ Pagination
- ✅ Duplicate page
- ✅ Reorder pages

---

### 2. Media Module 🔨 (CẦN TẠO)

**Location:** `src/modules/cms-media/`

**Files to create:**
```
cms-media/
├── cms-media.module.ts
├── media.controller.ts
├── media.service.ts
├── dto/
│   ├── upload-media.dto.ts
│   ├── update-media.dto.ts
│   └── media-filters.dto.ts
└── interceptors/
    └── file-upload.interceptor.ts
```

**Endpoints:**
```
POST   /cms/media/upload           # Upload file(s)
GET    /cms/media                  # List media (with filters)
GET    /cms/media/:id              # Get media by ID
PATCH  /cms/media/:id              # Update media metadata
DELETE /cms/media/:id              # Delete media
POST   /cms/media/:id/move         # Move to folder
GET    /cms/media/folders          # List folders
```

**Features:**
- File upload (images, videos, documents)
- Image resizing & thumbnail generation
- Folder organization
- Tags & search
- Bulk operations
- Storage: Local filesystem or S3

**Dependencies:**
```bash
npm install multer @nestjs/platform-express sharp
npm install --save-dev @types/multer
```

**Example Service Code:**

```typescript
// media.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import * as sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class MediaService {
  private uploadDir = './uploads';
  private thumbnailDir = './uploads/thumbnails';

  constructor(private readonly prisma: PrismaService) {}

  async upload(file: Express.Multer.File, userId: string) {
    // Generate unique filename
    const filename = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(this.uploadDir, filename);
    const url = `/uploads/${filename}`;

    // Save file
    await fs.writeFile(filePath, file.buffer);

    // Generate thumbnail for images
    let thumbnailUrl: string | null = null;
    let width: number | null = null;
    let height: number | null = null;

    if (file.mimetype.startsWith('image/')) {
      const image = sharp(file.buffer);
      const metadata = await image.metadata();
      width = metadata.width;
      height = metadata.height;

      // Create thumbnail
      const thumbnailFilename = `thumb-${filename}`;
      const thumbnailPath = path.join(this.thumbnailDir, thumbnailFilename);
      await image.resize(300, 300, { fit: 'inside' }).toFile(thumbnailPath);
      thumbnailUrl = `/uploads/thumbnails/${thumbnailFilename}`;
    }

    // Determine media type
    const type = this.getMediaType(file.mimetype);

    // Save to database
    return this.prisma.media.create({
      data: {
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        type,
        path: filePath,
        url,
        thumbnailUrl,
        width,
        height,
        uploadedBy: userId,
      },
    });
  }

  private getMediaType(mimeType: string) {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    if (mimeType.startsWith('audio/')) return 'AUDIO';
    if (mimeType.includes('pdf') || mimeType.includes('document')) return 'DOCUMENT';
    return 'OTHER';
  }

  // ... other methods (findAll, findOne, update, delete)
}
```

---

### 3. Menu Module 🔨 (CẦN TẠO)

**Location:** `src/modules/cms-menu/`

**Files to create:**
```
cms-menu/
├── cms-menu.module.ts
├── menu.controller.ts
├── menu.service.ts
└── dto/
    ├── create-menu.dto.ts
    ├── update-menu.dto.ts
    ├── create-menu-item.dto.ts
    └── update-menu-item.dto.ts
```

**Endpoints:**
```
POST   /cms/menus                  # Create menu
GET    /cms/menus                  # List all menus
GET    /cms/menus/:id              # Get menu with items
PATCH  /cms/menus/:id              # Update menu
DELETE /cms/menus/:id              # Delete menu

POST   /cms/menus/:id/items        # Add menu item
PATCH  /cms/menus/:id/items/:itemId # Update menu item
DELETE /cms/menus/:id/items/:itemId # Delete menu item
POST   /cms/menus/:id/items/reorder # Reorder menu items
```

**Features:**
- Multiple menu locations
- Nested items (unlimited depth)
- Drag-and-drop reordering
- Role-based visibility
- Icons support

---

### 4. Settings Module 🔨 (CẦN TẠO)

**Location:** `src/modules/cms-settings/`

**Files to create:**
```
cms-settings/
├── cms-settings.module.ts
├── settings.controller.ts
├── settings.service.ts
└── dto/
    ├── create-setting.dto.ts
    └── update-setting.dto.ts
```

**Endpoints:**
```
GET    /cms/settings               # Get all settings (grouped)
GET    /cms/settings/:key          # Get setting by key
PUT    /cms/settings/:key          # Update setting
POST   /cms/settings               # Create setting
DELETE /cms/settings/:key          # Delete setting
GET    /cms/settings/group/:group  # Get settings by group
```

**Setting Groups:**
- `general` - Site name, logo, description
- `contact` - Email, phone, address
- `social` - Facebook, Twitter, Instagram links
- `seo` - Default meta tags
- `email` - SMTP settings
- `analytics` - Google Analytics, etc.

---

### 5. Blog Categories Module 🔨 (CẦN TẠO)

**Location:** `src/modules/blog/categories/`

**Endpoints:**
```
POST   /blog/categories            # Create category
GET    /blog/categories            # List categories
GET    /blog/categories/:id        # Get category
PATCH  /blog/categories/:id        # Update category
DELETE /blog/categories/:id        # Delete category
```

---

### 6. Enhanced Blog Module 🔨 (CẦN NÂNG CẤP)

**Location:** `src/modules/blog/` (đã có, cần nâng cấp)

**New Endpoints to add:**
```
GET    /blog/posts/featured        # Get featured posts
POST   /blog/posts/:id/view        # Increment view count
GET    /blog/posts/:id/related     # Get related posts
POST   /blog/posts/:id/schedule    # Schedule post
```

**Features to add:**
- Featured posts
- View count tracking
- Related posts algorithm
- Scheduled publishing
- Reading time calculation

---

## 🔐 Authentication & Authorization

### Guards & Roles

```typescript
// Usage in controllers
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CONTENT_EDITOR')
```

### Roles for CMS:
- `ADMIN` - Full access
- `MANAGER` - Can manage all content
- `CONTENT_EDITOR` - Can create/edit content
- `CONTENT_VIEWER` - Read-only access

---

## 📝 Running Migrations

```bash
# Generate Prisma client
npm run prisma:generate

# Create migration
npm run prisma:migrate

# Run migrations in production
npm run prisma:migrate:prod

# Open Prisma Studio
npm run prisma:studio
```

---

## 🚀 API Documentation

### Swagger Integration

Add to `main.ts`:

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('TBS ERP CMS API')
  .setDescription('Content Management System API for TBS ERP')
  .setVersion('1.0')
  .addBearerAuth()
  .addTag('cms', 'Content Management')
  .addTag('blog', 'Blog Management')
  .addTag('media', 'Media Library')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

Access: `http://localhost:3000/api/docs`

---

## 🧪 Testing

### Example Test File

```typescript
// pages.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PagesService } from './pages.service';
import { PrismaService } from '@core/database/prisma.service';

describe('PagesService', () => {
  let service: PagesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagesService,
        {
          provide: PrismaService,
          useValue: {
            page: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PagesService>(PagesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a page', async () => {
    const createDto = {
      slug: 'test-page',
      title: 'Test Page',
      content: 'Test content',
      status: 'DRAFT',
    };

    jest.spyOn(prisma.page, 'create').mockResolvedValue({
      id: '1',
      ...createDto,
      authorId: 'user1',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await service.create(createDto, 'user1');
    expect(result.slug).toBe('test-page');
  });
});
```

---

## 📦 Required Dependencies

```json
{
  "dependencies": {
    "@nestjs/common": "^10.4.15",
    "@nestjs/core": "^10.4.15",
    "@nestjs/platform-express": "^10.4.15",
    "@nestjs/config": "^3.3.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/swagger": "^7.4.2",
    "@prisma/client": "^6.3.0",
    "multer": "^1.4.5-lts.1",
    "sharp": "^0.33.5",
    "class-validator": "^0.14.1",
    "class-transformer": "^0.5.1"
  },
  "devDependencies": {
    "@types/multer": "^2.0.0",
    "prisma": "^6.3.0"
  }
}
```

---

## 🌐 Public API Endpoints (No Auth Required)

### Public Module

```typescript
// src/modules/public/public.controller.ts

@Controller('public')
export class PublicController {
  // Get page by slug
  @Get('pages/:slug')
  async getPage(@Param('slug') slug: string) {
    return this.pagesService.findBySlug(slug);
  }

  // Get published blog posts
  @Get('blog/posts')
  async getBlogPosts(@Query() filters) {
    return this.blogService.findPublished(filters);
  }

  // Get blog post by slug
  @Get('blog/posts/:slug')
  async getBlogPost(@Param('slug') slug: string) {
    return this.blogService.findBySlug(slug);
  }

  // Get menu by location
  @Get('menus/:location')
  async getMenu(@Param('location') location: string) {
    return this.menuService.findByLocation(location);
  }

  // Get public settings
  @Get('settings')
  async getSettings() {
    return this.settingsService.findPublic();
  }

  // Submit contact form
  @Post('contact')
  async submitContact(@Body() dto: ContactSubmissionDto) {
    return this.contactService.create(dto);
  }

  // Subscribe to newsletter
  @Post('newsletter/subscribe')
  async subscribe(@Body() dto: NewsletterSubscribeDto) {
    return this.newsletterService.subscribe(dto);
  }
}
```

---

## 📊 Database Indexes

### Performance Optimization

Schema đã include các indexes:
- `pages`: slug, status+publishedAt, parentId
- `blog_posts`: slug, status+publishedAt, categoryId, tags, isFeatured
- `blog_categories`: slug, parentId
- `media`: type, folder, tags, uploadedBy
- `menus`: location+isActive
- `menu_items`: menuId+order, parentId
- `settings`: group+order, isPublic

---

## 🔄 Migration Strategy

### Step 1: Create Migration
```bash
npx prisma migrate dev --name add_cms_tables
```

### Step 2: Seed Sample Data
```typescript
// prisma/seed/cms-seed.ts

async function seedCMS() {
  // Create sample pages
  await prisma.page.create({
    data: {
      slug: 'about',
      title: 'Về chúng tôi',
      content: '<h1>Về TBS Logistics</h1><p>...</p>',
      status: 'PUBLISHED',
      authorId: 'admin-user-id',
      publishedAt: new Date(),
    },
  });

  // Create sample menu
  const menu = await prisma.menu.create({
    data: {
      name: 'Main Menu',
      location: 'HEADER',
      isActive: true,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      { menuId: menu.id, label: 'Trang chủ', url: '/', order: 1 },
      { menuId: menu.id, label: 'Giới thiệu', url: '/gioi-thieu', order: 2 },
      { menuId: menu.id, label: 'Dịch vụ', url: '/dich-vu', order: 3 },
    ],
  });

  // Create sample settings
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
        label: 'Email liên hệ',
        order: 1,
        isPublic: true,
      },
    ],
  });
}
```

---

## 🎯 Next Steps

### Modules to Complete

1. **Media Module** 🔨
   - File upload interceptor
   - Image processing with Sharp
   - S3 integration (optional)

2. **Menu Module** 🔨
   - Nested menu items
   - Drag-and-drop API
   - Public menu endpoint

3. **Settings Module** 🔨
   - Key-value store
   - Type conversion
   - Public settings cache

4. **Blog Enhancements** 🔨
   - Categories
   - Comments (optional)
   - View tracking
   - Related posts

5. **Public Endpoints** 🔨
   - Page by slug
   - Blog posts list/detail
   - Menus
   - Settings
   - Contact form
   - Newsletter

---

## 📖 API Examples

### Create Page
```bash
curl -X POST http://localhost:3000/cms/pages \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "about",
    "title": "Về chúng tôi",
    "content": "<h1>About Us</h1><p>Content here...</p>",
    "status": "PUBLISHED",
    "metaTitle": "Về TBS Logistics",
    "metaDescription": "Chúng tôi là công ty vận chuyển hàng đầu..."
  }'
```

### List Pages
```bash
curl http://localhost:3000/cms/pages?status=PUBLISHED&page=1&limit=20 \
  -H "Authorization: Bearer <token>"
```

### Upload Media
```bash
curl -X POST http://localhost:3000/cms/media/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/image.jpg"
```

---

## ✅ Summary

### Completed ✅
- ✅ CMS Schema (cms.prisma)
- ✅ Enhanced Blog Schema (blog.prisma)
- ✅ Pages Module (full CRUD)
- ✅ DTOs and validation
- ✅ Authentication & authorization

### To Complete 🔨
- 🔨 Media Module
- 🔨 Menu Module
- 🔨 Settings Module
- 🔨 Blog Categories
- 🔨 Public Endpoints
- 🔨 Frontend CMS UI

---

**Architecture Status:** 🟢 Ready for implementation
**Database Schema:** 🟢 Complete
**Core Modules:** 🟡 70% Complete
**Documentation:** 🟢 Complete
