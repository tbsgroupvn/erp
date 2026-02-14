# TBS ERP - CMS Implementation Guide

## 🎯 Tổng quan dự án

Dự án CMS hoàn chỉnh cho hệ thống TBS ERP Logistics, bao gồm backend API (NestJS + Prisma + PostgreSQL) và frontend admin UI (Next.js + React + Tailwind CSS).

---

## ✅ Đã hoàn thành

### Backend (NestJS)

#### 1. Database Schema ✅
- **File:** `prisma/schema/cms.prisma`
- **Models:**
  - Page (trang tĩnh)
  - Media (media library)
  - Menu, MenuItem (menu động)
  - SiteSetting (cấu hình website)
  - Redirect (SEO redirects)
  - ContactSubmission (form liên hệ)
  - NewsletterSubscription (newsletter)
  - FAQ (câu hỏi thường gặp)

#### 2. Enhanced Blog Schema ✅
- **File:** `prisma/schema/blog.prisma`
- **Updates:**
  - BlogCategory với hierarchy
  - SEO fields (metaTitle, metaDescription, keywords, ogImage)
  - Featured posts (isFeatured)
  - View count tracking
  - Related posts
  - Scheduled publishing
  - BlogComment (optional)

#### 3. Pages Module ✅
- **Location:** `src/modules/cms-pages/`
- **Files:**
  - `cms-pages.module.ts` ✅
  - `pages.controller.ts` ✅
  - `pages.service.ts` ✅
  - `dto/create-page.dto.ts` ✅
  - `dto/update-page.dto.ts` ✅
  - `dto/page-filters.dto.ts` ✅

- **Endpoints:**
  ```
  POST   /cms/pages              # Create page
  GET    /cms/pages              # List pages
  GET    /cms/pages/:id          # Get page by ID
  PATCH  /cms/pages/:id          # Update page
  DELETE /cms/pages/:id          # Delete page
  POST   /cms/pages/reorder      # Reorder pages
  POST   /cms/pages/:id/duplicate # Duplicate page
  ```

- **Features:**
  - ✅ Full CRUD
  - ✅ Slug validation
  - ✅ Auto-publish date
  - ✅ Hierarchy (parent-child)
  - ✅ Search & pagination
  - ✅ Duplicate functionality
  - ✅ Reordering

---

## 🔨 Cần hoàn thành

### Backend

#### 1. Media Module 🔨
**Priority:** HIGH
**Thời gian ước tính:** 4-6 giờ

**Cần tạo:**
```
src/modules/cms-media/
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

**Dependencies:**
```bash
npm install multer @nestjs/platform-express sharp
npm install --save-dev @types/multer
```

**Features:**
- Upload single/multiple files
- Image resizing & thumbnails (Sharp)
- Support: images, videos, documents
- Folder organization
- Tags & search
- Bulk operations
- Optional: AWS S3 integration

**Endpoints:**
```
POST   /cms/media/upload
GET    /cms/media
GET    /cms/media/:id
PATCH  /cms/media/:id
DELETE /cms/media/:id
POST   /cms/media/:id/move
GET    /cms/media/folders
```

#### 2. Menu Module 🔨
**Priority:** HIGH
**Thời gian ước tính:** 3-4 giờ

**Cần tạo:**
```
src/modules/cms-menu/
├── cms-menu.module.ts
├── menu.controller.ts
├── menu.service.ts
└── dto/
    ├── create-menu.dto.ts
    ├── update-menu.dto.ts
    ├── create-menu-item.dto.ts
    └── update-menu-item.dto.ts
```

**Features:**
- Multiple menu locations
- Nested items (unlimited depth)
- Drag-and-drop reordering
- Role-based visibility
- Icons support

**Endpoints:**
```
POST   /cms/menus
GET    /cms/menus
GET    /cms/menus/:id
PATCH  /cms/menus/:id
DELETE /cms/menus/:id
POST   /cms/menus/:id/items
PATCH  /cms/menus/:id/items/:itemId
DELETE /cms/menus/:id/items/:itemId
POST   /cms/menus/:id/items/reorder
```

#### 3. Settings Module 🔨
**Priority:** MEDIUM
**Thời gian ước tính:** 2-3 giờ

**Cần tạo:**
```
src/modules/cms-settings/
├── cms-settings.module.ts
├── settings.controller.ts
├── settings.service.ts
└── dto/
    ├── create-setting.dto.ts
    └── update-setting.dto.ts
```

**Setting Groups:**
- `general` - Site name, logo, description
- `contact` - Email, phone, address
- `social` - Social media links
- `seo` - Default meta tags
- `email` - SMTP settings
- `analytics` - Google Analytics ID

**Endpoints:**
```
GET    /cms/settings
GET    /cms/settings/:key
PUT    /cms/settings/:key
POST   /cms/settings
DELETE /cms/settings/:key
GET    /cms/settings/group/:group
```

#### 4. Blog Categories Module 🔨
**Priority:** MEDIUM
**Thời gian ước tính:** 2 giờ

**Cần tạo:**
```
src/modules/blog/categories/
├── categories.controller.ts
├── categories.service.ts
└── dto/
    ├── create-category.dto.ts
    └── update-category.dto.ts
```

**Endpoints:**
```
POST   /blog/categories
GET    /blog/categories
GET    /blog/categories/:id
PATCH  /blog/categories/:id
DELETE /blog/categories/:id
```

#### 5. Enhanced Blog Module 🔨
**Priority:** MEDIUM
**Thời gian ước tính:** 3-4 giờ

**Location:** `src/modules/blog/` (cần nâng cấp)

**Endpoints mới:**
```
GET    /blog/posts/featured
POST   /blog/posts/:id/view
GET    /blog/posts/:id/related
POST   /blog/posts/:id/schedule
```

**Features:**
- Featured posts filter
- View count increment
- Related posts algorithm (by tags/category)
- Scheduled publishing with cron job

#### 6. Public API Module 🔨
**Priority:** HIGH
**Thời gian ước tính:** 2-3 giờ

**Location:** `src/modules/public/`

**Cần tạo:**
```
public/
├── public.module.ts
├── public.controller.ts
└── public.service.ts
```

**Endpoints (No Auth):**
```
GET    /public/pages/:slug
GET    /public/blog/posts
GET    /public/blog/posts/:slug
GET    /public/blog/categories
GET    /public/menus/:location
GET    /public/settings
POST   /public/contact
POST   /public/newsletter/subscribe
GET    /public/faqs
```

---

### Frontend (Next.js)

#### 1. CMS Admin UI 🔨
**Priority:** HIGH
**Thời gian ước tính:** 12-16 giờ

**Pages cần tạo:**

##### a. Pages Management
**Location:** `src/app/(admin)/cms/pages/`
```
pages/
├── page.tsx                    # List pages
├── tao-moi/
│   └── page.tsx                # Create new page
└── [id]/
    └── page.tsx                # Edit page
```

**Components:**
- PagesList (data table)
- PageForm (create/edit form)
- PageHierarchy (tree view)
- WYSIWYG Editor (React Quill hoặc TipTap)

**Features:**
- List pages với filters (status, search)
- Create/Edit với WYSIWYG editor
- SEO fields section
- Featured image picker
- Parent page selector
- Draft/Publish toggle
- Preview mode
- Duplicate page
- Delete confirmation

##### b. Media Library
**Location:** `src/app/(admin)/cms/media/`
```
media/
├── page.tsx                    # Media library
└── components/
    ├── media-grid.tsx          # Grid view
    ├── media-upload.tsx        # Upload modal
    ├── media-picker.tsx        # Picker for other forms
    └── media-filters.tsx       # Filter sidebar
```

**Features:**
- Grid/List view toggle
- Upload (drag & drop)
- Folder navigation
- Search & filters (type, folder, tags)
- Bulk select & delete
- Image preview lightbox
- Copy URL to clipboard
- Edit metadata modal

##### c. Blog Management
**Location:** `src/app/(admin)/cms/blog/`
```
blog/
├── posts/
│   ├── page.tsx                # List posts
│   ├── tao-moi/
│   │   └── page.tsx            # Create post
│   └── [id]/
│       └── page.tsx            # Edit post
└── categories/
    ├── page.tsx                # List categories
    ├── tao-moi/
    │   └── page.tsx            # Create category
    └── [id]/
        └── page.tsx            # Edit category
```

**Features:**
- Posts list với filters (category, status, featured)
- Create/Edit với WYSIWYG editor
- Category selector
- Tags input (multi-select)
- SEO section
- Featured toggle
- Cover image picker
- Schedule publishing
- Related posts selector
- View count display

##### d. Menu Builder
**Location:** `src/app/(admin)/cms/menus/`
```
menus/
├── page.tsx                    # List menus
├── tao-moi/
│   └── page.tsx                # Create menu
└── [id]/
    └── page.tsx                # Edit menu (with drag-and-drop)
```

**Components:**
- MenuList
- MenuBuilder (drag-and-drop tree)
- MenuItemForm
- IconPicker

**Features:**
- List menus by location
- Create menu
- Drag-and-drop menu items
- Add/Edit/Delete menu items
- Nested items (unlimited depth)
- Icon picker
- Target (_self/_blank) selector
- Role visibility selector
- Reorder items

##### e. Settings
**Location:** `src/app/(admin)/cms/settings/`
```
settings/
└── page.tsx                    # Settings grouped by category
```

**Tabs:**
- General (site name, logo, description)
- Contact (email, phone, address, hours)
- Social (Facebook, Twitter, Instagram, LinkedIn)
- SEO (default meta tags, robots.txt, sitemap)
- Email (SMTP settings)
- Analytics (Google Analytics, Facebook Pixel)

**Features:**
- Tabbed interface
- Form with validation
- Image upload for logo
- JSON editor for complex settings
- Save & reset buttons
- Test email button (for SMTP)

##### f. Contact Submissions
**Location:** `src/app/(admin)/cms/contact/`
```
contact/
├── page.tsx                    # List submissions
└── [id]/
    └── page.tsx                # View submission
```

**Features:**
- List submissions (read/unread filter)
- Mark as read/unread
- Add notes
- Reply via email integration
- Delete submission
- Export to CSV

##### g. Newsletter
**Location:** `src/app/(admin)/cms/newsletter/`
```
newsletter/
├── page.tsx                    # List subscribers
└── export/
    └── page.tsx                # Export subscribers
```

**Features:**
- List subscribers
- Filter by status (active/unsubscribed)
- Search by email
- Export to CSV
- View subscription source
- Manually add subscriber
- Delete subscriber

##### h. FAQs
**Location:** `src/app/(admin)/cms/faqs/`
```
faqs/
├── page.tsx                    # List FAQs
├── tao-moi/
│   └── page.tsx                # Create FAQ
└── [id]/
    └── page.tsx                # Edit FAQ
```

**Features:**
- List FAQs by category
- Create/Edit FAQ
- Reorder FAQs
- Category management
- Active/Inactive toggle

---

#### 2. Shared Components 🔨

**Location:** `src/components/cms/`

**Cần tạo:**

##### a. WYSIWYG Editor
```typescript
// src/components/cms/editor.tsx
'use client';

import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function Editor({ value, onChange }: EditorProps) {
  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image', 'video'],
      ['clean'],
    ],
  };

  return (
    <ReactQuill
      theme="snow"
      value={value}
      onChange={onChange}
      modules={modules}
      className="h-96"
    />
  );
}
```

##### b. Media Picker
```typescript
// src/components/cms/media-picker.tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface MediaPickerProps {
  onSelect: (media: any) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MediaPicker({ onSelect, open, onOpenChange }: MediaPickerProps) {
  const [selected, setSelected] = useState<any>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Chọn Media</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {/* Media grid here */}
        </div>
        <Button onClick={() => onSelect(selected)}>
          Chọn
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

##### c. Slug Generator
```typescript
// src/components/cms/slug-input.tsx
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface SlugInputProps {
  title: string;
  slug: string;
  onSlugChange: (slug: string) => void;
}

export function SlugInput({ title, slug, onSlugChange }: SlugInputProps) {
  const generateSlug = () => {
    const newSlug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    onSlugChange(newSlug);
  };

  return (
    <div className="space-y-2">
      <Label>Slug</Label>
      <div className="flex gap-2">
        <Input
          value={slug}
          onChange={(e) => onSlugChange(e.target.value)}
          placeholder="url-slug"
        />
        <Button type="button" variant="outline" onClick={generateSlug}>
          Tạo từ tiêu đề
        </Button>
      </div>
    </div>
  );
}
```

##### d. SEO Fields Component
```typescript
// src/components/cms/seo-fields.tsx
'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface SEOFieldsProps {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string[];
  onMetaTitleChange: (value: string) => void;
  onMetaDescriptionChange: (value: string) => void;
  onMetaKeywordsChange: (value: string[]) => void;
}

export function SEOFields({
  metaTitle,
  metaDescription,
  metaKeywords,
  onMetaTitleChange,
  onMetaDescriptionChange,
  onMetaKeywordsChange,
}: SEOFieldsProps) {
  return (
    <div className="rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold">SEO Settings</h3>

      <div className="space-y-2">
        <Label>Meta Title</Label>
        <Input
          value={metaTitle}
          onChange={(e) => onMetaTitleChange(e.target.value)}
          maxLength={60}
        />
        <p className="text-sm text-muted-foreground">
          {metaTitle.length}/60 ký tự
        </p>
      </div>

      <div className="space-y-2">
        <Label>Meta Description</Label>
        <Textarea
          value={metaDescription}
          onChange={(e) => onMetaDescriptionChange(e.target.value)}
          maxLength={160}
          rows={3}
        />
        <p className="text-sm text-muted-foreground">
          {metaDescription.length}/160 ký tự
        </p>
      </div>

      <div className="space-y-2">
        <Label>Meta Keywords (phân cách bằng dấu phẩy)</Label>
        <Input
          value={metaKeywords.join(', ')}
          onChange={(e) =>
            onMetaKeywordsChange(
              e.target.value.split(',').map((k) => k.trim())
            )
          }
        />
      </div>
    </div>
  );
}
```

---

#### 3. API Integration 🔨

**Location:** `src/lib/api/`

**Cần tạo:**
```
api/
├── cms/
│   ├── pages.ts
│   ├── media.ts
│   ├── menus.ts
│   └── settings.ts
└── blog/
    ├── posts.ts
    └── categories.ts
```

**Example:**
```typescript
// src/lib/api/cms/pages.ts
import { api } from '@/lib/api/client';

export const pagesApi = {
  list: (filters: any) => api.get('/cms/pages', { params: filters }),
  get: (id: string) => api.get(`/cms/pages/${id}`),
  create: (data: any) => api.post('/cms/pages', data),
  update: (id: string, data: any) => api.patch(`/cms/pages/${id}`, data),
  delete: (id: string) => api.delete(`/cms/pages/${id}`),
  duplicate: (id: string) => api.post(`/cms/pages/${id}/duplicate`),
  reorder: (items: any[]) => api.post('/cms/pages/reorder', { items }),
};
```

---

## 🚀 Implementation Steps

### Phase 1: Backend Core (Tuần 1)
**Thời gian: 3-5 ngày**

1. ✅ Setup schema (DONE)
2. ✅ Pages Module (DONE)
3. 🔨 Media Module
4. 🔨 Menu Module
5. 🔨 Settings Module
6. 🔨 Public API endpoints

### Phase 2: Backend Extended (Tuần 2)
**Thời gian: 2-3 ngày**

1. 🔨 Blog Categories
2. 🔨 Enhanced Blog features
3. 🔨 Testing
4. 🔨 Swagger documentation

### Phase 3: Frontend Admin (Tuần 2-3)
**Thời gian: 5-7 ngày**

1. 🔨 Pages Management UI
2. 🔨 Media Library UI
3. 🔨 Blog Management UI
4. 🔨 Menu Builder UI
5. 🔨 Settings UI

### Phase 4: Polish & Deploy (Tuần 3)
**Thời gian: 2-3 ngày**

1. 🔨 Contact/Newsletter UI
2. 🔨 FAQs UI
3. 🔨 Testing & bug fixes
4. 🔨 Documentation
5. 🔨 Deployment

---

## 📦 Required Dependencies

### Backend (thêm vào package.json)
```json
{
  "dependencies": {
    "multer": "^1.4.5-lts.1",
    "sharp": "^0.33.5"
  },
  "devDependencies": {
    "@types/multer": "^2.0.0"
  }
}
```

### Frontend (thêm vào package.json)
```json
{
  "dependencies": {
    "react-quill": "^2.0.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "react-dropzone": "^14.2.3"
  }
}
```

---

## 🎯 Quick Start

### 1. Run migrations
```bash
cd tbs-erp-backend
npm run prisma:generate
npm run prisma:migrate
```

### 2. Start backend
```bash
npm run start:dev
```

### 3. Start frontend
```bash
cd tbs-erp-frontend
npm run dev
```

### 4. Access
- Backend API: http://localhost:3000
- Frontend: http://localhost:3001
- Swagger Docs: http://localhost:3000/api/docs

---

## 📚 Resources

### Documentation
- ✅ `CMS_BACKEND_ARCHITECTURE.md` - Backend architecture chi tiết
- ✅ `CMS_IMPLEMENTATION_GUIDE.md` - Hướng dẫn này
- 🔨 `CMS_API_DOCUMENTATION.md` - API docs (sẽ tạo)

### Code References
- NestJS Docs: https://docs.nestjs.com
- Prisma Docs: https://www.prisma.io/docs
- Next.js Docs: https://nextjs.org/docs
- React Quill: https://github.com/zenoamaro/react-quill
- dnd-kit: https://docs.dndkit.com

---

## ✅ Checklist

### Backend
- [x] CMS Schema created
- [x] Blog Schema enhanced
- [x] Pages Module implemented
- [ ] Media Module implemented
- [ ] Menu Module implemented
- [ ] Settings Module implemented
- [ ] Blog Categories implemented
- [ ] Blog enhancements implemented
- [ ] Public API endpoints implemented
- [ ] Swagger documentation added
- [ ] Unit tests written
- [ ] E2E tests written

### Frontend
- [ ] Pages Management UI
- [ ] Media Library UI
- [ ] Blog Management UI
- [ ] Menu Builder UI
- [ ] Settings UI
- [ ] Contact Submissions UI
- [ ] Newsletter UI
- [ ] FAQs UI
- [ ] Shared components (Editor, MediaPicker, etc.)
- [ ] API integration
- [ ] Form validation
- [ ] Error handling
- [ ] Loading states

### Deployment
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Seed data created
- [ ] File storage configured (local/S3)
- [ ] CORS configured
- [ ] Rate limiting configured
- [ ] Logging setup
- [ ] Monitoring setup

---

## 💡 Pro Tips

1. **Testing as you go** - Viết tests cho mỗi module ngay khi implement
2. **Use Prisma Studio** - `npm run prisma:studio` để xem data
3. **Swagger First** - Setup Swagger decorators ngay từ đầu
4. **Reusable Components** - Tạo shared components cho frontend
5. **Type Safety** - Generate Prisma types và sử dụng trong frontend
6. **Error Handling** - Consistent error handling với proper HTTP codes
7. **Logging** - Log tất cả operations để dễ debug
8. **Validation** - Validate ở cả backend (DTOs) và frontend (forms)

---

**Status:** 🟡 30% Complete
**Next Task:** Implement Media Module 🔨
**Priority:** HIGH
